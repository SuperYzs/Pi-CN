import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, symlinkSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';
import { spawnSync } from 'node:child_process';
import { discoverPi, Patcher } from '../lib/patcher.js';
import { writeJSON, readJSON } from '../lib/storage.js';

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'pi-cn-managed-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const agent = join(dir, 'agent'), install = join(agent, 'install');
  const bin = join(agent, 'bin'), launcher = join(bin, process.platform === 'win32' ? 'pi.cmd' : 'pi');
  mkdirSync(bin, { recursive: true });
  mkdirSync(install, { recursive: true });
  // Discovery must never execute or source the launcher.
  writeFileSync(launcher, `#!/bin/sh\ntouch '${join(dir, 'executed')}'\nexit 99\n`, { mode: 0o755 });
  writeJSON(join(install, 'managed-install.json'), { kind: 'pi-managed-install', schemaVersion: 1, layout: 'releases-v1' });
  const addRelease = version => {
    const root = join(install, 'releases', version, 'node_modules/@earendil-works/pi-coding-agent');
    mkdirSync(join(root, 'dist/modes/interactive'), { recursive: true });
    writeJSON(join(root, 'package.json'), { name: '@earendil-works/pi-coding-agent', version });
    writeFileSync(join(root, 'dist/modes/interactive/interactive-mode.js'), 'export class InteractiveMode { render(){return "Settings";} }');
    return realpathSync(root);
  };
  const root = addRelease('1.1.0');
  writeFileSync(join(install, 'current-version'), '1.1.0\n');
  const data = join(dir, 'data');
  const env = { ...process.env, PI_ZH_CN_ROOT: '', PI_CODING_AGENT_DIR: join(dir, 'config'), PATH: bin };
  const cli = (action, extra = {}, ...flags) => spawnSync(process.execPath, ['bin/pi-zh-cn.js', action, '--data-dir', data, ...flags], { env: { ...env, ...extra }, encoding: 'utf8', timeout: 30000 });
  return { dir, install, bin, launcher, root, data, cli, addRelease };
}

test('managed launcher discovery reads metadata without executing it, including a symlink entrypoint', t => {
  const f = fixture(t);
  assert.equal(discoverPi(f.launcher), f.root);
  const link = join(f.dir, 'pi-link');
  symlinkSync(f.launcher, link);
  assert.equal(discoverPi(link), f.root);
  const js = join(f.root, 'dist/modes/interactive/interactive-mode.js');
  assert.equal(discoverPi(js), f.root); // Running Pi resolves its own package, not a newer version pointer.
  assert.equal(existsSync(join(f.dir, 'executed')), false);
});

test('managed CLI selects only the pointed release and leaves older release files alone', t => {
  const f = fixture(t), older = f.addRelease('1.0.2');
  const oldFile = join(older, 'dist/modes/interactive/interactive-mode.js'), baseline = readFileSync(oldFile);
  const current = f.cli('status');
  assert.equal(current.status, 0, current.stderr);
  assert.equal(JSON.parse(current.stdout).root, f.root);
  writeFileSync(join(f.install, 'current-version'), '1.0.2\n');
  assert.equal(discoverPi(f.launcher), older);
  assert.equal(discoverPi(join(f.root, 'dist/modes/interactive/interactive-mode.js')), f.root);
  assert.deepEqual(readFileSync(oldFile), baseline);
});

test('managed discovery rejects invalid or missing metadata and unsafe version pointers', t => {
  const f = fixture(t), marker = join(f.install, 'managed-install.json');
  for (const value of [{}, { kind: 'pi-managed-install', schemaVersion: 2, layout: 'releases-v1' }, { kind: 'pi-managed-install', schemaVersion: 1, layout: 'other' }]) {
    writeJSON(marker, value);
    assert.throws(() => discoverPi(f.launcher), /安装标记/);
  }
  writeFileSync(marker, '{broken');
  assert.throws(() => discoverPi(f.launcher), SyntaxError);
  rmSync(marker);
  assert.throws(() => discoverPi(f.launcher), /安装标记/);
  writeJSON(marker, { kind: 'pi-managed-install', schemaVersion: 1, layout: 'releases-v1' });
  for (const value of ['../../outside', '1.1.0/../1.0.2', '', '1.1.0\n1.0.2']) {
    writeFileSync(join(f.install, 'current-version'), value);
    assert.throws(() => discoverPi(f.launcher), /版本指针/);
  }
});

test('managed discovery refuses missing releases, mismatched manifests and unsupported package identities', t => {
  const f = fixture(t);
  writeFileSync(join(f.install, 'current-version'), '1.1.1\n');
  assert.throws(() => discoverPi(f.launcher), /ENOENT/);
  writeFileSync(join(f.install, 'current-version'), '1.1.0\n');
  writeJSON(join(f.root, 'package.json'), { name: '@earendil-works/pi-coding-agent', version: '1.0.2' });
  assert.throws(() => discoverPi(f.launcher), /版本与指针/);
  writeJSON(join(f.root, 'package.json'), { name: 'another-package', version: '1.1.0' });
  assert.throws(() => discoverPi(f.launcher), /不是受支持/);
});

test('managed discovery rejects symlinked release directories and escaping package roots', t => {
  const f = fixture(t), release = join(f.install, 'releases/1.1.0');
  const moved = join(f.dir, 'outside-release');
  mkdirSync(moved);
  rmSync(release, { recursive: true });
  symlinkSync(moved, release, 'dir');
  assert.throws(() => discoverPi(f.launcher), /发布目录包含符号链接/);
  rmSync(release);
  f.addRelease('1.1.0');
  const outside = join(f.dir, 'outside-package');
  mkdirSync(join(outside, 'dist'), { recursive: true });
  writeJSON(join(outside, 'package.json'), { name: '@earendil-works/pi-coding-agent', version: '1.1.0' });
  rmSync(f.root, { recursive: true });
  symlinkSync(outside, f.root, 'dir');
  assert.throws(() => discoverPi(f.launcher), /目录或版本与指针/);
});

test('emergency CLI restores a managed installation from verified backups without an explicit root', t => {
  const f = fixture(t), source = join(f.root, 'dist/modes/interactive/interactive-mode.js');
  const baseline = readFileSync(source);
  const p = new Patcher(f.root, f.data, { catalog: { schema: 1, versions: { '1.1.0': { ui: {}, changelog: {} } } } });
  p.apply(); // An explicit test catalog; official host apply/uninstall is covered by smoke.
  assert.match(readFileSync(source, 'utf8'), /设置/);
  const result = f.cli('restore');
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(readFileSync(source), baseline);
  assert.equal(readJSON(join(f.data, 'config.json'), {}).enabled, false);
  assert.equal(existsSync(join(f.dir, 'executed')), false);
});

test('managed unknown versions remain unapproved and never write core files or preferences', t => {
  const f = fixture(t), root = f.addRelease('1.1.1');
  writeFileSync(join(f.install, 'current-version'), '1.1.1\n');
  const source = join(root, 'dist/modes/interactive/interactive-mode.js'), baseline = readFileSync(source);
  assert.equal(JSON.parse(f.cli('status').stdout).supported, false);
  const result = f.cli('apply');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /请先更新插件/);
  assert.deepEqual(readFileSync(source), baseline);
  assert.equal(existsSync(join(f.data, 'config.json')), false);
});

test('CLI never falls back to a secondary Pi install when the active managed launcher is broken', t => {
  const f = fixture(t), npmBin = join(f.root, 'bin');
  mkdirSync(npmBin);
  symlinkSync(join(f.root, 'dist/modes/interactive/interactive-mode.js'), join(npmBin, process.platform === 'win32' ? 'pi.cmd' : 'pi'));
  writeFileSync(join(f.install, 'current-version'), '../../outside');
  const result = f.cli('status', { PATH: `${f.bin}${delimiter}${npmBin}` });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /版本指针/);
  assert.equal(result.stdout, '');
});
