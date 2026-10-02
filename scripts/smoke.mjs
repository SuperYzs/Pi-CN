// Run against a COPY of an installed npm Pi, never its original files.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, cpSync, readFileSync, readdirSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { changelogEntries } from '../lib/changelog.js';
import { Patcher } from '../lib/patcher.js';
import { hash, readJSON, defaultDataDir } from '../lib/storage.js';
import { linkPiDependencies } from './pi-fixture.mjs';

const root = process.argv[2] || process.env.PI_ZH_CN_ROOT;
if (!root) throw new Error('用法：npm run smoke -- /path/to/node_modules/@earendil-works/pi-coding-agent');
const original = resolve(root);
const temp = mkdtempSync(join(tmpdir(), 'pi-zh-cn-smoke-'));
const copy = join(temp, 'pi');
const extension = fileURLToPath(new URL('../extensions/index.ts', import.meta.url));
try {
  mkdirSync(copy);
  for (const name of ['dist', 'package.json', 'CHANGELOG.md']) cpSync(join(original, name), join(copy, name), { recursive: true });
  linkPiDependencies(original, copy);
  // Rehydrate only the COPY from verified original backups when the live Pi is
  // already localized, so enabling/disabling still exercises real file writes.
  const upstream = new Patcher(original, defaultDataDir());
  const upstreamState = upstream.state();
  for (const name of Object.keys(upstreamState.files)) {
    if (existsSync(join(copy, name))) writeFileSync(join(copy, name), upstream.original(name, upstreamState));
  }
  const baseline = new Map();
  function capture(directory) {
    for (const entry of readdirSync(join(copy, directory), { withFileTypes: true })) {
      const name = join(directory, entry.name);
      if (entry.isDirectory()) capture(name);
      else if (entry.isFile()) baseline.set(name, hash(readFileSync(join(copy, name))));
    }
  }
  capture('dist');
  for (const name of ['package.json', 'CHANGELOG.md']) baseline.set(name, hash(readFileSync(join(copy, name))));
  const cli = join(copy, 'dist/bundle/cli.js');
  const flags = ['--offline', '-na', '-ne', '-ns', '-np', '--no-themes', '-nc'];
  const env = { ...process.env, PI_CODING_AGENT_DIR: join(temp, 'agent'), PI_ZH_CN_ROOT: copy, PI_TELEMETRY: '0' };
  const run = (args, input) => {
    const result = spawnSync(process.execPath, [cli, ...args], { cwd: temp, env, input, encoding: 'utf8', timeout: 30000 });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, '');
    return result.stdout;
  };
  const runDialog = (message, answer) => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...flags, '-e', extension, '--mode', 'rpc'], { cwd: temp, env, stdio: 'pipe' });
    const messages = [];
    let buffer = '', stderr = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error(`RPC command timeout: ${message}`)); }, 30000);
    child.on('error', (error) => { clearTimeout(timer); reject(error); });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.stdout.on('data', (chunk) => {
      buffer += chunk;
      let end;
      while ((end = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 1);
        if (!line.trim()) continue;
        try {
          const record = JSON.parse(line);
          messages.push(record);
          if (record.type === 'extension_ui_request' && ['select', 'confirm'].includes(record.method)) {
            assert.ok(answer, 'Unexpected dialog');
            child.stdin.write(JSON.stringify({ type: 'extension_ui_response', id: record.id, ...answer(record) }) + '\n');
          }
          if (record.id === 'dialog-command' && record.type === 'response') child.stdin.end();
        } catch (error) { clearTimeout(timer); child.kill(); reject(error); }
      }
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      try {
        assert.equal(code, 0, stderr);
        assert.equal(stderr, '');
        assert.equal(messages.find((record) => record.id === 'dialog-command')?.success, true);
        assert.equal(messages.some((record) => record.notifyType === 'error'), false, JSON.stringify(messages));
        resolve(messages);
      } catch (error) { reject(error); }
    });
    child.stdin.write(JSON.stringify({ id: 'dialog-command', type: 'prompt', message }) + '\n');
  });
  const dataDir = join(env.PI_CODING_AGENT_DIR, 'pi-zh-cn');
  const configFile = join(dataDir, 'config.json');
  const p = new Patcher(copy, dataDir);
  const applied = p.apply();
  assert.ok(applied.changedFiles >= 0);
  assert.equal(p.apply().changedFiles, 0);
  const { parseChangelog } = await import(pathToFileURL(join(copy, 'dist/utils/changelog.js')).href);
  const nativeEntries = parseChangelog(join(copy, 'CHANGELOG.md'));
  const expectedEntries = changelogEntries(readFileSync(join(copy, 'CHANGELOG.md'), 'utf8'));
  assert.equal(applied.changelog.translated, applied.changelog.total);
  assert.equal(nativeEntries.length, expectedEntries.length);
  for (let i = 0; i < nativeEntries.length; i++) {
    assert.equal(nativeEntries[i].content, expectedEntries[i].source.trim());
    // Some upstream versions contain only the immutable version/date heading.
    if (nativeEntries[i].content.includes('\n')) assert.match(nativeEntries[i].content, /[\u3400-\u9fff]/);
  }
  const stateBefore = JSON.stringify(p.state());
  const help = run([...flags, '--help']);
  assert.match(help, /用法：/);
  assert.match(help, /选项：/);
  assert.equal(run(['--version']).trim(), JSON.parse(readFileSync(join(original, 'package.json'), 'utf8')).version);
  run([...flags, '-e', extension, '--help']);
  const output = run([...flags, '-e', extension, '--mode', 'rpc'], JSON.stringify({ id: 'zh-smoke', type: 'get_commands' }) + '\n');
  const response = output.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line)).find((record) => record.id === 'zh-smoke');
  assert.equal(response?.success, true);
  assert.ok(response.data.commands.some((command) => command.name === 'zh-cn'));
  assert.equal(existsSync(configFile), false);
  const info = await runDialog('/zh-cn');
  assert.ok(info.some((record) => record.method === 'notify' && record.message.includes('/zh-cn toggle')));
  assert.ok(info.some((record) => record.method === 'setStatus' && record.statusText?.includes('正在读取')));
  assert.equal(JSON.stringify(p.state()), stateBefore);
  const cancelled = await runDialog('/zh-cn toggle', () => ({ cancelled: true }));
  assert.equal(cancelled.find((record) => record.method === 'select').options.length, 2);
  assert.equal(existsSync(configFile), false);
  assert.equal(JSON.stringify(p.state()), stateBefore);
  await runDialog('/zh-cn replies', (request) => ({ value: request.options.find((option) => option.startsWith('关闭')) }));
  assert.equal(readJSON(configFile, {}).chineseReplies, false);
  await runDialog('/zh-cn toggle', (request) => ({ value: request.options.find((option) => option.startsWith('关闭')) }));
  assert.equal(readJSON(configFile, {}).enabled, false);
  assert.equal(Object.keys(p.state().files).length, 0);
  const enabledMessages = await runDialog('/zh-cn toggle', (request) => ({ value: request.options.find((option) => option.startsWith('开启')) }));
  assert.ok(enabledMessages.some((record) => record.method === 'setStatus' && record.statusText?.includes('正在开启')));
  assert.equal(readJSON(configFile, {}).enabled, true);
  assert.equal(readJSON(configFile, {}).chineseReplies, false);
  await runDialog('/zh-cn update', () => ({ cancelled: true }));
  p.restore();
  let compared = 0;
  function compare(directory) {
    for (const entry of readdirSync(join(original, directory), { withFileTypes: true })) {
      const name = join(directory, entry.name);
      if (entry.isDirectory()) compare(name);
      else if (entry.isFile()) {
        assert.equal(hash(readFileSync(join(copy, name))), baseline.get(name), name);
        compared++;
      }
    }
  }
  compare('dist');
  for (const name of ['package.json', 'CHANGELOG.md']) assert.equal(hash(readFileSync(join(copy, name))), baseline.get(name));
  console.log(`真实 Pi 验证通过：${applied.changedFiles} 个补丁文件、中文 CLI、${nativeEntries.length} 版原生中文公告、统一说明、宿主选择器与取消、后台处理状态、开关持久化、${compared + 2} 个文件完整恢复。`);
} finally {
  rmSync(temp, { recursive: true, force: true });
}
