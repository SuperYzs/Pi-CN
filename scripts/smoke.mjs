// Run against a COPY of an installed npm Pi, never its original files.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, cpSync, symlinkSync, readFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Patcher } from '../lib/patcher.js';
import { hash } from '../lib/storage.js';


const root = process.argv[2] || process.env.PI_ZH_CN_ROOT;
if (!root) throw new Error('用法：npm run smoke -- /path/to/node_modules/@earendil-works/pi-coding-agent');
const original = resolve(root);
const temp = mkdtempSync(join(tmpdir(), 'pi-zh-cn-smoke-'));
const copy = join(temp, 'pi');
const extension = fileURLToPath(new URL('../extensions/index.ts', import.meta.url));
try {
  mkdirSync(copy);
  for (const name of ['dist', 'package.json', 'CHANGELOG.md']) cpSync(join(original, name), join(copy, name), { recursive: true });
  symlinkSync(join(original, 'node_modules'), join(copy, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
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
  const p = new Patcher(copy, join(temp, 'patch-data'));
  const applied = p.apply();
  assert.ok(applied.changedFiles >= 0); // The source installation may already be localized.
  assert.equal(p.apply().changedFiles, 0);
  const help = run([...flags, '--help']);
  assert.match(help, /用法：/);
  assert.match(help, /选项：/);
  assert.equal(run(['--version']).trim(), JSON.parse(readFileSync(join(original, 'package.json'), 'utf8')).version);
  run([...flags, '-e', extension, '--help']);
  const output = run([...flags, '-e', extension, '--mode', 'rpc'], JSON.stringify({ id: 'zh-smoke', type: 'get_commands' }) + '\n');
  const responses = output.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
  const response = responses.find((message) => message.id === 'zh-smoke');
  assert.equal(response?.success, true);
  assert.ok(response.data.commands.some((command) => command.name === 'zh-cn'));
  assert.equal(existsSync(join(env.PI_CODING_AGENT_DIR, 'pi-zh-cn')), false);
  // Execute the actual command without any configured credentials. A hidden
  // model call would fail here instead of completing the offline operation.
  const setupOutput = run([...flags, '-e', extension, '--mode', 'rpc'], JSON.stringify({ id: 'offline-setup', type: 'prompt', message: '/zh-cn setup' }) + '\n');
  const setupResponses = setupOutput.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
  assert.equal(setupResponses.find((message) => message.id === 'offline-setup')?.success, true);
  assert.doesNotMatch(setupOutput, /No API key|completeSimple|modelRegistry|翻译失败/);
  assert.match(setupOutput, /没有模型调用/);
  p.restore();
  let compared = 0;
  function compare(directory) {
    for (const entry of readdirSync(join(original, directory), { withFileTypes: true })) {
      const name = join(directory, entry.name);
      if (entry.isDirectory()) compare(name);
      else if (entry.isFile()) {
        assert.equal(hash(readFileSync(join(copy, name))), hash(readFileSync(join(original, name))), name);
        compared++;
      }
    }
  }
  compare('dist');
  for (const name of ['package.json', 'CHANGELOG.md']) assert.equal(hash(readFileSync(join(copy, name))), hash(readFileSync(join(original, name))));
  console.log(`真实 Pi 验证通过：${applied.changedFiles} 个补丁文件、中文 CLI、扩展加载、RPC 命令注册、无需模型的真实 setup 命令、${compared + 2} 个文件完整恢复。`);
} finally {
  rmSync(temp, { recursive: true, force: true });
}
