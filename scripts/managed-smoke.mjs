// Exercise only a disposable managed installation, never the user's release.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, cpSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { discoverPi, Patcher } from '../lib/patcher.js';
import { hash, writeJSON, readJSON } from '../lib/storage.js';
import { linkPiDependencies } from './pi-fixture.mjs';

if (!process.argv[2]) throw new Error('Usage: managed-smoke.mjs <official Pi root>');
const original = resolve(process.argv[2]);
const version = readJSON(join(original, 'package.json'), {}).version;
assert.match(version, /^\d+\.\d+\.\d+$/);
const project = resolve(fileURLToPath(new URL('..', import.meta.url)));
const temp = mkdtempSync(join(tmpdir(), 'pi-cn-managed-smoke-'));
const agent = join(temp, 'agent'), install = join(agent, 'install');
const release = join(install, 'releases', version);
const root = join(release, 'node_modules/@earendil-works/pi-coding-agent');
const bin = join(agent, 'bin'), launcher = join(bin, process.platform === 'win32' ? 'pi.cmd' : 'pi');
const data = join(agent, 'pi-zh-cn'), config = join(data, 'config.json');
try {
  mkdirSync(root, { recursive: true });
  for (const name of ['dist', 'package.json', 'CHANGELOG.md']) cpSync(join(original, name), join(root, name), { recursive: true });
  linkPiDependencies(original, root);
  mkdirSync(bin, { recursive: true });
  writeJSON(join(install, 'managed-install.json'), { kind: 'pi-managed-install', schemaVersion: 1, layout: 'releases-v1' });
  writeFileSync(join(install, 'current-version'), `${version}\n`);
  const js = join(root, 'dist/bundle/cli.js');
  const shellQuote = text => `'${text.replaceAll("'", "'\\''")}'`;
  const command = process.platform === 'win32'
    ? `@echo off\r\nset "PI_MANAGED_INSTALL_ROOT=${install}"\r\n"${process.execPath}" "${js}" %*\r\n`
    : `#!/bin/sh\nset -eu\nexport PI_MANAGED_INSTALL_ROOT=${shellQuote(install)}\nexec ${shellQuote(process.execPath)} ${shellQuote(js)} "$@"\n`;
  writeFileSync(launcher, command, { mode: 0o755 });
  const retained = join(install, 'releases', 'retained-release.txt');
  writeFileSync(retained, 'A retained previous release must not be touched.\n');
  const capture = () => {
    const files = new Map();
    const walk = directory => {
      for (const entry of readdirSync(join(root, directory), { withFileTypes: true })) {
        const name = join(directory, entry.name);
        if (entry.isDirectory()) walk(name);
        else if (entry.isFile()) files.set(name, hash(readFileSync(join(root, name))));
      }
    };
    walk('dist');
    for (const name of ['package.json', 'CHANGELOG.md']) files.set(name, hash(readFileSync(join(root, name))));
    return files;
  };
  const baseline = capture(), sentinel = readFileSync(retained);
  const env = { ...process.env, PATH: `${bin}${delimiter}${process.env.PATH || ''}`, PI_ZH_CN_ROOT: '', PI_CODING_AGENT_DIR: agent, PI_TELEMETRY: '0', PI_OFFLINE: '1' };
  const run = (executable, args) => {
    const result = spawnSync(executable, args, { cwd: temp, env, encoding: 'utf8', timeout: 60000 });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, '');
    return result.stdout;
  };
  const emergency = action => run(process.execPath, [join(project, 'bin/pi-zh-cn.js'), action]);
  const pi = args => process.platform === 'win32'
    ? run(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `""${launcher}" ${args.map(a => `"${a}"`).join(' ')}"`])
    : run(launcher, args);
  assert.equal(discoverPi(launcher), root);
  const status = JSON.parse(emergency('status'));
  assert.equal(status.root, root);
  assert.equal(status.version, version);
  const applied = JSON.parse(emergency('apply').split('\n操作完成')[0]);
  assert.ok(applied.changedFiles > 0);
  const p = new Patcher(root, data);
  assert.equal((await p.runAsync('apply')).changedFiles, 0);
  assert.equal(pi(['--version']).trim(), version);
  assert.match(pi(['--offline', '-na', '-ne', '-ns', '-np', '--no-themes', '-nc', '--help']), /用法：/);
  emergency('restore');
  assert.deepEqual(capture(), baseline);
  assert.equal(readJSON(config, {}).enabled, false);
  // Native uninstall uses the actual local source and the managed launcher.
  pi(['install', project]);
  const sources = () => readJSON(join(agent, 'settings.json'), {}).packages.map(entry => typeof entry === 'string' ? entry : entry.source);
  const installedSource = sources().find(source => resolve(agent, source) === project);
  assert.ok(installedSource, 'Native install must register the local source');
  emergency('apply');
  const preferences = readFileSync(config);
  pi(['uninstall', project]);
  assert.deepEqual(capture(), baseline);
  assert.deepEqual(readFileSync(config), preferences);
  assert.equal(sources().some(source => resolve(agent, source) === project), false);
  assert.equal(Object.keys(p.state().files).length, 0);
  assert.deepEqual(readFileSync(retained), sentinel);
  console.log(`Managed Pi ${version}: launcher discovery, emergency apply/restore, worker cache, native uninstall, preferences and ${baseline.size} exact file hashes verified.`);
} finally {
  rmSync(temp, { recursive: true, force: true });
}
