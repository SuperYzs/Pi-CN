import { existsSync, readFileSync, readdirSync, lstatSync, realpathSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringSites, ownerNames, isProse, patchJS } from './syntax.js';
import { hash, readJSON, writeJSON, atomicWrite, withLock, defaultDataDir } from './storage.js';
import { renderChangelog } from './changelog.js';
import { loadCatalog, bundledChangelog, requireVersion } from './releases.js';

const seed = JSON.parse(readFileSync(fileURLToPath(new URL('../locales/zh-CN.json', import.meta.url)), 'utf8'));
export function discoverPi(start = process.argv[1]) {
  if (process.env.PI_ZH_CN_ROOT) return validateRoot(process.env.PI_ZH_CN_ROOT);
  if (!start) throw new Error('找不到 Pi 安装目录，请设置 PI_ZH_CN_ROOT');
  let path = realpathSync(start);
  if (!statSync(path).isDirectory()) path = dirname(path);
  for (;;) {
    const manifest = join(path, 'package.json');
    if (existsSync(manifest)) {
      const pkg = readJSON(manifest, {});
      if (['@earendil-works/pi-coding-agent', '@mariozechner/pi-coding-agent'].includes(pkg.name)) return validateRoot(path);
    }
    const parent = dirname(path);
    if (parent === path) break;
    path = parent;
  }
  throw new Error('找不到 npm 版 Pi 安装目录；请使用 --root 指定（不支持独立二进制）');
}
function validateRoot(root) {
  root = realpathSync(resolve(root));
  const pkg = readJSON(join(root, 'package.json'), {});
  if (!['@earendil-works/pi-coding-agent', '@mariozechner/pi-coding-agent'].includes(pkg.name) || !existsSync(join(root, 'dist'))) {
    throw new Error(`不是受支持的 Pi 安装目录：${root}`);
  }
  return root;
}
function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    // Never follow symlinks while enumerating patch targets.
    return entry.isDirectory() ? walk(path) : entry.isFile() && entry.name.endsWith('.js') ? [path] : [];
  });
}
function sourceFiles(root) {
  return [...walk(join(root, 'dist/modes/interactive')).filter((p) => !p.includes('/theme/')),
    ...walk(join(root, 'dist/cli')),
    ...['dist/main.js', 'dist/cli.js', 'dist/package-manager-cli.js', 'dist/core/slash-commands.js',
      'dist/core/keybindings.js', 'dist/extensions/mcp/ui.js', 'dist/extensions/mcp/cli.js',
      'dist/extensions/llama/ui.js', 'dist/extensions/codemode/renderer.js'].map((p) => join(root, p)).filter(existsSync)];
}
function safeTarget(root, name) {
  if (!name || name.includes('\\') || name.split('/').includes('..') || name.startsWith('/')) throw new Error('不安全的备份路径');
  const target = join(root, name);
  if (name !== 'CHANGELOG.md' && !(name.startsWith('dist/') && name.endsWith('.js'))) throw new Error('不允许的补丁目标');
  // Check every parent, including absent targets, to prevent directory symlink escapes.
  let path = target;
  while (path !== root) {
    if (existsSync(path) && lstatSync(path).isSymbolicLink()) throw new Error(`拒绝修改符号链接：${path}`);
    path = dirname(path);
  }
  return target;
}

export class Patcher {
  constructor(root, dataDir = defaultDataDir(), { catalog = loadCatalog() } = {}) {
    this.catalog = catalog;
    this.root = validateRoot(root);
    this.dataDir = resolve(dataDir);
    this.dir = join(this.dataDir, 'installations', hash(this.root).slice(0, 20));
    this.stateFile = join(this.dir, 'state.json');
  }
  state() {
    const state = readJSON(this.stateFile, { schema: 1, root: this.root, files: {} });
    if (state.schema !== 1 || state.root !== this.root || !state.files || typeof state.files !== 'object') throw new Error('备份清单无效');
    for (const [name, record] of Object.entries(state.files)) {
      safeTarget(this.root, name);
      if (!record || !/^[a-f0-9]{64}$/.test(record.originalHash) || !/^[a-f0-9]{64}$/.test(record.patchedHash)
          || (record.previousPatchedHash && !/^[a-f0-9]{64}$/.test(record.previousPatchedHash))) throw new Error('备份摘要无效');
    }
    return state;
  }
  version() { return readJSON(join(this.root, 'package.json'), {}).version; }
  dictionary() { return { ...seed, ...(this.catalog.versions[this.version()]?.ui ?? {}) }; }
  original(name, state = this.state()) {
    const target = safeTarget(this.root, name);
    const current = readFileSync(target, 'utf8');
    const record = state.files[name];
    if (!record) return current;
    const digest = hash(current);
    if (digest === record.originalHash) return current;
    if (digest === record.patchedHash || digest === record.previousPatchedHash) {
      const backup = readFileSync(join(this.dir, 'originals', `${record.originalHash}.txt`), 'utf8');
      if (hash(backup) !== record.originalHash) throw new Error(`原始备份损坏：${name}`);
      return backup;
    }
    const version = readJSON(join(this.root, 'package.json'), {}).version;
    if (record.version !== version) return current; // New Pi version: never restore an older release over it.
    throw new Error(`文件被其他工具修改，拒绝覆盖：${name}。请先恢复其他补丁或重装 Pi。`);
  }
  bundleFiles() {
    return walk(join(this.root, 'dist/bundle')).filter((file) => {
      const source = readFileSync(file, 'utf8');
      return /\b(?:InteractiveMode|SettingsSelectorComponent|printHelp|SessionSelectorComponent|SelectList|runPackageCommand|ConfigSelectorComponent|showPackageHelp|McpManagerView|LlamaView|codemodeRenderers)\b/.test(source);
    });
  }
  inventory() {
    const state = this.state();
    const sites = new Map();
    const owners = new Set();
    const collect = (source, name, allowedOwners) => {
      for (const site of stringSites(source, allowedOwners)) {
        if (!isProse(site.text)) continue;
        const locations = sites.get(site.text) ?? [];
        locations.push(name);
        sites.set(site.text, locations);
      }
    };
    for (const file of sourceFiles(this.root)) {
      const name = relative(this.root, file).replaceAll('\\', '/');
      const source = this.original(name, state);
      for (const owner of ownerNames(source)) owners.add(owner);
      collect(source, name);
    }
    // Bundlers can fold constants and alter template boundaries. Extract the
    // actual shipped variants within known UI/CLI owner scopes as well, rather
    // than falsely reporting full coverage of only the unbundled build.
    for (const file of this.bundleFiles()) {
      const name = relative(this.root, file).replaceAll('\\', '/');
      collect(this.original(name, state), name, owners);
    }
    return sites;
  }
  status() {
    const dictionary = this.dictionary();
    const inventory = this.inventory();
    return { root: this.root, version: this.version(), supported: Boolean(this.catalog.versions[this.version()]),
      supportedVersions: Object.keys(this.catalog.versions), translationMode: 'bundled-offline',
      candidates: inventory.size, translated: [...inventory.keys()].filter((s) => typeof dictionary[s] === 'string').length,
      patchedFiles: Object.keys(this.state().files).length, dataDir: this.dataDir };
  }
  apply() {
    requireVersion(this.catalog, this.version()); // Unknown releases must never be silently patched.
    return withLock(this.dir, () => {
      const state = this.state();
      // Check tracked files even if an external modification removed the bundle
      // marker used for discovery. Otherwise a conflict could go unnoticed.
      for (const name of Object.keys(state.files)) {
        if (existsSync(safeTarget(this.root, name))) this.original(name, state);
      }
      const dictionary = this.dictionary();
      const inventory = this.inventory();
      const allowed = new Set([...inventory.keys(), ...Object.keys(seed)]);
      const files = [...new Set([...sourceFiles(this.root), ...this.bundleFiles()])];
      const changes = [];
      let count = 0;
      for (const file of files) {
        const name = relative(this.root, file).replaceAll('\\', '/');
        const original = this.original(name, state);
        const result = patchJS(original, dictionary, allowed);
        count += result.count;
        if (result.source !== readFileSync(file, 'utf8')) changes.push({ name, original, patched: result.source });
      }
      const changelog = join(this.root, 'CHANGELOG.md');
      if (existsSync(changelog)) {
        const original = this.original('CHANGELOG.md', state);
        const patched = renderChangelog(original, bundledChangelog(this.catalog));
        if (patched !== readFileSync(changelog, 'utf8')) changes.push({ name: 'CHANGELOG.md', original, patched });
      }
      this.commit(state, changes);
      return { changedFiles: changes.length, replacements: count };
    });
  }
  commit(state, changes) {
    if (!changes.length) return;
    const previous = structuredClone(state);
    const version = readJSON(join(this.root, 'package.json'), {}).version;
    const rollback = changes.map((change) => ({ name: change.name, current: readFileSync(safeTarget(this.root, change.name), 'utf8') }));
    for (const change of changes) {
      const originalHash = hash(change.original);
      const backup = join(this.dir, 'originals', `${originalHash}.txt`);
      if (!existsSync(backup)) atomicWrite(backup, change.original);
      else if (hash(readFileSync(backup, 'utf8')) !== originalHash) throw new Error(`原始备份损坏：${change.name}`);
      const old = state.files[change.name];
      state.files[change.name] = { version, originalHash, patchedHash: hash(change.patched),
        ...(old?.originalHash === originalHash ? { previousPatchedHash: old.patchedHash } : {}) };
    }
    // Journal first: even an interrupted write has a recoverable original.
    writeJSON(this.stateFile, state);
    try {
      for (const change of changes) atomicWrite(safeTarget(this.root, change.name), change.patched);
    } catch (error) {
      for (const change of rollback) atomicWrite(safeTarget(this.root, change.name), change.current);
      writeJSON(this.stateFile, previous);
      throw error;
    }
  }
  restore() {
    return withLock(this.dir, () => {
      const state = this.state();
      const version = readJSON(join(this.root, 'package.json'), {}).version;
      const restores = [];
      const stale = [];
      // Preflight all files before writing any: refuse to overwrite external changes.
      for (const [name, record] of Object.entries(state.files)) {
        const target = safeTarget(this.root, name);
        if (!existsSync(target)) { stale.push(name); continue; }
        const current = readFileSync(target, 'utf8');
        const digest = hash(current);
        if (digest === record.originalHash) { stale.push(name); continue; }
        if (digest !== record.patchedHash && digest !== record.previousPatchedHash) {
          if (record.version !== version) { stale.push(name); continue; }
          throw new Error(`文件已被修改，拒绝恢复：${name}`);
        }
        const original = this.original(name, state);
        restores.push({ name, original });
      }
      const rollback = restores.map(({ name }) => ({ name, current: readFileSync(safeTarget(this.root, name), 'utf8') }));
      try {
        for (const { name, original } of restores) atomicWrite(safeTarget(this.root, name), original);
        for (const { name } of restores) delete state.files[name];
        for (const name of stale) delete state.files[name];
        writeJSON(this.stateFile, state);
      } catch (error) {
        for (const { name, current } of rollback) atomicWrite(safeTarget(this.root, name), current);
        throw error;
      }
      return { restoredFiles: restores.length, skippedOldFiles: stale.length };
    });
  }
}
