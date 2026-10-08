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
];
for (const { version, previous, history, added, candidates, translated, bundle } of versions) {
  test(`Pi ${version} is explicitly supported with its own reviewed uninstall entry`, () => {
    assert.doesNotThrow(() => requireVersion(catalog, version));
    for (const unknown of ['1.0.3', '1.0.4', '1.1.1']) assert.throws(() => requireVersion(catalog, unknown), /未适配/);
    const release = catalog.versions[version];
    assert.equal(release.uiCandidates, candidates);
    assert.equal(release.uiTranslated, translated);
    assert.equal(release.completeUI, false);
    assert.equal(release.uninstallTargets['dist/core/package-manager.js'], catalog.versions['1.0.0'].uninstallTargets['dist/core/package-manager.js']);
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
test('plugin minor and patch versions follow the reviewed Pi release pairing', () => {
  const latest = Object.keys(catalog.versions).map(v => v.split('.').map(Number)).sort((a, b) => b[0] - a[0] || b[1] - a[1] || b[2] - a[2])[0];
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.equal(pkg.version, `0.${6 + latest[1]}.${latest[1] === 0 ? latest[2] - 1 : latest[2]}`);
  assert.deepEqual(catalog.versions['1.0.2'].ui, catalog.versions['1.0.1'].ui);
  const current = readFileSync('maintenance/1.0.2/changelog.zh.md', 'utf8');
  for (const token of ['`samplingParamsByThinkingLevel`', '`models.json`', '`temperature`', '`top_p`']) assert.ok(current.includes(token));
});
