import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Patcher } from '../lib/patcher.js';
import { readJSON, writeJSON, hash } from '../lib/storage.js';

function fixture(t, large = false) {
  const dir = mkdtempSync(join(tmpdir(), 'pi-cn-perf-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const root = join(dir, 'pi');
  mkdirSync(join(root, 'dist/modes/interactive'), { recursive: true });
  writeJSON(join(root, 'package.json'), { name: '@earendil-works/pi-coding-agent', version: '1.0.0' });
  const file = join(root, 'dist/modes/interactive/interactive-mode.js');
  const source = 'class InteractiveMode {render(){return "Settings"}}\n' + (large
    ? 'const subtitle="Theme";const items=[' + Array.from({ length: 16000 }, (_, n) => `{label:"Untranslated row ${n}",value:"id${n}"}`).join(',') + '];' : '');
  writeFileSync(file, source);
  const catalog = { schema: 1, versions: { '1.0.0': { ui: {}, changelog: {} } } };
  const p = new Patcher(root, join(dir, 'data'), { catalog });
  return { p, root, file, source };
}

test('repeat apply and off/on reuse a verified plan without any AST scan', (t) => {
  const { p, file, source } = fixture(t);
  assert.equal(p.apply().cacheHit, false);
  p.analyze = () => { throw new Error('must not reparse'); };
  assert.equal(p.apply().cacheHit, true);
  assert.equal(p.status().translated, 1);
  p.restore();
  assert.equal(readFileSync(file, 'utf8'), source);
  assert.equal(p.apply().cacheHit, true);
  assert.match(readFileSync(file, 'utf8'), /设置/);
});

test('changed resources, source files and newly discovered files invalidate plans', (t) => {
  const { p, root, file, source } = fixture(t);
  p.apply();
  p.catalog.versions['1.0.0'].ui.Settings = '中文设置';
  assert.equal(p.apply().cacheHit, false);
  assert.match(readFileSync(file, 'utf8'), /中文设置/);
  p.restore();
  writeFileSync(file, source + '\n// modified upstream\n');
  assert.equal(p.apply().cacheHit, false);
  writeFileSync(join(root, 'dist/modes/interactive/new-view.js'), 'const label="Theme";');
  assert.equal(p.apply().cacheHit, false);
});

test('corrupt and out-of-scope cached targets rebuild safely, never changing backups', (t) => {
  const { p, file } = fixture(t);
  p.apply();
  const originalHash = Object.values(p.state().files)[0].originalHash;
  const saved = readJSON(p.planFile, {});
  for (const damage of [
    (plan) => { plan.files[0].patched += 'globalThis.unexpected=true;'; },
    (plan) => { plan.files[0].name = '../outside.js'; },
    (plan) => { plan.files.push(plan.files[0]); },
    (plan) => { plan.files = []; },
    (plan) => { plan.translated = 0; },
  ]) {
    const plan = structuredClone(saved);
    damage(plan);
    writeJSON(p.planFile, plan);
    assert.equal(p.apply().cacheHit, false);
    assert.doesNotMatch(readFileSync(file, 'utf8'), /unexpected/);
    assert.equal(Object.values(p.state().files)[0].originalHash, originalHash);
  }
  writeFileSync(p.planFile, '{broken');
  assert.equal(p.apply().cacheHit, false);
});

test('cached operations still reject external edits and damaged original backups', (t) => {
  const { p, file } = fixture(t);
  p.apply();
  const patched = readFileSync(file, 'utf8');
  writeFileSync(file, 'external change');
  assert.throws(() => p.apply(), /拒绝覆盖/);
  writeFileSync(file, patched);
  const record = Object.values(p.state().files)[0];
  writeFileSync(join(p.dir, 'originals', record.originalHash + '.txt'), 'corrupt');
  assert.throws(() => p.apply(), /备份损坏/);
});

test('edits made during preparation are detected before any core file is written', (t) => {
  const { p, file } = fixture(t);
  const analyze = p.analyze.bind(p);
  p.analyze = (snapshot) => { const sites = analyze(snapshot); writeFileSync(file, 'concurrent edit'); return sites; };
  assert.throws(() => p.apply(), /操作期间被修改/);
  assert.equal(readFileSync(file, 'utf8'), 'concurrent edit');
  assert.equal(Object.keys(p.state().files).length, 0);
});

test('an upgrade during preparation is rejected instead of writing the old plan', (t) => {
  const { p, root, file, source } = fixture(t);
  const analyze = p.analyze.bind(p);
  p.analyze = (snapshot) => { const sites = analyze(snapshot); writeJSON(join(root, 'package.json'), { name: '@earendil-works/pi-coding-agent', version: '2.0.0' }); return sites; };
  assert.throws(() => p.apply(), /版本在操作期间/);
  assert.equal(readFileSync(file, 'utf8'), source);
});

test('cold worker operations keep the parent event loop responsive and support restore', async (t) => {
  const { p, file, source } = fixture(t, true);
  let ticks = 0;
  const timer = setInterval(() => { ticks++; }, 5);
  try {
    const first = await p.runAsync('apply');
    assert.equal(first.cacheHit, false);
    assert.ok(ticks >= 2, `parent heartbeat ticks: ${ticks}`);
    assert.match(readFileSync(file, 'utf8'), /设置/);
    assert.equal((await p.runAsync('apply')).cacheHit, true);
    const status = await p.runAsync('status');
    assert.equal(status.translated, 2);
    await p.runAsync('restore');
    assert.equal(hash(readFileSync(file)), hash(source));
    assert.equal((await p.runAsync('apply')).cacheHit, true);
  } finally { clearInterval(timer); }
});

test('worker failures preserve the original state and reject unknown operations', async (t) => {
  const { p, root, file, source } = fixture(t);
  await assert.rejects(p.runAsync('unsupported'), /不支持/);
  writeJSON(join(root, 'package.json'), { name: '@earendil-works/pi-coding-agent', version: '9.0.0' });
  await assert.rejects(p.runAsync('apply'), /尚未适配/);
  assert.equal(readFileSync(file, 'utf8'), source);
});
