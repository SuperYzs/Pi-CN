import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { Patcher } from '../lib/patcher.js';
import { hash, writeJSON } from '../lib/storage.js';
import { insertUninstallHook } from '../lib/uninstall-patch.js';
import { loadCatalog } from '../lib/releases.js';

const managerSource = `export class DefaultPackageManager {
  parseSource(source) { return source; }
  getInstalledPath(source, scope) { this.scopes.push(scope); return this.paths[source]; }
  assertProjectTrustedForScope(scope) { if (this.untrusted && scope === 'project') throw new Error('untrusted'); }
  async remove(source, options) {
    const parsed = this.parseSource(source);
    const scope = options?.local ? 'project' : 'user';
    this.assertProjectTrustedForScope(scope);
    await this.actualRemoval(parsed, scope);
  }
  async removeAndPersist(source, options) { await this.remove(source, options); this.removed.push(source); }
}`;
function fixture(t, source = managerSource) {
  const temp = mkdtempSync(join(tmpdir(), 'pi-cn-uninstall-'));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const root = join(temp, 'pi'), data = join(temp, 'data');
  mkdirSync(join(root, 'dist/core'), { recursive: true });
  mkdirSync(join(root, 'dist/modes/interactive'), { recursive: true });
  writeJSON(join(root, 'package.json'), { name: '@earendil-works/pi-coding-agent', version: '1.0.0', type: 'module' });
  const file = join(root, 'dist/core/package-manager.js');
  const ui = join(root, 'dist/modes/interactive/view.js');
  writeFileSync(file, source);
  writeFileSync(ui, 'class InteractiveMode {render(){return "Settings"}}');
  const catalog = { schema: 1, versions: { '1.0.0': { ui: {}, changelog: {}, uninstallTargets: { 'dist/core/package-manager.js': hash(source) } } } };
  const p = new Patcher(root, data, { catalog });
  return { root, data, file, ui, p, source };
}
async function manager(f, paths) {
  const { DefaultPackageManager } = await import(pathToFileURL(f.file));
  const m = new DefaultPackageManager();
  m.paths = paths; m.scopes = []; m.removed = []; m.actualRemoval = async () => {};
  return m;
}
for (const [source, local] of [['git:github.com/SuperYzs/Pi-CN', false], ['npm:pi-zh-cn', false], ['./Pi-CN', true]]) {
  test(`native removal restores before deleting ${source} without changing the switch`, async (t) => {
    const f = fixture(t);
    writeJSON(join(f.data, 'config.json'), { enabled: true, chineseReplies: false });
    const config = readFileSync(join(f.data, 'config.json'), 'utf8');
    f.p.apply();
    const m = await manager(f, { [source]: f.p.recoveryContext().packageRoot });
    let called = false;
    m.actualRemoval = async () => {
      called = true;
      assert.equal(readFileSync(f.file, 'utf8'), f.source);
      assert.match(readFileSync(f.ui, 'utf8'), /Settings/);
      assert.deepEqual(f.p.state().files, {});
    };
    await m.removeAndPersist(source, { local });
    assert.equal(called, true);
    assert.deepEqual(m.removed, [source]);
    assert.deepEqual(m.scopes, [local ? 'project' : 'user']);
    assert.equal(readFileSync(join(f.data, 'config.json'), 'utf8'), config);
  });
}
test('removing the explicitly installed extension file also recovers the parent package patches', async (t) => {
  const f = fixture(t); f.p.apply();
  const entry = join(f.p.recoveryContext().packageRoot, 'extensions/index.ts');
  const m = await manager(f, { self: entry });
  await m.removeAndPersist('self');
  assert.deepEqual(f.p.state().files, {});
  assert.match(readFileSync(f.ui, 'utf8'), /Settings/);
});
test('a later package-manager failure keeps backups and preferences available', async (t) => {
  const f = fixture(t); f.p.apply();
  const m = await manager(f, { self: f.p.recoveryContext().packageRoot });
  m.actualRemoval = async () => { throw new Error('package removal failed'); };
  await assert.rejects(m.removeAndPersist('self'), /package removal failed/);
  assert.deepEqual(m.removed, []);
  assert.deepEqual(f.p.state().files, {});
  assert.ok(existsSync(join(f.p.dir, 'originals')));
  assert.equal(f.p.apply().changedFiles, 2);
});
test('unrelated package removal leaves localization and recovery records intact', async (t) => {
  const f = fixture(t); f.p.apply();
  const before = JSON.stringify(f.p.state());
  const m = await manager(f, { other: f.root });
  await m.removeAndPersist('other');
  assert.match(readFileSync(f.ui, 'utf8'), /设置/);
  assert.equal(JSON.stringify(f.p.state()), before);
});
test('missing recovery files do not break unrelated package removal', async (t) => {
  const f = fixture(t); f.p.apply();
  rmSync(join(f.p.dir, 'recovery'), { recursive: true });
  const m = await manager(f, { other: f.root });
  await m.removeAndPersist('other');
  assert.deepEqual(m.removed, ['other']);
  assert.match(readFileSync(f.ui, 'utf8'), /设置/);
});
test('missing recovery files abort self-uninstall rather than deleting the only recovery tool', async (t) => {
  const f = fixture(t); f.p.apply();
  rmSync(join(f.p.dir, 'recovery'), { recursive: true });
  const m = await manager(f, { self: f.p.recoveryContext().packageRoot });
  await assert.rejects(m.removeAndPersist('self'), /Cannot find module/);
  assert.deepEqual(m.removed, []);
  assert.match(readFileSync(f.ui, 'utf8'), /设置/);
});
test('untrusted project removal fails before recovery or package deletion', async (t) => {
  const f = fixture(t); f.p.apply();
  const m = await manager(f, { self: f.p.recoveryContext().packageRoot });
  m.untrusted = true;
  await assert.rejects(m.removeAndPersist('self', { local: true }), /untrusted/);
  assert.deepEqual(m.scopes, []); assert.deepEqual(m.removed, []);
  assert.match(readFileSync(f.ui, 'utf8'), /设置/);
});
for (const failure of ['external edit', 'backup corruption', 'lock']) {
  test(`${failure} aborts native uninstall without changing settings or deleting the package`, async (t) => {
    const f = fixture(t); f.p.apply();
    const m = await manager(f, { self: f.p.recoveryContext().packageRoot });
    let called = false; m.actualRemoval = async () => { called = true; };
    if (failure === 'external edit') writeFileSync(f.ui, 'external edit');
    if (failure === 'backup corruption') {
      const record = f.p.state().files['dist/modes/interactive/view.js'];
      writeFileSync(join(f.p.dir, 'originals', record.originalHash + '.txt'), 'corrupt');
    }
    if (failure === 'lock') mkdirSync(join(f.p.dir, 'lock'));
    try { await assert.rejects(m.removeAndPersist('self'), /修改|损坏|另一个汉化操作/); }
    finally { if (failure === 'lock') rmSync(join(f.p.dir, 'lock'), { recursive: true }); }
    assert.equal(called, false); assert.deepEqual(m.removed, []);
    assert.ok(readFileSync(f.file, 'utf8').includes('native uninstall recovery'));
  });
}
test('recovery capsule has only local built-in dependencies and is recreated for cached apply', (t) => {
  const f = fixture(t); f.p.apply();
  const directory = join(f.p.dir, 'recovery');
  assert.ok(existsSync(join(directory, 'runtime.mjs')));
  const runtime = readFileSync(join(directory, 'runtime.mjs'), 'utf8');
  assert.doesNotMatch(runtime, /acorn|locales|patcher\.js|node_modules/);
  rmSync(directory, { recursive: true });
  assert.equal(f.p.apply().cacheHit, true);
  assert.ok(existsSync(join(directory, 'storage.mjs')));
});
test('a changed same-version uninstall implementation is refused before any patch', (t) => {
  const f = fixture(t); writeFileSync(f.file, f.source + '\n// unknown host change');
  assert.throws(() => f.p.apply(), /卸载入口内容未适配/);
  assert.deepEqual(f.p.state().files, {});
  assert.match(readFileSync(f.ui, 'utf8'), /Settings/);
});
test('reviewed hash variants are accepted but an unknown third variant is refused', (t) => {
  const f = fixture(t);
  const second = f.source + '\n// reviewed fixture variant';
  f.p.catalog.versions['1.0.0'].uninstallTargets['dist/core/package-manager.js'] = [hash(f.source), hash(second)];
  f.p.apply(); f.p.restore();
  writeFileSync(f.file, second); f.p.apply(); f.p.restore();
  writeFileSync(f.file, second + '\n// unknown third variant');
  assert.throws(() => f.p.apply(), /未适配/);
});
test('catalog rejects empty, duplicate, malformed or out-of-scope uninstall digests', (t) => {
  const f = fixture(t), file = join(f.data, 'catalog.json');
  for (const targets of [
    { 'dist/core/package-manager.js': [] },
    { 'dist/core/package-manager.js': [hash(f.source), hash(f.source)] },
    { 'dist/core/package-manager.js': ['invalid'] },
    { '../outside.js': hash(f.source) },
  ]) {
    writeJSON(file, { schema: 1, versions: { '1.0.0': { ui: {}, changelog: {}, uninstallTargets: targets } } });
    assert.throws(() => loadCatalog(file), /卸载入口摘要无效/);
  }
});
test('minified sequence expressions retain trust/recovery/removal ordering', async (t) => {
  const source = managerSource.replace('this.assertProjectTrustedForScope(scope);\n    await', 'this.assertProjectTrustedForScope(scope), await');
  const f = fixture(t, source); f.p.apply();
  const m = await manager(f, { self: f.p.recoveryContext().packageRoot });
  m.actualRemoval = async () => assert.equal(readFileSync(f.file, 'utf8'), source);
  await m.removeAndPersist('self');
});
test('missing trust checks and ambiguous manager classes are rejected', () => {
  const context = { root: '/', dir: '/', packageRoot: '/' };
  assert.throws(() => insertUninstallHook(managerSource.replace('this.assertProjectTrustedForScope(scope);', ''), 'file:///x.mjs', context), /信任检查/);
  assert.throws(() => insertUninstallHook(managerSource + managerSource.replaceAll('DefaultPackageManager', 'OtherManager'), 'file:///x.mjs', context), /不唯一/);
});
