import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hash } from '../lib/storage.js';
import { changelogEntries, normalizeChangelog, renderChangelog, changelogCoverage } from '../lib/changelog.js';
import { bundledChangelog, loadCatalog } from '../lib/releases.js';
import { compileChangelog } from '../scripts/update-pi.mjs';

const source = '# Changelog\n\n## [1.0.0] - 2026-10-01\n\n### Added\n\n- Added `newAPI()` in [Docs](docs/api.md) for CLI.\n\n```md\n## [9.0.0] - 2099-01-01\n### Added\n```\n\n## [0.9.0] - 2026-09-01\n\n### Fixed\n\n- Fixed /login for MCP.\n';
const chinese = source.replace('# Changelog', '# 更新公告')
  .replace('### Added\n\n- Added', '### 新增\n\n- 新增')
  .replace('in [Docs]', '参见[文档]').replace('for CLI.', '适用于 CLI。')
  .replace('### Fixed', '### 修复').replace('- Fixed /login for MCP.', '- 修复 MCP 的 /login。');
function translations() {
  const compiled = compileChangelog(source, chinese);
  return bundledChangelog({ versions: { '1.0.0': compiled } });
}

test('fenced example version headers are not parsed as release entries', () => {
  assert.deepEqual(changelogEntries(source).map(({ version }) => version), ['1.0.0', '0.9.0']);
  const rendered = renderChangelog(source, translations());
  assert.ok(rendered.includes('```md\n## [9.0.0] - 2099-01-01\n### Added\n```'));
});

test('all historical entries and technical content are compiled and localized', () => {
  const map = translations();
  assert.deepEqual(changelogCoverage(source, map), { total: 2, translated: 2, missing: [] });
  const rendered = renderChangelog(source, map);
  assert.match(rendered, /新增 `newAPI\(\)`/);
  assert.match(rendered, /修复 MCP 的 \/login/);
  assert.ok(rendered.includes('(docs/api.md)'));
});

test('prior heading-only localization and CRLF do not make complete translations miss', () => {
  const variant = source.replace('# Changelog', '# 更新公告').replace('### Fixed', '### 修复')
    .replace('### Added\n\n- Added', '### 新增\n\n- Added').replaceAll('\n', '\r\n');
  assert.deepEqual(changelogCoverage(variant, translations()), { total: 2, translated: 2, missing: [] });
  const rendered = renderChangelog(variant, translations());
  assert.match(rendered, /修复 MCP 的 \/login/);
  assert.ok(rendered.includes('```md\r\n## [9.0.0] - 2099-01-01\r\n### Added\r\n```'));
});

test('a changed announcement body does not silently receive a stale version translation', () => {
  const changed = source.replace('Added `newAPI()`', 'Added `otherAPI()`');
  assert.deepEqual(changelogCoverage(changed, translations()).missing, ['1.0.0']);
  const rendered = renderChangelog(changed, translations());
  assert.ok(rendered.includes('otherAPI()'));
  assert.ok(!rendered.includes('newAPI()'));
});

test('history compilation rejects missing entries, untranslated prose and altered links', () => {
  assert.throws(() => compileChangelog(source, chinese.slice(0, chinese.indexOf('## [0.9.0]'))), /缺少版本/);
  assert.throws(() => compileChangelog(source, source.replace('### Fixed', '### 修复').replace('### Added', '### 新增')), /正文尚未汉化/);
  assert.throws(() => compileChangelog(source, chinese.replace('docs/api.md', 'docs/other.md')), /链接/);
});

test('empty upstream releases preserve their date and are counted without inventing prose', () => {
  const empty = '## [0.80.5] - 2026-07-09\n\n';
  const compiled = compileChangelog(empty, empty);
  const map = bundledChangelog({ versions: { '1.0.0': compiled } });
  assert.equal(renderChangelog(empty, map), empty);
  assert.deepEqual(changelogCoverage(empty, map), { total: 1, translated: 1, missing: [] });
});

test('canonicalization changes headings and whitespace only, not code or actual prose', () => {
  const normalized = normalizeChangelog(chinese);
  assert.ok(normalized.includes('### Fixed'));
  assert.ok(normalized.includes('新增 `newAPI()`'));
  assert.ok(normalized.includes('```md\n## [9.0.0] - 2099-01-01\n### Added\n```'));
});

test('published full history covers every source entry with reviewed Chinese and safe aliases', () => {
  const catalog = loadCatalog();
  const release = catalog.versions['1.0.0'];
  assert.equal(release.completeChangelog, true);
  const source = readFileSync('maintenance/1.0.0/history.source.md', 'utf8');
  const approved = readFileSync('maintenance/1.0.0/history.zh.md', 'utf8');
  const entries = changelogEntries(source);
  assert.equal(entries.length, 282);
  assert.equal(release.changelogEntries, entries.length);
  assert.deepEqual(changelogCoverage(source, bundledChangelog(catalog)), { total: 282, translated: 282, missing: [] });
  const rendered = renderChangelog(source, bundledChangelog(catalog));
  assert.equal(hash(normalizeChangelog(rendered)), hash(normalizeChangelog(approved)));
});
