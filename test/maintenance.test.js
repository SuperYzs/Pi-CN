import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { prepare, build, check, validateUI } from '../scripts/update-pi.mjs';
import { writeJSON, readJSON } from '../lib/storage.js';
import { Patcher } from '../lib/patcher.js';
import { isProjectRemote, updatePackage } from '../lib/update.js';

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'pi-cn-maint-'));
  const root = join(directory, 'upstream');
  const maintenance = join(directory, 'maintenance');
  const catalogFile = join(directory, 'releases.json');
  mkdirSync(join(root, 'dist/modes/interactive'), { recursive: true });
  writeJSON(join(root, 'package.json'), { name: '@earendil-works/pi-coding-agent', version: '2.0.0' });
  writeFileSync(join(root, 'dist/modes/interactive/interactive-mode.js'), 'class InteractiveMode { render(){return ["Settings", "Unknown display text"]} }');
  writeFileSync(join(root, 'CHANGELOG.md'), '# Changelog\n\n## [2.0.0] - 2026-10-02\n\n- Added `newAPI()` and /login.\n');
  writeJSON(catalogFile, { schema: 1, versions: {} });
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return { root, maintenance, catalogFile, directory };
}

test('maintenance prepares new upstream content without requiring runtime support', (t) => {
  const { root, maintenance } = fixture(t);
  const result = prepare(root, maintenance);
  assert.equal(result.version, '2.0.0');
  assert.equal(result.pending, 1);
  assert.equal(readJSON(join(result.directory, 'ui.pending.json'), [])[0].text, 'Unknown display text');
  assert.match(readFileSync(join(result.directory, 'changelog.source.md'), 'utf8'), /newAPI/);
});

test('build embeds reviewed UI and announcement for immediate offline use', (t) => {
  const { root, maintenance, catalogFile, directory } = fixture(t);
  const { directory: staged } = prepare(root, maintenance);
  writeJSON(join(staged, 'ui.zh.json'), { 'Unknown display text': '未知显示文本' });
  writeFileSync(join(staged, 'changelog.zh.md'), '## [2.0.0] - 2026-10-02\n\n- 新增 `newAPI()` 和 /login。\n');
  const result = build(root, { maintenanceDir: maintenance, catalogFile });
  assert.equal(result.translated, result.candidates);
  assert.deepEqual(check(catalogFile, maintenance), ['2.0.0']);
  const p = new Patcher(root, join(directory, 'backup'), { catalog: readJSON(catalogFile, {}) });
  p.apply();
  assert.match(readFileSync(join(root, 'CHANGELOG.md'), 'utf8'), /新增/);
  assert.match(readFileSync(join(root, 'dist/modes/interactive/interactive-mode.js'), 'utf8'), /未知显示文本/);
});

test('maintenance refuses unfinished UI unless explicitly marked partial', (t) => {
  const { root, maintenance, catalogFile } = fixture(t);
  prepare(root, maintenance);
  assert.throws(() => build(root, { maintenanceDir: maintenance, catalogFile }), /未维护/);
});

test('compiler rejects executable expression changes and blank translations', () => {
  assert.throws(() => validateUI({ 'Value @@PI_EXPR_0@@': '值' }), /标记/);
  assert.throws(() => validateUI({ 'Value': '' }), /为空/);
  assert.doesNotThrow(() => validateUI({ 'Value @@PI_EXPR_0@@': '值 @@PI_EXPR_0@@' }));
});

test('compiler refuses stale source snapshots rather than translating at runtime', (t) => {
  const { root, maintenance, catalogFile } = fixture(t);
  const { directory } = prepare(root, maintenance);
  writeJSON(join(directory, 'ui.zh.json'), { 'Unknown display text': '未知显示文本' });
  writeFileSync(join(root, 'CHANGELOG.md'), '## [2.0.0] - 2026-10-02\n\n- Changed upstream.\n');
  assert.throws(() => build(root, { maintenanceDir: maintenance, catalogFile }), /上游公告已变化/);
});

test('repository matching accepts only the requested GitHub repository', () => {
  for (const remote of ['https://github.com/SuperYzs/Pi-CN.git', 'git@github.com:SuperYzs/Pi-CN.git', 'ssh://git@github.com/SuperYzs/Pi-CN', 'ssh://git@ssh.github.com:443/SuperYzs/Pi-CN.git']) assert.equal(isProjectRemote(remote), true);
  for (const remote of ['https://github.com/Someone/Pi-CN', 'https://evil.test/SuperYzs/Pi-CN', 'https://token@github.com/SuperYzs/Pi-CN', 'https://github.com/SuperYzs/Pi-CN-malicious', 'ssh://git@ssh.github.com:443/Other/Pi-CN.git']) assert.equal(isProjectRemote(remote), false);
});

function gitExecutor({ remote = 'https://github.com/SuperYzs/Pi-CN.git', dirty = '', branch = 'main' } = {}) {
  const calls = [];
  let pulled = false;
  return { calls, exec: async (command, argv, options) => {
    assert.equal(command, 'git');
    assert.equal(options.timeout, 120000);
    const args = argv.slice(2);
    calls.push(args);
    let stdout = '';
    if (args.join(' ') === 'rev-parse --show-toplevel') stdout = '/project';
    else if (args[0] === 'remote') stdout = remote;
    else if (args[0] === 'status') stdout = dirty;
    else if (args[0] === 'branch') stdout = branch;
    else if (args.join(' ') === 'rev-parse HEAD') stdout = pulled ? 'new-head' : 'old-head';
    else if (args[0] === 'pull') pulled = true;
    else throw new Error('unexpected git invocation');
    return { code: 0, stdout, stderr: '' };
  } };
}

test('explicit plugin update fast-forwards only origin/main and never calls a model', async () => {
  const git = gitExecutor();
  assert.deepEqual(await updatePackage('/project', git.exec), { updated: true, commit: 'new-head' });
  assert.ok(git.calls.some((args) => JSON.stringify(args) === JSON.stringify(['pull', '--ff-only', 'origin', 'main'])));
  assert.equal(git.calls.some((args) => args.includes('--force')), false);
});

test('updates refuse dirty trees, wrong remotes and fixed/foreign branches', async () => {
  for (const options of [{ dirty: ' M README.md' }, { remote: 'https://github.com/Other/repo.git' }, { branch: '' }, { branch: 'feature' }]) {
    const git = gitExecutor(options);
    await assert.rejects(updatePackage('/project', git.exec));
    assert.equal(git.calls.some((args) => args[0] === 'pull'), false);
  }
});
