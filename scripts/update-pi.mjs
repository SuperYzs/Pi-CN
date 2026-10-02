import { existsSync, readFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { Patcher } from '../lib/patcher.js';
import { hash, readJSON, writeJSON, atomicWrite } from '../lib/storage.js';
import { changelogEntries, validateTranslation, normalizeChangelog, protectedValues } from '../lib/changelog.js';
import { encodeSite } from '../lib/syntax.js';
import { CATALOG_FILE, loadCatalog } from '../lib/releases.js';

const UPSTREAM = '@earendil-works/pi-coding-agent';
const project = fileURLToPath(new URL('..', import.meta.url));
export function validateUI(ui) {
  for (const [source, translated] of Object.entries(ui)) {
    if (typeof translated !== 'string' || !translated.trim()) throw new Error(`界面译文为空：${source}`);
    const markers = source.match(/@@PI_EXPR_\d+@@/g) ?? [];
    encodeSite({ kind: 'template', expressions: markers.map(() => 'undefined') }, translated);
  }
}
export function compileChangelog(source, translated) {
  const entries = changelogEntries(source);
  const chinese = changelogEntries(translated);
  if (entries.length !== chinese.length || new Set(chinese.map(({ version }) => version)).size !== entries.length) throw new Error('中文公告缺少版本或包含重复版本');
  const changelog = {}, changelogAliases = {};
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i], target = chinese[i];
    if (entry.version !== target.version) throw new Error('中文公告版本顺序被修改');
    validateTranslation(normalizeChangelog(entry.source), normalizeChangelog(target.source));
    const prose = (text) => { for (const value of protectedValues(text)) text = text.replace(value, ''); return text; };
    const sourceLines = prose(entry.source).split('\n'), targetLines = prose(target.source).split('\n');
    if (sourceLines.length !== targetLines.length) throw new Error(`公告行结构被修改：${entry.version}`);
    const naturalEnglish = /\b(?:the|a|an|with|for|from|and|when|that|this|now|can|will|was|were|is|are|added|changed|fixed|removed|deprecated|support|use|read|prevent|allow|enable|update|improve)\b/i;
    for (let line = 0; line < sourceLines.length; line++) {
      if (naturalEnglish.test(sourceLines[line]) && !/[\u3400-\u9fff]/.test(targetLines[line])) throw new Error(`公告正文尚未汉化：${entry.version} 第 ${line + 1} 行`);
    }
    const key = hash(entry.source);
    changelog[key] = target.source;
    changelogAliases[hash(normalizeChangelog(entry.source))] = key;
  }
  return { changelog, changelogAliases, changelogEntries: entries.length, completeChangelog: true };
}
export function prepare(root, maintenanceDir = join(project, 'maintenance')) {
  const p = new Patcher(root);
  const version = p.version();
  const directory = join(maintenanceDir, version);
  const inventory = p.inventory();
  const reviewed = readJSON(join(directory, 'ui.zh.json'), {});
  const dictionary = { ...p.dictionary(), ...reviewed };
  const fullSource = p.original('CHANGELOG.md');
  const entry = changelogEntries(fullSource).find((entry) => entry.version === version);
  if (!entry) throw new Error(`上游 CHANGELOG.md 缺少当前版本 ${version}`);
  mkdirSync(directory, { recursive: true });
  writeJSON(join(directory, 'ui.sources.json'), [...inventory].map(([text, files]) => ({ text, files })));
  writeJSON(join(directory, 'ui.pending.json'), [...inventory].filter(([text]) => !dictionary[text]).map(([text, files]) => ({ text, files })));
  if (!existsSync(join(directory, 'ui.zh.json'))) writeJSON(join(directory, 'ui.zh.json'), {});
  atomicWrite(join(directory, 'changelog.source.md'), entry.source);
  atomicWrite(join(directory, 'history.source.md'), fullSource);
  return { version, directory, candidates: inventory.size, pending: [...inventory.keys()].filter((text) => !dictionary[text]).length };
}
export function build(root, { allowPartialUI = false, maintenanceDir = join(project, 'maintenance'), catalogFile = CATALOG_FILE } = {}) {
  const p = new Patcher(root);
  const version = p.version();
  // Count the resource being compiled, not entries from an older build of the
  // same version which a maintainer might have removed during review.
  if (p.catalog.versions[version]) p.catalog.versions[version] = { ...p.catalog.versions[version], ui: {} };
  const directory = join(maintenanceDir, version);
  const ui = readJSON(join(directory, 'ui.zh.json'), {});
  validateUI(ui);
  const inventory = p.inventory();
  const dictionary = { ...p.dictionary(), ...ui };
  const translated = [...inventory.keys()].filter((text) => typeof dictionary[text] === 'string').length;
  if (translated !== inventory.size && !allowPartialUI) throw new Error(`尚有 ${inventory.size - translated} 条界面候选未维护。补齐 ui.zh.json 后重试；允许保留英文时必须显式传 --allow-partial-ui。`);
  const fullSource = p.original('CHANGELOG.md');
  const source = changelogEntries(fullSource).find((entry) => entry.version === version)?.source;
  if (!source) throw new Error(`未找到上游公告 ${version}`);
  const approvedSource = readFileSync(join(directory, 'changelog.source.md'), 'utf8');
  if (source !== approvedSource) throw new Error('上游公告已变化，请重新 prepare 并更新中文译文');
  const chinese = readFileSync(join(directory, 'changelog.zh.md'), 'utf8');
  validateTranslation(source, chinese);
  let announcements;
  if (existsSync(join(directory, 'history.zh.md'))) {
    if (fullSource !== readFileSync(join(directory, 'history.source.md'), 'utf8')) throw new Error('上游历史公告已变化，请重新 prepare 并审阅译文');
    const history = readFileSync(join(directory, 'history.zh.md'), 'utf8');
    announcements = compileChangelog(fullSource, history);
    if (changelogEntries(history).find((entry) => entry.version === version)?.source !== chinese) throw new Error('本版公告与历史公告中的译文不一致');
  } else {
    if (changelogEntries(fullSource).length > 1) throw new Error('请补齐 history.zh.md 中的全部历史公告后再发布');
    announcements = compileChangelog(source, chinese);
  }
  const catalog = loadCatalog(catalogFile);
  catalog.versions[version] = { ui, ...announcements,
    uiCandidates: inventory.size, uiTranslated: translated, completeUI: translated === inventory.size,
    note: '译文在插件维护/发布阶段生成，运行时只应用内置静态资源。' };
  writeJSON(catalogFile, catalog);
  return { version, translated, candidates: inventory.size, catalogFile };
}
export function check(catalogFile = CATALOG_FILE, maintenanceDir = join(project, 'maintenance')) {
  const catalog = loadCatalog(catalogFile);
  for (const [version, release] of Object.entries(catalog.versions)) {
    validateUI(release.ui);
    const directory = join(maintenanceDir, version);
    const source = readFileSync(join(directory, 'changelog.source.md'), 'utf8');
    const translated = release.changelog[hash(source)];
    validateTranslation(source, translated);
    if (translated !== readFileSync(join(directory, 'changelog.zh.md'), 'utf8')) throw new Error(`发布资源与已审阅公告不一致：${version}`);
    if (release.completeChangelog) {
      const historySource = existsSync(join(directory, 'history.source.md')) ? readFileSync(join(directory, 'history.source.md'), 'utf8') : source;
      const history = existsSync(join(directory, 'history.zh.md')) ? readFileSync(join(directory, 'history.zh.md'), 'utf8') : translated;
      const compiled = compileChangelog(historySource, history);
      for (const field of ['changelog', 'changelogAliases', 'changelogEntries']) {
        if (JSON.stringify(release[field]) !== JSON.stringify(compiled[field])) throw new Error(`发布历史公告与已审阅资源不一致：${version}`);
      }
    }
    if (JSON.stringify(release.ui) !== JSON.stringify(readJSON(join(directory, 'ui.zh.json'), {}))) throw new Error(`发布词库与已审阅词库不一致：${version}`);
  }
  return Object.keys(catalog.versions);
}
function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', timeout: 120000 });
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr || `${command} 执行失败`);
  return result.stdout;
}
async function main() {
  const [action, ...args] = process.argv.slice(2);
  let root, version, allowPartialUI = false;
  while (args.length) {
    const flag = args.shift();
    if (flag === '--allow-partial-ui') allowPartialUI = true;
    else if (['--root', '--version'].includes(flag) && args.length) {
      const value = args.shift();
      if (flag === '--root') root = value; else version = value;
    } else throw new Error(`未知参数或缺少值：${flag}`);
  }
  if (action === 'check') { console.log('已校验离线译文：', check().join(', ')); return; }
  if (!['prepare', 'build'].includes(action) || Boolean(root) === Boolean(version)) throw new Error('用法：update-pi.mjs <prepare|build> (--root <Pi目录>|--version <版本>) [--allow-partial-ui]，或 update-pi.mjs check');
  let temporary;
  try {
    if (version) {
      if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('版本号必须为 x.y.z');
      temporary = mkdtempSync(join(tmpdir(), 'pi-cn-upstream-'));
      const packed = JSON.parse(run('npm', ['pack', `${UPSTREAM}@${version}`, '--ignore-scripts', '--json', '--pack-destination', temporary], temporary));
      const artifact = Array.isArray(packed) ? packed[0] : packed[UPSTREAM];
      if (!artifact?.filename) throw new Error('npm pack 未返回上游包文件名');
      run('tar', ['-xzf', join(temporary, basename(artifact.filename)), '-C', temporary, '--no-same-owner'], temporary);
      root = join(temporary, 'package');
    }
    console.log(action === 'prepare' ? prepare(root) : build(root, { allowPartialUI }));
  } finally { if (temporary) rmSync(temporary, { recursive: true, force: true }); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
