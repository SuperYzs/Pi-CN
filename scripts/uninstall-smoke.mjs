// Offline native uninstall integration. Only temporary Pi/package copies change.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, cpSync, symlinkSync, readFileSync, readdirSync, existsSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { Patcher } from '../lib/patcher.js';
import { hash, readJSON, writeJSON } from '../lib/storage.js';
import { linkPiDependencies } from './pi-fixture.mjs';

const original = resolve(process.argv[2] || process.env.PI_ZH_CN_ROOT || '');
if (!process.argv[2] && !process.env.PI_ZH_CN_ROOT) throw new Error('Specify the installed npm Pi directory');
const entry = process.argv[3] || 'bundle';
if (!['bundle', 'sdk'].includes(entry)) throw new Error('Specify bundle or sdk as the optional CLI entry');
const project = fileURLToPath(new URL('..', import.meta.url));
const temp = mkdtempSync(join(tmpdir(), 'pi-cn-native-uninstall-')), root = join(temp, 'pi');
try {
  mkdirSync(root);
  for (const name of ['dist', 'package.json', 'CHANGELOG.md']) cpSync(join(original, name), join(root, name), { recursive: true });
  linkPiDependencies(original, root);
  const upstream = new Patcher(original), state = upstream.state();
  for (const name of Object.keys(state.files)) if (existsSync(join(root, name))) writeFileSync(join(root, name), upstream.original(name, state));
  const baseline = new Map();
  function capture(directory) {
    for (const entry of readdirSync(join(root, directory), { withFileTypes: true })) {
      const name = join(directory, entry.name);
      if (entry.isDirectory()) capture(name);
      else if (entry.isFile()) baseline.set(name, hash(readFileSync(join(root, name))));
    }
  }
  capture('dist');
  for (const name of ['package.json', 'CHANGELOG.md']) baseline.set(name, hash(readFileSync(join(root, name))));
  function verifyRestored() { for (const [name, digest] of baseline) assert.equal(hash(readFileSync(join(root, name))), digest, name); }
  const cases = [
    { kind: 'local', command: 'uninstall' },
    { kind: 'git', command: 'uninstall' },
    { kind: 'npm', command: 'uninstall' },
    { kind: 'local', command: 'remove', local: true },
    { kind: 'git', command: 'uninstall', conflict: true },
    ...[false, true].flatMap(local => [false, true].flatMap(entry => ['uninstall', 'remove'].map(command => ({ kind: 'local', command, local, entry, relative: true })))),
    { kind: 'git', command: 'uninstall', manifest: 'missing' },
    { kind: 'local', command: 'remove', local: true, relative: true, manifest: 'corrupt' },
    { kind: 'git', command: 'uninstall', conflict: true, recordVersion: 'missing' },
    { kind: 'local', command: 'remove', local: true, relative: true, conflict: true, recordVersion: 'null' },
    { kind: 'npm', command: 'uninstall', conflict: true, recordVersion: 'invalid' },
    { kind: 'local', command: 'remove', local: true, relative: true, untrusted: true },
  ];
  for (let i = 0; i < cases.length; i++) {
    const scenario = cases[i], cwd = join(temp, `work-${i}`), agent = join(temp, `agent-${i}`);
    mkdirSync(cwd); mkdirSync(agent);
    const base = scenario.local ? join(cwd, '.pi') : agent;
    let pkg, source;
    if (scenario.kind === 'git') { pkg = join(base, 'git/github.com/SuperYzs/Pi-CN'); source = 'git:github.com/SuperYzs/Pi-CN'; }
    else if (scenario.kind === 'npm') { pkg = join(base, 'npm/node_modules/pi-zh-cn'); source = 'npm:pi-zh-cn'; }
    else { pkg = join(cwd, 'Pi-CN'); source = './Pi-CN'; }
    mkdirSync(pkg, { recursive: true });
    for (const name of ['lib', 'locales', 'extensions', 'package.json']) cpSync(join(project, name), join(pkg, name), { recursive: true });
    symlinkSync(join(project, 'node_modules'), join(pkg, 'node_modules'), 'dir');
    if (scenario.kind === 'npm') writeJSON(join(base, 'npm/package.json'), { name: 'smoke-install-root', private: true, dependencies: { 'pi-zh-cn': 'file:./node_modules/pi-zh-cn' } });
    const installed = scenario.entry ? join(pkg, 'extensions/index.ts') : pkg;
    const commandSource = scenario.kind === 'local' ? (scenario.relative ? `./Pi-CN${scenario.entry ? '/extensions/index.ts' : ''}` : installed) : source;
    // Persist local sources relative to their settings directory, like Pi itself.
    if (scenario.kind === 'local') source = relative(base, installed);
    const settings = join(base, 'settings.json');
    writeJSON(settings, { packages: [source] });
    const { Patcher: InstalledPatcher } = await import(pathToFileURL(join(pkg, 'lib/patcher.js')));
    const p = new InstalledPatcher(root, join(agent, 'pi-zh-cn'));
    writeJSON(join(p.dataDir, 'config.json'), { enabled: true, chineseReplies: false });
    p.apply();
    const file = join(root, 'dist/modes/interactive/interactive-mode.js');
    const patched = readFileSync(file, 'utf8');
    if (scenario.conflict) writeFileSync(file, patched + '\n// external edit');
    const stateFile = join(p.dir, 'state.json'), manifest = readFileSync(stateFile, 'utf8');
    if (scenario.manifest === 'missing') rmSync(stateFile);
    else if (scenario.manifest === 'corrupt') writeFileSync(stateFile, '{');
    if (scenario.recordVersion) {
      const state = JSON.parse(manifest), record = state.files['dist/modes/interactive/interactive-mode.js'];
      if (scenario.recordVersion === 'missing') delete record.version;
      else record.version = scenario.recordVersion === 'null' ? null : 'invalid';
      writeJSON(stateFile, state);
    }
    const failing = scenario.conflict || scenario.manifest || scenario.untrusted;
    const beforeFailure = failing
      ? new Map([...baseline.keys()].map(name => [name, hash(readFileSync(join(root, name)))])) : undefined;
    const result = spawnSync(process.execPath, [join(root, entry === 'sdk' ? 'dist/cli.js' : 'dist/bundle/cli.js'), scenario.command, commandSource, ...(scenario.local ? ['-l', scenario.untrusted ? '--no-approve' : '-a'] : [])], {
      cwd, encoding: 'utf8', timeout: 30000,
      env: { ...process.env, PI_ZH_CN_ROOT: root, PI_CODING_AGENT_DIR: agent, PI_OFFLINE: '1', PI_TELEMETRY: '0', npm_config_offline: 'true', npm_config_ignore_scripts: 'true', npm_config_audit: 'false', npm_config_fund: 'false' },
    });
    assert.equal(result.error, undefined);
    if (failing) {
      assert.notEqual(result.status, 0, result.stdout);
      assert.match(result.stderr + result.stdout, /修改|恢复|JSON|trust|approv/i);
      assert.ok(existsSync(pkg));
      assert.deepEqual(readJSON(settings, {}).packages, [source]);
      assert.equal(readFileSync(file, 'utf8'), patched + (scenario.conflict ? '\n// external edit' : ''));
      for (const [name, digest] of beforeFailure) assert.equal(hash(readFileSync(join(root, name))), digest, `Failed removal changed ${name}`);
      writeFileSync(stateFile, manifest);
      writeFileSync(file, patched); p.restore();
    } else {
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stderr, '');
      assert.deepEqual(readJSON(settings, {}).packages, []);
      assert.deepEqual(p.state().files, {});
      assert.equal(existsSync(pkg), scenario.kind === 'local');
    }
    assert.deepEqual(readJSON(join(p.dataDir, 'config.json'), {}), { enabled: true, chineseReplies: false });
    verifyRestored();
    console.log(`Native ${scenario.command}: ${scenario.kind}${scenario.local ? ' project scope' : ''}${scenario.relative ? ' relative input' : ''}${scenario.entry ? ' extension entry' : ''}${scenario.recordVersion ? ` ${scenario.recordVersion} record version` : ''}${scenario.untrusted ? ' untrusted project safely aborted' : scenario.conflict ? ' conflict safely aborted' : scenario.manifest ? ` ${scenario.manifest} manifest safely aborted` : ' restored and removed'} (${baseline.size} files verified)`);
  }
} finally { rmSync(temp, { recursive: true, force: true }); }
