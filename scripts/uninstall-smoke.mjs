// Offline native uninstall integration. Only temporary Pi/package copies change.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, cpSync, symlinkSync, readFileSync, readdirSync, existsSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { Patcher } from '../lib/patcher.js';
import { hash, readJSON, writeJSON } from '../lib/storage.js';
import { linkPiDependencies } from './pi-fixture.mjs';

const original = resolve(process.argv[2] || process.env.PI_ZH_CN_ROOT || '');
if (!process.argv[2] && !process.env.PI_ZH_CN_ROOT) throw new Error('Specify the installed npm Pi directory');
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
    // Pi persists canonical local sources. Use that identity in either scope.
    if (scenario.kind === 'local') source = pkg;
    const settings = join(base, 'settings.json');
    writeJSON(settings, { packages: [source] });
    const { Patcher: InstalledPatcher } = await import(pathToFileURL(join(pkg, 'lib/patcher.js')));
    const p = new InstalledPatcher(root, join(agent, 'pi-zh-cn'));
    writeJSON(join(p.dataDir, 'config.json'), { enabled: true, chineseReplies: false });
    p.apply();
    const file = join(root, 'dist/modes/interactive/interactive-mode.js');
    const patched = readFileSync(file, 'utf8');
    if (scenario.conflict) writeFileSync(file, patched + '\n// external edit');
    const result = spawnSync(process.execPath, [join(root, 'dist/bundle/cli.js'), scenario.command, source, ...(scenario.local ? ['-l', '-a'] : [])], {
      cwd, encoding: 'utf8', timeout: 30000,
      env: { ...process.env, PI_ZH_CN_ROOT: root, PI_CODING_AGENT_DIR: agent, PI_OFFLINE: '1', PI_TELEMETRY: '0', npm_config_offline: 'true', npm_config_ignore_scripts: 'true', npm_config_audit: 'false', npm_config_fund: 'false' },
    });
    assert.equal(result.error, undefined);
    if (scenario.conflict) {
      assert.notEqual(result.status, 0, result.stdout);
      assert.match(result.stderr + result.stdout, /修改|恢复/);
      assert.ok(existsSync(pkg));
      assert.deepEqual(readJSON(settings, {}).packages, [source]);
      assert.equal(readFileSync(file, 'utf8'), patched + '\n// external edit');
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
    console.log(`Native ${scenario.command}: ${scenario.kind}${scenario.local ? ' project scope' : ''}${scenario.conflict ? ' conflict safely aborted' : ' restored and removed'} (${baseline.size} files verified)`);
  }
} finally { rmSync(temp, { recursive: true, force: true }); }
