import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { Patcher } from '../lib/patcher.js';
import { hash, writeJSON, readJSON, withLock } from '../lib/storage.js';
import { patchJS, stringSites, isProse } from '../lib/syntax.js';
import { validateTranslation, renderChangelog, changelogEntries } from '../lib/changelog.js';

const ui = `export class InteractiveMode { render(){ return "Settings"; } }
const options = {id:"Settings", label:"Theme", currentValue:"regular", values:["Theme"], name:"Settings"};
if (options.id === "Settings") console.log("No changelog entries found.");
export const message = \`Updated to v\${version}. Use \${theme.bold("/changelog")} to view full changelog.\`;
`;
const changelog = '# Changelog\n\n## [1.0.0] - 2026-10-01\n\n### Added\n\n- Added `models.generateImages()` in [Codemode](docs/codemode.md).\n\n```js\nconsole.log("Settings");\n\nconst role = "assistant";\n```\n\n## [0.9.0] - 2026-09-01\n\n### Fixed\n\n- Fixed /login for MCP.\n';
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'pi-zh-test-'));
  const root = join(dir, 'pi');
  const data = join(dir, 'data');
  mkdirSync(join(root, 'dist/modes/interactive'), { recursive: true });
  mkdirSync(join(root, 'dist/bundle/chunks'), { recursive: true });
  writeJSON(join(root, 'package.json'), { name: '@earendil-works/pi-coding-agent', version: '1.0.0' });
  writeFileSync(join(root, 'dist/modes/interactive/interactive-mode.js'), ui, { mode: 0o755 });
  writeFileSync(join(root, 'dist/bundle/chunks/chunk-ONE.js'), ui);
  writeFileSync(join(root, 'CHANGELOG.md'), changelog);
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const catalog = { schema: 1, versions: { '1.0.0': { ui: {}, changelog: {} }, '2.0.0': { ui: {}, changelog: {} } } };
  return { root, data, p: new Patcher(root, data, { catalog }) };
}

test('AST patch translates only values, preserves protocol and expression code', () => {
  const result = patchJS(ui, { Settings: '设置', Theme: '主题', regular: '普通',
    'No changelog entries found.': '未找到更新公告。',
    'Updated to v@@PI_EXPR_0@@. Use @@PI_EXPR_1@@ to view full changelog.': '已更新至 v@@PI_EXPR_0@@。用 @@PI_EXPR_1@@ 查看更新公告。' });
  assert.match(result.source, /return "设置"/);
  assert.match(result.source, /label:"主题"/);
  assert.match(result.source, /id:"Settings"/);
  assert.match(result.source, /currentValue:"regular"/);
  assert.match(result.source, /values:\["Theme"\]/);
  assert.match(result.source, /name:"Settings"/);
  assert.match(result.source, /=== "Settings"/);
  assert.match(result.source, /\$\{theme.bold\("\/changelog"\)\)??\}/);
  assert.ok(stringSites(result.source).some((s) => s.text.includes('已更新至')));
});

test('imports, comparisons, switch branches, property keys and matching patterns are untouched', () => {
  const source = 'import x from "Settings"; const a={"Settings":"Theme"}; if(x==="Settings"){}; switch(x){case "Settings":break} x["Settings"]; /Settings/.test(x); x.includes("Settings"); tag`Settings`;';
  assert.equal(patchJS(source, { Settings: '设置', Theme: '主题' }).source, source);
});

test('template escaping cannot introduce executable code', () => {
  const source = 'const text=`A new feature ${name}`;';
  const translated = '新的 `${globalThis.compromised = true}` 特性 @@PI_EXPR_0@@';
  const patched = patchJS(source, { 'A new feature @@PI_EXPR_0@@': translated }).source;
  assert.match(patched, /\\\$\{globalThis/);
  assert.equal(stringSites(patched)[0].text, translated);
});

test('nested display strings are translated even when the containing template is translated', () => {
  const source = 'console.log(`Help ${chalk.bold("Usage:")} for ${name}`);';
  const patched = patchJS(source, { 'Help @@PI_EXPR_0@@ for @@PI_EXPR_1@@': '帮助 @@PI_EXPR_0@@：@@PI_EXPR_1@@', 'Usage:': '用法：' }).source;
  assert.ok(patched.includes('chalk.bold("用法：")'));
  assert.ok(patched.includes('${name}'));
});

test('template expression removal, duplication and reordering are rejected', () => {
  const source = 'const text=`Hello ${a} and ${b}`;';
  for (const value of ['你好 @@PI_EXPR_0@@', '你好 @@PI_EXPR_1@@ @@PI_EXPR_0@@', '你好 @@PI_EXPR_0@@ @@PI_EXPR_0@@']) {
    assert.throws(() => patchJS(source, { 'Hello @@PI_EXPR_0@@ and @@PI_EXPR_1@@': value }), /标记/);
  }
});

test('prose discovery ignores markup, paths, protocol fragments and pure interpolation', () => {
  for (const text of ['@@PI_EXPR_0@@ @@PI_EXPR_1@@', '<file name="@@PI_EXPR_0@@">@@PI_EXPR_1@@</file>', '#4d9abf', 'CH@@PI_EXPR_0@@%', 'regular', 'http://example.com', 'dist/bundle/cli.js', 'auth check']) assert.equal(isProse(text), false, text);
  assert.equal(isProse('Settings'), true);
  assert.equal(isProse('to cancel'), true);
});

test('apply is idempotent, patches both bundle and unbundled build, preserves permissions', (t) => {
  const { root, p } = fixture(t);
  const first = p.apply();
  assert.equal(first.changedFiles, 3);
  assert.match(readFileSync(join(root, 'dist/bundle/chunks/chunk-ONE.js'), 'utf8'), /设置/);
  assert.equal(p.apply().changedFiles, 0);
  assert.equal(statSync(join(root, 'dist/modes/interactive/interactive-mode.js')).mode & 0o777, 0o755);
  assert.equal(p.restore().restoredFiles, 3);
  assert.equal(readFileSync(join(root, 'dist/modes/interactive/interactive-mode.js'), 'utf8'), ui);
  assert.equal(readFileSync(join(root, 'CHANGELOG.md'), 'utf8'), changelog);
  assert.equal(p.restore().restoredFiles, 0);
});

test('bundled template variants are discovered only inside known core owner scopes', (t) => {
  const { root, data, p } = fixture(t);
  writeFileSync(join(root, 'dist/bundle/chunks/chunk-ONE.js'), 'export class InteractiveMode { render(){return `A new feature ${version}`;} } class ThirdPartyLibrary {render(){return "Unknown vendor text";}}');
  assert.ok(p.inventory().has('A new feature @@PI_EXPR_0@@'));
  assert.equal(p.inventory().has('Unknown vendor text'), false);
  p.catalog.versions['1.0.0'].ui['A new feature @@PI_EXPR_0@@'] = '新功能 @@PI_EXPR_0@@';
  p.apply();
  const bundle = readFileSync(join(root, 'dist/bundle/chunks/chunk-ONE.js'), 'utf8');
  assert.match(bundle, /新功能/);
  assert.match(bundle, /Unknown vendor text/);
});

test('expanded dictionaries reapply from original, never compound translations', (t) => {
  const { root, data, p } = fixture(t);
  p.apply();
  p.catalog.versions['1.0.0'].ui.Settings = '中文设置';
  p.apply();
  assert.match(readFileSync(join(root, 'dist/bundle/chunks/chunk-ONE.js'), 'utf8'), /中文设置/);
  assert.doesNotMatch(readFileSync(join(root, 'dist/bundle/chunks/chunk-ONE.js'), 'utf8'), /中文中文/);
  p.restore();
  assert.equal(readFileSync(join(root, 'dist/bundle/chunks/chunk-ONE.js'), 'utf8'), ui);
});

test('external changes prevent apply and restore without partially restoring other files', (t) => {
  const { root, p } = fixture(t);
  p.apply();
  const bundle = join(root, 'dist/bundle/chunks/chunk-ONE.js');
  const source = join(root, 'dist/modes/interactive/interactive-mode.js');
  const before = readFileSync(source, 'utf8');
  writeFileSync(bundle, 'export const externallyChanged = true;');
  assert.throws(() => p.apply(), /其他工具修改/);
  assert.throws(() => p.restore(), /拒绝恢复/);
  assert.equal(readFileSync(source, 'utf8'), before);
});

test('new Pi version uses new originals and never restores an old version over changed files', (t) => {
  const { root, p } = fixture(t);
  p.apply();
  const source = join(root, 'dist/modes/interactive/interactive-mode.js');
  const updated = ui + '\n// version 2\n';
  writeJSON(join(root, 'package.json'), { name: '@earendil-works/pi-coding-agent', version: '2.0.0' });
  writeFileSync(source, updated);
  p.apply();
  p.restore();
  assert.equal(readFileSync(source, 'utf8'), updated);
});

test('upgraded externally replaced files are not overwritten by restore', (t) => {
  const { root, p } = fixture(t);
  p.apply();
  const source = join(root, 'dist/modes/interactive/interactive-mode.js');
  const updated = ui + '// version 2\n';
  writeJSON(join(root, 'package.json'), { name: '@earendil-works/pi-coding-agent', version: '2.0.0' });
  writeFileSync(source, updated);
  p.restore();
  assert.equal(readFileSync(source, 'utf8'), updated);
});

test('corrupted backups refuse restoration', (t) => {
  const { p } = fixture(t);
  p.apply();
  const record = Object.values(p.state().files)[0];
  writeFileSync(join(p.dir, 'originals', `${record.originalHash}.txt`), 'corrupted');
  assert.throws(() => p.restore(), /备份损坏/);
});

test('corrupted state never silently discards backup records', (t) => {
  const { p } = fixture(t);
  p.apply();
  writeFileSync(p.stateFile, '{broken');
  assert.throws(() => p.apply(), SyntaxError);
});

test('manifest path traversal and malicious hashes are rejected', (t) => {
  const { p } = fixture(t);
  for (const files of [{ '../outside.js': { originalHash: hash('a'), patchedHash: hash('b') } },
    { 'dist/malicious.js': { originalHash: '../../outside', patchedHash: hash('b') } }]) {
    writeJSON(p.stateFile, { schema: 1, root: p.root, files });
    assert.throws(() => p.state(), /路径|摘要/);
  }
});

test('symlinked files and directories are never modified', (t) => {
  const { root, data, p } = fixture(t);
  mkdirSync(data, { recursive: true });
  const outside = join(data, 'outside.js');
  writeFileSync(outside, ui);
  const source = join(root, 'dist/modes/interactive/interactive-mode.js');
  rmSync(source);
  symlinkSync(outside, source);
  assert.equal(p.apply().changedFiles, 2); // symlink is not enumerated
  assert.equal(readFileSync(outside, 'utf8'), ui);
  assert.throws(() => p.original('dist/modes/interactive/interactive-mode.js'), /符号链接/);
});

test('concurrent patch operations are rejected and lock always releases', (t) => {
  const { p } = fixture(t);
  withLock(p.dir, () => assert.throws(() => p.apply(), /正在运行/));
  assert.equal(p.apply().changedFiles, 3);
});

test('bundled announcement translation preserves code, links and versions', (t) => {
  const { root, p } = fixture(t);
  const entry = changelogEntries(changelog)[0];
  const translated = entry.source.replaceAll('### Added', '### 新增').replaceAll('- Added', '- 新增');
  p.catalog.versions['1.0.0'].changelog[hash(entry.source)] = translated;
  const rendered = renderChangelog(changelog, p.catalog.versions['1.0.0'].changelog);
  assert.match(rendered, /- 新增/);
  assert.match(rendered, /- Fixed \/login for MCP/);
  assert.ok(rendered.includes('console.log("Settings");\n\nconst role = "assistant";'));
  p.apply();
  assert.equal(readFileSync(join(root, 'CHANGELOG.md'), 'utf8'), rendered);
  p.restore();
  assert.equal(readFileSync(join(root, 'CHANGELOG.md'), 'utf8'), changelog);
});

test('offline heading localization never modifies headings inside fenced code', () => {
  const source = '# Changelog\n\n## [1.0.0]\n\n### Added\n\n```md\n# Changelog\n### Added\n```\n';
  const rendered = renderChangelog(source, {});
  assert.match(rendered, /^# 更新公告/);
  assert.ok(rendered.includes('```md\n# Changelog\n### Added\n```'));
});

test('prebuilt announcements reject changed code, links, commands and version headers', () => {
  const source = changelogEntries(changelog)[0].source;
  for (const bad of [source.replace('1.0.0', '9.0.0'), source.replace('models.generateImages()', 'models.other()'), source.replace('docs/codemode.md', 'http://evil.invalid'), '']) assert.throws(() => validateTranslation(source, bad));
});

test('unknown Pi versions require a plugin update before touching files', (t) => {
  const { root, p } = fixture(t);
  writeJSON(join(root, 'package.json'), { name: '@earendil-works/pi-coding-agent', version: '9.0.0' });
  assert.equal(p.status().supported, false);
  assert.throws(() => p.apply(), /请先更新插件/);
  assert.equal(readFileSync(join(root, 'dist/modes/interactive/interactive-mode.js'), 'utf8'), ui);
});

test('old model caches are preserved but do not override bundled resources', (t) => {
  const { data, p } = fixture(t);
  writeJSON(join(data, 'ui.json'), { Settings: '不得使用旧缓存' });
  writeJSON(join(data, 'changelog.json'), { wrong: '不得使用旧缓存' });
  assert.equal(p.dictionary().Settings, '设置');
  p.apply();
  assert.equal(readJSON(join(data, 'ui.json'), {}).Settings, '不得使用旧缓存');
});

test('extension contains no runtime model translation path', () => {
  const extension = readFileSync('extensions/index.ts', 'utf8');
  assert.doesNotMatch(extension, /modelRegistry|streamSimple|completeSimple|translateBatch|translateUI|translateChangelog/);
  assert.match(extension, /updatePackage/);
});

test('standalone CLI status, apply, restore and invalid options', (t) => {
  const { root, data } = fixture(t);
  const cli = (action, ...extra) => spawnSync(process.execPath, ['bin/pi-zh-cn.js', action, '--root', root, '--data-dir', data, ...extra], { encoding: 'utf8' });
  assert.equal(cli('status').status, 0);
  assert.equal(cli('apply').status, 0);
  assert.equal(cli('restore').status, 0);
  assert.equal(readJSON(join(data, 'config.json'), {}).enabled, false);
  assert.equal(cli('status', '--bad').status, 1);
  assert.equal(cli('unknown').status, 1);
});
