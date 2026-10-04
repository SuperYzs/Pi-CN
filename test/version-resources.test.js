import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadCatalog, bundledChangelog, requireVersion } from '../lib/releases.js';
import { changelogCoverage, changelogEntries, normalizeChangelog, protectedValues, renderChangelog } from '../lib/changelog.js';
import { validateUI } from '../scripts/update-pi.mjs';

const catalog = loadCatalog();
const versions = [
  { version: '1.0.1', previous: '1.0.0', history: 283, bundle: 'chunk-5OEJBNHG.js' },
  { version: '1.0.2', previous: '1.0.1', history: 284, bundle: 'chunk-ZSBPJAJ2.js' },
];
for (const { version, previous, history, bundle } of versions) {
  test(`Pi ${version} is explicitly supported with its own reviewed uninstall entry`, () => {
    assert.doesNotThrow(() => requireVersion(catalog, version));
    assert.throws(() => requireVersion(catalog, '1.0.3'), /未适配/);
    const release = catalog.versions[version];
    assert.equal(release.uiCandidates, 881);
    assert.equal(release.uiTranslated, 856);
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
    assert.deepEqual(current.slice(1).map(e => normalizeChangelog(e.source)), old.map(e => normalizeChangelog(e.source)));
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
test('plugin patch version follows the supported Pi 1.0.x patch increment', () => {
  const latestPatch = Math.max(...Object.keys(catalog.versions).filter(v => /^1\.0\.\d+$/.test(v)).map(v => Number(v.split('.')[2])));
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.equal(pkg.version, `0.6.${latestPatch - 1}`);
  assert.deepEqual(catalog.versions['1.0.2'].ui, catalog.versions['1.0.1'].ui);
  const current = readFileSync('maintenance/1.0.2/changelog.zh.md', 'utf8');
  for (const token of ['`samplingParamsByThinkingLevel`', '`models.json`', '`temperature`', '`top_p`']) assert.ok(current.includes(token));
});
