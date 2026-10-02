import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const text = (path) => readFileSync(path, 'utf8');

test('English is the default and Chinese guides have reciprocal links and equivalent commands', () => {
  const english = text('README.md'), chinese = text('README.zh-CN.md');
  for (const heading of ['Requirements', 'Installation', 'Usage', 'Updating', 'Coverage', 'Uninstalling', 'Recovery']) assert.ok(english.includes(`## ${heading}`));
  assert.match(english, /\[简体中文\]\(README\.zh-CN\.md\)/);
  assert.match(chinese, /\[English\]\(README\.md\)/);
  const commands = (document) => [...document.matchAll(/```bash\n([\s\S]*?)\n```/g)].map((match) => match[1]);
  assert.deepEqual(commands(english), commands(chinese));
  for (const doc of [english, chinese]) {
    for (const command of ['/zh-cn', '/zh-cn toggle', '/zh-cn replies', '/zh-cn update', '/changelog']) assert.ok(doc.includes(command));
    assert.ok(doc.includes('282')); assert.ok(doc.includes('1.0.0'));
    assert.ok(doc.includes('pi uninstall git:github.com/SuperYzs/Pi-CN'));
    assert.ok(doc.includes('pi remove'));
  }
  assert.match(english, /You do not need to turn localization off first/);
  assert.match(chinese, /不需要先关闭汉化/);
});
test('bilingual changelogs have matching versions and current release metadata', () => {
  const versions = (path) => [...text(path).matchAll(/^## ([\d.]+)$/gm)].map((match) => match[1]);
  assert.deepEqual(versions('CHANGELOG.md'), versions('CHANGELOG.zh-CN.md'));
  const pkg = JSON.parse(text('package.json'));
  assert.equal(versions('CHANGELOG.md')[0], pkg.version);
  assert.ok(pkg.keywords.includes('pi-package'));
  assert.deepEqual(pkg.pi.extensions, ['./extensions/index.ts']);
  assert.equal(pkg.repository.url, 'git+https://github.com/SuperYzs/Pi-CN.git');
  assert.doesNotMatch(pkg.description, /[\u3400-\u9fff]/);
});
test('user-facing markdown links point to present repository files', () => {
  for (const path of ['README.md', 'README.zh-CN.md', 'CHANGELOG.md', 'CHANGELOG.zh-CN.md', 'CONTRIBUTING.md']) {
    for (const [, target] of text(path).matchAll(/\]\(([^)]+)\)/g)) {
      if (/^(?:https?:|#)/.test(target)) continue;
      assert.ok(existsSync(resolve(target.split('#')[0])), `${path}: ${target}`);
    }
  }
  assert.ok(existsSync('.github/ISSUE_TEMPLATE/bug_report.yml'));
  assert.ok(existsSync('.github/ISSUE_TEMPLATE/feature_request.yml'));
});
test('published tarball includes bilingual user docs and recovery code, not private or maintenance data', () => {
  const result = spawnSync('npm', ['pack', '--dry-run', '--ignore-scripts', '--json'], { encoding: 'utf8', timeout: 30000 });
  assert.equal(result.status, 0, result.stderr);
  const packed = JSON.parse(result.stdout), entry = Array.isArray(packed) ? packed[0] : packed['pi-zh-cn'];
  const files = entry.files.map(({ path }) => path);
  for (const path of ['README.md', 'README.zh-CN.md', 'CHANGELOG.md', 'CHANGELOG.zh-CN.md', 'lib/recovery.js', 'lib/uninstall-patch.js', 'lib/worker.js', 'lib/patch-worker.js']) assert.ok(files.includes(path), path);
  for (const path of files) assert.doesNotMatch(path, /(?:AGENTS\.md|maintenance\/|test\/|scripts\/|node_modules\/|auth\.json|config\.json|state\.json|prepared\.json|originals\/|\.tgz$)/);
});
