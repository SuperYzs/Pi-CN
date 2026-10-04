import { existsSync, readFileSync, readdirSync, lstatSync, realpathSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseJS, stringSites, ownerNames, isOwnedSite, isProse, patchJS } from './syntax.js';
import { runWorker } from './worker.js';
import { safeTarget, readState, restoreInstallation } from './recovery.js';
import { insertUninstallHook } from './uninstall-patch.js';
import { hash, readJSON, writeJSON, atomicWrite, withLock, defaultDataDir } from './storage.js';
import { renderChangelog, changelogCoverage } from './changelog.js';
import { loadCatalog, bundledChangelog, requireVersion } from './releases.js';

const seed = JSON.parse(readFileSync(fileURLToPath(new URL('../locales/zh-CN.json', import.meta.url)), 'utf8'));
const engineHash = hash(['patcher.js', 'syntax.js', 'changelog.js', 'releases.js', 'recovery.js', 'storage.js', 'uninstall-patch.js'].map((name) => readFileSync(fileURLToPath(new URL(name, import.meta.url)))).join('\n'));
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
      'dist/core/keybindings.js', 'dist/core/package-manager.js', 'dist/extensions/mcp/ui.js', 'dist/extensions/mcp/cli.js',
      'dist/extensions/llama/ui.js', 'dist/extensions/codemode/renderer.js'].map((p) => join(root, p)).filter(existsSync)];
}
export class Patcher {
  constructor(root, dataDir = defaultDataDir(), { catalog = loadCatalog() } = {}) {
    this.catalog = catalog;
    this.root = validateRoot(root);
    this.dataDir = resolve(dataDir);
    this.dir = join(this.dataDir, 'installations', hash(this.root).slice(0, 20));
    this.stateFile = join(this.dir, 'state.json');
    this.planFile = join(this.dir, 'prepared.json');
  }
  runAsync(action) { return runWorker(this, action); }
  state() {
    return readState(this.root, this.dir);
  }
  version() { return readJSON(join(this.root, 'package.json'), {}).version; }
  dictionary() { return { ...seed, ...(this.catalog.versions[this.version()]?.ui ?? {}) }; }
  original(name, state = this.state(), current) {
    const target = safeTarget(this.root, name);
    current ??= readFileSync(target, 'utf8');
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
  snapshot(state = this.state()) {
    const bundled = new Set(this.bundleFiles());
    const files = [...new Set([...sourceFiles(this.root), ...bundled])];
    const changelog = join(this.root, 'CHANGELOG.md');
    if (existsSync(changelog)) files.push(changelog);
    const snapshot = new Map();
    for (const file of files) {
      const name = relative(this.root, file).replaceAll('\\', '/');
      const current = readFileSync(safeTarget(this.root, name), 'utf8');
      const original = this.original(name, state, current);
      snapshot.set(name, { name, current, original, originalHash: hash(original), bundled: bundled.has(file) });
    }
    for (const name of Object.keys(state.files)) {
      if (!snapshot.has(name) && existsSync(safeTarget(this.root, name))) this.original(name, state);
    }
    return snapshot;
  }
  uninstallTargets() { return this.catalog.versions[this.version()]?.uninstallTargets ?? {}; }
  recoveryContext() {
    return { root: this.root, dir: this.dir, packageRoot: realpathSync(fileURLToPath(new URL('..', import.meta.url))) };
  }
  prepareRecovery() {
    const directory = join(this.dir, 'recovery');
    for (const target of [directory, join(directory, 'runtime.mjs'), join(directory, 'storage.mjs')]) {
      if (existsSync(target) && lstatSync(target).isSymbolicLink()) throw new Error(`拒绝修改符号链接：${target}`);
    }
    atomicWrite(join(directory, 'storage.mjs'), readFileSync(fileURLToPath(new URL('./storage.js', import.meta.url)), 'utf8'));
    atomicWrite(join(directory, 'runtime.mjs'), readFileSync(fileURLToPath(new URL('./recovery.js', import.meta.url)), 'utf8').replace("from './storage.js'", "from './storage.mjs'"));
  }
  analyze(snapshot) {
    const owners = new Set();
    const inventory = new Map();
    for (const entry of snapshot.values()) {
      if (entry.name === 'CHANGELOG.md' || entry.name === 'dist/core/package-manager.js') continue;
      const tree = parseJS(entry.original);
      if (!entry.bundled) for (const owner of ownerNames(entry.original, tree)) owners.add(owner);
      entry.sites = stringSites(entry.original, undefined, tree, entry.bundled);
    }
    for (const entry of snapshot.values()) {
      for (const site of entry.sites ?? []) {
        if (!isProse(site.text) || (entry.bundled && !isOwnedSite(site, owners))) continue;
        const locations = inventory.get(site.text) ?? [];
        locations.push(entry.name);
        inventory.set(site.text, locations);
      }
    }
    return inventory;
  }
  inventory() { return this.analyze(this.snapshot()); }
  signature(snapshot, dictionary) {
    return hash(JSON.stringify({ engineHash, version: this.version(), dictionary, changelog: bundledChangelog(this.catalog),
      uninstallTargets: this.uninstallTargets(), recoveryContext: this.recoveryContext(),
      originals: [...snapshot.values()].map(({ name, originalHash }) => [name, originalHash]) }));
  }
  readPlan(signature, snapshot) {
    try {
      const plan = readJSON(this.planFile, {});
      if (plan.schema !== 1 || plan.signature !== signature || !Array.isArray(plan.files)
          || ![plan.replacements, plan.candidates, plan.translated].every((n) => Number.isSafeInteger(n) && n >= 0)
          || plan.translated > plan.candidates) return;
      const { planHash, ...payload } = plan;
      if (planHash !== hash(JSON.stringify(payload))) return;
      const seen = new Set();
      for (const file of plan.files) {
        if (!snapshot.has(file.name) || seen.has(file.name) || file.originalHash !== snapshot.get(file.name).originalHash
            || typeof file.patched !== 'string' || hash(file.patched) !== file.patchedHash) return;
        seen.add(file.name);
      }
      return plan;
    } catch { /* A disposable cache must never replace or reset original backups. */ }
  }
  status() {
    const state = this.state();
    const snapshot = this.snapshot(state);
    const dictionary = this.dictionary();
    const plan = this.readPlan(this.signature(snapshot, dictionary), snapshot);
    const inventory = plan ? undefined : this.analyze(snapshot);
    return { root: this.root, version: this.version(), supported: Boolean(this.catalog.versions[this.version()]),
      supportedVersions: Object.keys(this.catalog.versions), translationMode: 'bundled-offline',
      candidates: plan?.candidates ?? inventory.size,
      translated: plan?.translated ?? [...inventory.keys()].filter((s) => typeof dictionary[s] === 'string').length,
      changelog: changelogCoverage(snapshot.get('CHANGELOG.md')?.original ?? '', bundledChangelog(this.catalog)),
      patchedFiles: Object.keys(state.files).length, dataDir: this.dataDir };
  }
  apply() {
    const version = this.version();
    requireVersion(this.catalog, version); // Unknown releases must never be silently patched.
    return withLock(this.dir, () => {
      const state = this.state();
      const snapshot = this.snapshot(state);
      const uninstallTargets = this.uninstallTargets();
      for (const [name, expectedHash] of Object.entries(uninstallTargets)) {
        const approved = Array.isArray(expectedHash) ? expectedHash : [expectedHash];
        if (!snapshot.has(name)) throw new Error(`Pi 卸载入口缺失，拒绝修改：${name}`);
        if (!approved.includes(snapshot.get(name).originalHash)) throw new Error(`Pi 卸载入口内容未适配，拒绝修改：${name}`);
      }
      const dictionary = this.dictionary();
      const signature = this.signature(snapshot, dictionary);
      let plan = this.readPlan(signature, snapshot);
      const cacheHit = Boolean(plan);
      if (!plan) {
        const inventory = this.analyze(snapshot);
        const allowed = new Set([...inventory.keys(), ...Object.keys(seed)]);
        const files = [];
        let replacements = 0;
        for (const entry of snapshot.values()) {
          const result = entry.name === 'CHANGELOG.md'
            ? { source: renderChangelog(entry.original, bundledChangelog(this.catalog)), count: 0 }
            : entry.name === 'dist/core/package-manager.js' ? { source: entry.original, count: 0 }
              : patchJS(entry.original, dictionary, allowed, entry.sites);
          if (uninstallTargets[entry.name]) {
            const hookURL = pathToFileURL(join(this.dir, 'recovery/runtime.mjs')).href;
            result.source = insertUninstallHook(result.source, hookURL, this.recoveryContext());
          }
          replacements += result.count;
          if (result.source !== entry.original) files.push({ name: entry.name, originalHash: entry.originalHash,
            patched: result.source, patchedHash: hash(result.source) });
        }
        plan = { schema: 1, signature, files, replacements, candidates: inventory.size,
          translated: [...inventory.keys()].filter((s) => typeof dictionary[s] === 'string').length };
        plan.planHash = hash(JSON.stringify(plan));
      }
      const changes = plan.files.filter((file) => file.patched !== snapshot.get(file.name).current)
        .map((file) => ({ name: file.name, original: snapshot.get(file.name).original, patched: file.patched,
          expectedCurrentHash: hash(snapshot.get(file.name).current) }));
      if (this.version() !== version) throw new Error('Pi 版本在操作期间发生变化，请重试。');
      if (Object.keys(uninstallTargets).some((name) => snapshot.has(name))) this.prepareRecovery();
      this.commit(state, changes);
      if (!cacheHit) try { writeJSON(this.planFile, plan); } catch { /* Caching is optional, successful patches remain successful. */ }
      return { changedFiles: changes.length, replacements: plan.replacements, cacheHit,
        changelog: changelogCoverage(snapshot.get('CHANGELOG.md')?.original ?? '', bundledChangelog(this.catalog)) };
    });
  }
  commit(state, changes) {
    if (!changes.length) return;
    const previous = structuredClone(state);
    const version = readJSON(join(this.root, 'package.json'), {}).version;
    const rollback = changes.map((change) => {
      const current = readFileSync(safeTarget(this.root, change.name), 'utf8');
      if (change.expectedCurrentHash && hash(current) !== change.expectedCurrentHash) throw new Error(`文件在操作期间被修改，拒绝覆盖：${change.name}`);
      return { name: change.name, current };
    });
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
  restore() { return restoreInstallation(this.root, this.dir); }
}
