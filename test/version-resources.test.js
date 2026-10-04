import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadCatalog, bundledChangelog, requireVersion } from '../lib/releases.js';
import { changelogCoverage, changelogEntries, normalizeChangelog, protectedValues, renderChangelog } from '../lib/changelog.js';
import { validateUI } from '../scripts/update-pi.mjs';

const catalog = loadCatalog();
test('Pi 1.0.1 is explicitly supported without accepting an unreviewed newer release', () => {
  assert.doesNotThrow(() => requireVersion(catalog, '1.0.0'));
  assert.doesNotThrow(() => requireVersion(catalog, '1.0.1'));
  assert.throws(() => requireVersion(catalog, '1.0.2'), /未适配/);
  const release = catalog.versions['1.0.1'];
  assert.equal(release.uiCandidates, 881);
  assert.equal(release.uiTranslated, 856);
  assert.equal(release.completeUI, false);
  assert.equal(release.uninstallTargets['dist/core/package-manager.js'], catalog.versions['1.0.0'].uninstallTargets['dist/core/package-manager.js']);
  assert.ok(release.uninstallTargets['dist/bundle/chunks/chunk-5OEJBNHG.js']);
  assert.equal(release.uninstallTargets['dist/bundle/chunks/chunk-33XOIQ5N.js'], undefined);
});
test('Pi 1.0.1 includes reviewed Chinese for every release and keeps the old history intact', () => {
  const source = readFileSync('maintenance/1.0.1/history.source.md', 'utf8');
  const approved = readFileSync('maintenance/1.0.1/history.zh.md', 'utf8');
  const map = bundledChangelog(catalog);
  assert.deepEqual(changelogCoverage(source, map), { total: 283, translated: 283, missing: [] });
  assert.equal(normalizeChangelog(renderChangelog(source, map)), normalizeChangelog(approved));
  const old = changelogEntries(readFileSync('maintenance/1.0.0/history.zh.md', 'utf8'));
  const current = changelogEntries(approved);
  assert.equal(current[0].version, '1.0.1');
  assert.deepEqual(current.slice(1).map(e => normalizeChangelog(e.source)), old.map(e => normalizeChangelog(e.source)));
});
test('new UI resources preserve expressions, technical tokens and literal protocol examples', () => {
  const ui = catalog.versions['1.0.1'].ui;
  validateUI(ui);
  // Bare prose URLs can be followed by an English full stop, not part of the URL.
  const tokens = text => protectedValues(text).map(value => /^https?:\/\//.test(value) ? value.replace(/[.,;!?]+$/, '') : value).sort();
  for (const [source, target] of Object.entries(ui)) {
    assert.deepEqual(tokens(target), tokens(source), source);
  }
  assert.equal(ui['Copied URL to clipboard'], '已将 URL 复制到剪贴板');
  assert.equal(ui['  project override: @@PI_EXPR_0@@'], '  项目覆盖：@@PI_EXPR_0@@');
  assert.equal(ui['Bearer ${@@PI_EXPR_0@@}'], undefined);
  assert.equal(ui['\\p{Cc}'], undefined);
  assert.equal(ui['@@PI_EXPR_0@@ update --extensions'], undefined);
  const help = Object.keys(ui).find(s => s.startsWith('@@PI_EXPR_0@@ - AI coding assistant'));
  for (const line of help.split('\n').filter(line => /^  (?:@@PI_EXPR_\d+@@ (?:auth print-|--|"|@|-p)|[A-Z][A-Z_]*\s+-)/.test(line))) {
    const prefix = line.split(/\s+-\s+/)[0];
    assert.ok(ui[help].includes(prefix), prefix);
  }
});
