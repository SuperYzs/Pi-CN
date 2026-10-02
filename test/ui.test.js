import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { registerChineseUI } from '../lib/ui.js';
import { Patcher } from '../lib/patcher.js';
import { readJSON, writeJSON } from '../lib/storage.js';

function fixture(t, initial = { enabled: false, chineseReplies: true }) {
  const directory = mkdtempSync(join(tmpdir(), 'pi-cn-ui-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const root = join(directory, 'pi');
  const dataDir = join(directory, 'data');
  const file = join(root, 'dist/modes/interactive/interactive-mode.js');
  const source = 'class InteractiveMode { render(){return "Settings"} }';
  mkdirSync(join(root, 'dist/modes/interactive'), { recursive: true });
  writeJSON(join(root, 'package.json'), { name: '@earendil-works/pi-coding-agent', version: '1.0.0' });
  writeFileSync(file, source);
  const configFile = join(dataDir, 'config.json');
  writeJSON(configFile, initial);
  const p = new Patcher(root, dataDir);
  const commands = new Map();
  const events = new Map();
  const notifications = [], dialogs = [], labels = [], executions = [], statuses = [];
  let choose = () => undefined;
  let confirm = false;
  let idle = 0;
  const pi = {
    on: (event, handler) => events.set(event, handler),
    registerCommand: (name, definition) => commands.set(name, definition),
    exec: async (...args) => { executions.push(args); throw new Error('unexpected execution'); },
  };
  const ctx = {
    hasUI: true, mode: 'tui',
    waitForIdle: async () => { idle++; },
    ui: {
      notify: (message, type) => notifications.push({ message, type }),
      select: async (title, options) => { dialogs.push({ title, options }); return choose(options); },
      confirm: async (title, message) => { dialogs.push({ title, message }); return confirm; },
      setHiddenThinkingLabel: (value) => labels.push(value),
      setStatus: (key, text) => statuses.push({ key, text }),
    },
  };
  registerChineseUI(pi, { dataDir, packageRoot: directory, patcher: () => p });
  return { p, pi, ctx, commands, events, notifications, dialogs, labels, executions, statuses, file, source, configFile,
    config: () => readJSON(configFile, {}),
    run: (args = '') => commands.get('zh-cn').handler(args, ctx),
    choose: (prefix) => { choose = typeof prefix === 'function' ? prefix : (options) => options.find((option) => option.startsWith(prefix)); },
    confirm: (value) => { confirm = value; },
    idle: () => idle,
  };
}

test('one concise command shows state and essential help without opening settings', async (t) => {
  const f = fixture(t);
  await f.run();
  assert.equal(f.commands.size, 1);
  assert.equal(f.notifications.length, 1);
  const text = f.notifications[0].message;
  assert.match(text, /汉化：关闭/);
  for (const action of ['toggle', 'replies', 'update']) assert.ok(text.includes(`/zh-cn ${action}`));
  assert.ok(text.split('\n').length <= 8);
  assert.equal(f.dialogs.length, 0);
  assert.equal(f.p.status().patchedFiles, 0);
  assert.deepEqual(f.commands.get('zh-cn').getArgumentCompletions('').map(({ value }) => value), ['toggle', 'replies', 'update']);
});

test('keyboard selection enables localization, marks current first, and persists only after applying', async (t) => {
  const f = fixture(t);
  f.choose('开启');
  await f.run('toggle');
  assert.match(f.dialogs[0].title, /↑↓.*Enter.*Esc/);
  assert.match(f.dialogs[0].options[0], /关闭.*当前/);
  assert.equal(f.config().enabled, true);
  assert.equal(f.config().chineseReplies, true);
  assert.match(readFileSync(f.file, 'utf8'), /设置/);
  assert.equal(f.idle(), 1);
  assert.match(f.notifications.at(-1).message, /重启/);
});

test('background progress clears on success and failure without hiding file conflicts', async (t) => {
  const f = fixture(t);
  f.choose('开启');
  await f.run('toggle');
  assert.ok(f.statuses.some(({ text }) => text?.includes('正在开启')));
  assert.equal(f.statuses.at(-1).text, undefined);
  writeFileSync(f.file, 'external change');
  f.choose('关闭');
  await f.run('toggle');
  assert.equal(f.config().enabled, true);
  assert.equal(f.statuses.at(-1).text, undefined);
  assert.equal(f.notifications.at(-1).type, 'error');
});

test('session shutdown waits for an in-flight worker and completed persistence', async (t) => {
  const f = fixture(t);
  let release, began;
  const barrier = new Promise((resolve) => { release = resolve; });
  const started = new Promise((resolve) => { began = resolve; });
  const actual = f.p.runAsync.bind(f.p);
  f.p.runAsync = async (action) => { began(); await barrier; return actual(action); };
  f.choose('开启');
  const toggle = f.run('toggle');
  await started;
  let stopped = false;
  const shutdown = f.events.get('session_shutdown')().then(() => { stopped = true; });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(stopped, false);
  assert.equal(f.config().enabled, false);
  release();
  await Promise.all([toggle, shutdown]);
  assert.equal(f.config().enabled, true);
  assert.match(readFileSync(f.file, 'utf8'), /设置/);
});

test('keyboard selection disables localization, restores originals and stops auto-apply', async (t) => {
  const f = fixture(t);
  f.choose('开启');
  await f.run('toggle');
  f.choose('关闭');
  await f.run('toggle');
  assert.match(f.dialogs.at(-1).options[0], /开启.*当前/);
  assert.equal(f.config().enabled, false);
  assert.equal(readFileSync(f.file, 'utf8'), f.source);
  assert.equal(f.labels.at(-1), undefined);
  f.events.get('session_start')({}, f.ctx);
  assert.equal(readFileSync(f.file, 'utf8'), f.source);
});

test('Escape cancellation does not patch, persist or wait for an operation', async (t) => {
  const f = fixture(t);
  const before = readFileSync(f.configFile, 'utf8');
  await f.run('toggle');
  await f.run('replies');
  assert.equal(readFileSync(f.configFile, 'utf8'), before);
  assert.equal(readFileSync(f.file, 'utf8'), f.source);
  assert.equal(f.notifications.length, 0);
  assert.equal(f.idle(), 0);
});

test('arbitrary RPC selection values cannot restore or change settings', async (t) => {
  const f = fixture(t);
  f.choose(() => 'unexpected-value');
  await f.run('toggle');
  assert.match(f.notifications.at(-1).message, /无效选项/);
  assert.equal(f.config().enabled, false);
  assert.equal(f.p.status().patchedFiles, 0);
});

test('enabling unsupported Pi leaves the setting and files unchanged', async (t) => {
  const f = fixture(t);
  writeJSON(join(f.p.root, 'package.json'), { name: '@earendil-works/pi-coding-agent', version: '9.0.0' });
  f.choose('开启');
  await f.run('toggle');
  assert.equal(f.config().enabled, false);
  assert.equal(readFileSync(f.file, 'utf8'), f.source);
  assert.match(f.notifications.at(-1).message, /尚未适配/);
  assert.equal(f.labels.length, 0);
});

test('failed restoration does not switch off auto-apply or hide the conflict', async (t) => {
  const f = fixture(t, { enabled: true, chineseReplies: true });
  f.p.apply();
  writeFileSync(f.file, 'externally changed');
  f.choose('关闭');
  await f.run('toggle');
  assert.equal(f.config().enabled, true);
  assert.equal(f.notifications.at(-1).type, 'error');
  assert.match(f.notifications.at(-1).message, /拒绝恢复/);
  assert.equal(readFileSync(f.file, 'utf8'), 'externally changed');
});

test('reply preference is selected by keyboard and preserved when localization is disabled', async (t) => {
  const f = fixture(t, { enabled: true, chineseReplies: true, custom: 42 });
  f.choose('关闭');
  await f.run('replies');
  assert.deepEqual(f.config(), { enabled: true, chineseReplies: false, custom: 42 });
  await f.run('toggle');
  assert.equal(f.config().chineseReplies, false);
  f.choose('开启');
  await f.run('replies');
  assert.equal(f.config().enabled, false);
  assert.match(f.notifications.at(-1).message, /开启汉化后生效/);
});

test('removed aliases and typed on/off arguments cannot mutate settings', async (t) => {
  const f = fixture(t);
  for (const args of ['help', 'status', 'setup', 'ui', 'apply', 'changelog', 'enable', 'restore', 'replies on', 'replies off', 'toggle on', 'update extra']) await f.run(args);
  assert.ok(f.notifications.every(({ message }) => message === '使用 /zh-cn 查看说明。'));
  assert.equal(f.dialogs.length, 0);
  assert.equal(f.config().enabled, false);
  assert.equal(f.executions.length, 0);
});

test('noninteractive settings fail safely instead of changing defaults', async (t) => {
  const f = fixture(t);
  f.ctx.hasUI = false;
  for (const action of ['toggle', 'replies', 'update']) await f.run(action);
  assert.equal(f.dialogs.length, 0);
  assert.equal(f.config().enabled, false);
  assert.equal(f.executions.length, 0);
  assert.ok(f.notifications.every(({ type }) => type === 'error'));
});

test('busy dialogs block a second operation and release their guard after cancellation', async (t) => {
  const f = fixture(t);
  let resolve;
  f.choose(() => new Promise((done) => { resolve = done; }));
  const pending = f.run('toggle');
  await f.run('replies');
  assert.equal(f.dialogs.length, 1);
  assert.equal(f.notifications.at(-1).type, 'warning');
  resolve(undefined);
  await pending;
  await f.run();
  assert.match(f.notifications.at(-1).message, /Pi-CN/);
});

test('cancelled update performs no network operation', async (t) => {
  const f = fixture(t);
  await f.run('update');
  assert.equal(f.dialogs.length, 1);
  assert.equal(f.executions.length, 0);
});

test('startup is TUI-only and reply guidance follows both switch settings', async (t) => {
  const f = fixture(t, { enabled: true, chineseReplies: true });
  for (const mode of ['rpc', 'json', 'print']) await f.events.get('session_start')({}, { ...f.ctx, mode });
  assert.equal(readFileSync(f.file, 'utf8'), f.source);
  await f.events.get('session_start')({}, f.ctx);
  assert.match(readFileSync(f.file, 'utf8'), /设置/);
  const event = { systemPromptOptions: { promptGuidelines: [] } };
  f.events.get('before_agent_start')(event);
  f.events.get('before_agent_start')(event);
  assert.equal(event.systemPromptOptions.promptGuidelines.length, 1);
  writeJSON(f.configFile, { enabled: false, chineseReplies: true });
  const next = { systemPromptOptions: { promptGuidelines: [] } };
  f.events.get('before_agent_start')(next);
  assert.equal(next.systemPromptOptions.promptGuidelines.length, 0);
});

test('public docs and UI omit agent instructions and obsolete translation explanations', () => {
  for (const path of ['README.md', 'README.zh-CN.md', 'CHANGELOG.md', 'CHANGELOG.zh-CN.md', 'CONTRIBUTING.md', 'lib/ui.js', 'lib/releases.js', 'bin/pi-zh-cn.js']) {
    assert.doesNotMatch(readFileSync(path, 'utf8'), /AGENTS\.md|\/home\/superyzs|release:push|prepare:pi|build:pi|实时.*翻译|运行时.*翻译|模型翻译|不调用模型|没有模型调用/);
  }
  const tracked = spawnSync('git', ['ls-files', '--', 'AGENTS.md', '**/AGENTS.md'], { encoding: 'utf8' });
  assert.equal(tracked.status, 0, tracked.stderr);
  assert.equal(tracked.stdout, '');
  const ignored = spawnSync('git', ['check-ignore', 'AGENTS.md'], { encoding: 'utf8' });
  assert.equal(ignored.status, 0);
});
