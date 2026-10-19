import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadCatalog, bundledChangelog, requireVersion } from '../lib/releases.js';
import { changelogCoverage, changelogEntries, normalizeChangelog, protectedValues, renderChangelog } from '../lib/changelog.js';
import { validateUI } from '../scripts/update-pi.mjs';

const catalog = loadCatalog();
const versions = [
  { version: '1.0.1', previous: '1.0.0', history: 283, added: 1, candidates: 881, translated: 856, bundle: 'chunk-5OEJBNHG.js' },
  { version: '1.0.2', previous: '1.0.1', history: 284, added: 1, candidates: 881, translated: 856, bundle: 'chunk-ZSBPJAJ2.js' },
  { version: '1.1.0', previous: '1.0.2', history: 287, added: 3, candidates: 888, translated: 863, bundle: 'chunk-OIM2DMFI.js' },
  { version: '1.2.0', previous: '1.1.0', history: 288, added: 1, candidates: 889, translated: 864, bundle: 'chunk-TJXZSVTD.js', sdk: '14176c5f6a8ba9df57fb2bae52eebb1823b3bd96453200be52978715308ee9eb' },
  { version: '1.3.0', previous: '1.2.0', history: 289, added: 1, candidates: 892, translated: 867, bundle: 'chunk-66G7ITPS.js', sdk: '14176c5f6a8ba9df57fb2bae52eebb1823b3bd96453200be52978715308ee9eb' },
];
for (const { version, previous, history, added, candidates, translated, bundle, sdk = 'cfd718348caadc3b74df206e9af417afb9f409cdd7b508891eb7608c21fade80' } of versions) {
  test(`Pi ${version} is explicitly supported with its own reviewed uninstall entry`, () => {
    assert.doesNotThrow(() => requireVersion(catalog, version));
    for (const unknown of ['1.0.3', '1.0.4', '1.1.1', '1.2.1', '1.3.1', '1.4.0']) assert.throws(() => requireVersion(catalog, unknown), /未适配/);
    const release = catalog.versions[version];
    assert.equal(release.uiCandidates, candidates);
    assert.equal(release.uiTranslated, translated);
    assert.equal(release.completeUI, false);
    assert.equal(release.uninstallTargets['dist/core/package-manager.js'], sdk);
    assert.ok(release.uninstallTargets[`dist/bundle/chunks/${bundle}`]);
    const previousBundle = Object.keys(catalog.versions[previous].uninstallTargets).find(name => name.startsWith('dist/bundle/'));
    assert.equal(release.uninstallTargets[previousBundle], undefined);
  });
  test(`Pi ${version} includes every reviewed announcement and keeps ${previous} history intact`, () => {
    const source = readFileSync(`maintenance/${version}/history.source.md`, 'utf8');
    const approved = readFileSync(`maintenance/${version}/history.zh.md`, 'utf8');
    const map = bundledChangelog(catalog);
    assert.deepEqual(changelogCoverage(source, map), { total: history, translated: history, missing: [] });
    assert.equal(normalizeChangelog(renderChangelog(source, map)), normalizeChangelog(approved));
    const old = changelogEntries(readFileSync(`maintenance/${previous}/history.zh.md`, 'utf8'));
    const current = changelogEntries(approved);
    assert.equal(current[0].version, version);
    assert.deepEqual(current.slice(added).map(e => normalizeChangelog(e.source)), old.map(e => normalizeChangelog(e.source)));
  });
  test(`Pi ${version} UI resources preserve expressions, technical tokens and protocol examples`, () => {
    const ui = catalog.versions[version].ui;
    validateUI(ui);
    // A bare prose URL's trailing English full stop is punctuation, not URL data.
    const tokens = text => protectedValues(text).map(value => /^https?:\/\//.test(value) ? value.replace(/[.,;!?]+$/, '') : value).sort();
    for (const [source, target] of Object.entries(ui)) assert.deepEqual(tokens(target), tokens(source), source);
    assert.equal(ui['Copied URL to clipboard'], '已将 URL 复制到剪贴板');
    assert.equal(ui['  project override: @@PI_EXPR_0@@'], '  项目覆盖：@@PI_EXPR_0@@');
    for (const source of ['Bearer ${@@PI_EXPR_0@@}', '\\p{Cc}', '@@PI_EXPR_0@@ update --extensions']) assert.equal(ui[source], undefined);
    const help = Object.keys(ui).find(s => s.startsWith('@@PI_EXPR_0@@ - AI coding assistant'));
    for (const line of help.split('\n').filter(line => /^  (?:@@PI_EXPR_\d+@@ (?:auth print-|--|"|@|-p)|[A-Z][A-Z_]*\s+-)/.test(line))) {
      const prefix = line.split(/\s+-\s+/)[0];
      assert.ok(ui[help].includes(prefix), prefix);
    }
  });
}
test('Pi 1.1.0 help preserves new tool-selection flags and restart/status templates', () => {
  const ui = catalog.versions['1.1.0'].ui;
  const help = Object.keys(ui).find(s => s.startsWith('@@PI_EXPR_0@@ - AI coding assistant'));
  for (const token of ['+name/-name', '--tools +codemode', "--tools read,bash,codemode,'mcp__radius__*'", '--no-mcp', 'mcp__']) assert.ok(ui[help].includes(token), token);
  assert.equal(ui['Compacting context'], '正在压缩上下文');
  assert.equal(ui['Restart with `@@PI_EXPR_0@@` to continue this session.'], '请使用 `@@PI_EXPR_0@@` 重启以继续本次会话。');
  for (const version of ['1.0.3', '1.0.4', '1.1.0']) assert.ok(changelogEntries(readFileSync('maintenance/1.1.0/history.zh.md', 'utf8')).some(e => e.version === version));
});
test('Pi 1.2.0 UI preserves the revised cursor, resource and whole-login-timeout semantics', () => {
  const ui = catalog.versions['1.2.0'].ui;
  assert.equal(ui["Use the terminal cursor instead of Pi's drawn cursor"], '使用终端光标，而非 Pi 绘制的光标');
  assert.equal(ui['  offers resources'], '  提供资源');
  assert.equal(ui['cursor can only be used when a server is specified'], '只有指定服务器时才能使用 cursor');
  const help = Object.keys(ui).find(s => s.includes('Time limit for the whole sign-in (default: 300)'));
  assert.ok(help);
  assert.ok(ui[help].includes('--timeout <seconds>     整个登录过程的时间限制（默认：300）'));
  for (const obsolete of ['Use terminal cursor for IME support', '  @@PI_EXPR_0@@ resources · @@PI_EXPR_1@@ templates']) assert.equal(ui[obsolete], undefined);
});
test('Pi 1.3.0 sharing resources preserve targets, commands and read-range expressions', () => {
  const ui = catalog.versions['1.3.0'].ui;
  assert.equal(ui['Session share destination'], '会话分享目标');
  assert.equal(ui['Where to upload sessions with /share (auto prefers Radius when authenticated, otherwise GitHub Gist)'], '使用 /share 上传会话的目标（auto 在已认证时优先使用 Radius，否则使用 GitHub Gist）');
  assert.equal(ui["Radius authentication is not configured. Run '/login radius' first."], "尚未配置 Radius 认证。请先运行 '/login radius'。");
  assert.equal(ui['Share session via a Radius artifact or a GitHub gist'], '通过 Radius 产物或 GitHub gist 分享会话');
  for (const source of ['[read: @@PI_EXPR_0@@@@PI_EXPR_1@@]', '[read: @@PI_EXPR_0@@]', 'Share session as a secret GitHub gist', 'sessionShareDestination', 'auto', 'gist', 'radius']) assert.equal(ui[source], undefined);
  const current = readFileSync('maintenance/1.3.0/changelog.zh.md', 'utf8');
  for (const token of ['`sessionShareDestination`', '`auto`', '`gist`', '`radius`', '`/v1`', '`--tools +name`/`-name`', '`ctx.ui.custom({ overlay: true })`', '`done()`']) assert.ok(current.includes(token), token);
});
test('plugin minor and patch versions follow the reviewed Pi release pairing', () => {
  const latest = Object.keys(catalog.versions).map(v => v.split('.').map(Number)).sort((a, b) => b[0] - a[0] || b[1] - a[1] || b[2] - a[2])[0];
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.equal(pkg.version, `0.${6 + latest[1]}.${latest[1] === 0 ? latest[2] - 1 : latest[2]}`);
  assert.deepEqual(catalog.versions['1.0.2'].ui, catalog.versions['1.0.1'].ui);
  const current = readFileSync('maintenance/1.0.2/changelog.zh.md', 'utf8');
  for (const token of ['`samplingParamsByThinkingLevel`', '`models.json`', '`temperature`', '`top_p`']) assert.ok(current.includes(token));
});
