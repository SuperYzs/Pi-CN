import { join } from 'node:path';
import { readJSON, writeJSON } from './storage.js';
import { PACKAGE_SOURCE } from './releases.js';
import { updatePackage } from './update.js';

const COMMANDS = [
  { value: 'toggle', label: 'toggle', description: '开启或关闭汉化' },
  { value: 'replies', label: 'replies', description: '设置默认中文回复' },
  { value: 'update', label: 'update', description: '更新插件' },
];
const HELP = `/zh-cn toggle   开启或关闭汉化
/zh-cn replies  设置默认中文回复
/zh-cn update   更新插件
切换汉化后请重启 Pi；更新公告使用 /changelog 查看。`;

async function selectSwitch(ctx, title, current, offLabel = '关闭') {
  if (!ctx.hasUI) throw new Error('请在 Pi 交互界面使用此命令。');
  const choices = [true, false].map((enabled) => ({
    enabled,
    label: `${enabled ? '开启' : offLabel}${enabled === current ? '（当前）' : ''}`,
  })).sort((a, b) => Number(b.enabled === current) - Number(a.enabled === current));
  const selected = await ctx.ui.select(`${title} · ↑↓ 选择，Enter 确认，Esc 取消`, choices.map((choice) => choice.label));
  if (selected === undefined) return;
  const choice = choices.find(({ label }) => label === selected);
  if (!choice) throw new Error('无效选项，请重新选择。');
  return choice.enabled;
}

export function registerChineseUI(pi, { dataDir, packageRoot, patcher }) {
  const configFile = join(dataDir, 'config.json');
  const config = () => ({ enabled: true, chineseReplies: true, ...readJSON(configFile, {}) });
  let busy = false;

  pi.on('before_agent_start', (event) => {
    if (!config().enabled || !config().chineseReplies) return;
    const guideline = '默认使用简体中文向用户解释和回复；如果用户指定其他语言则遵从用户。保留代码、命令、路径、配置键和协议字段原样。';
    if (!event.systemPromptOptions.promptGuidelines.includes(guideline)) event.systemPromptOptions.promptGuidelines.push(guideline);
  });
  pi.on('session_start', (_event, ctx) => {
    if (ctx.mode !== 'tui' || !config().enabled) return;
    try {
      const result = patcher().apply();
      ctx.ui.setHiddenThinkingLabel('思考过程（已隐藏）');
      if (result.changedFiles) ctx.ui.notify('汉化已应用，请重启 Pi 使界面生效。', 'info');
    } catch (error) {
      ctx.ui.notify(`汉化未应用：${error instanceof Error ? error.message : String(error)}`, 'warning');
    }
  });

  pi.registerCommand('zh-cn', {
    description: '中文界面设置与使用说明',
    getArgumentCompletions: (prefix) => {
      const matches = COMMANDS.filter(({ value }) => value.startsWith(prefix));
      return matches.length ? matches : null;
    },
    handler: async (args, ctx) => {
      if (busy) { ctx.ui.notify('已有汉化操作正在运行。', 'warning'); return; }
      const action = args.trim();
      if (action && !COMMANDS.some(({ value }) => value === action)) {
        ctx.ui.notify('使用 /zh-cn 查看说明。', 'info');
        return;
      }
      busy = true;
      try {
        if (!action) {
          const s = patcher().status();
          const c = config();
          ctx.ui.notify(`Pi-CN · Pi ${s.version}${s.supported ? '' : '（尚未适配，请更新插件）'}
汉化：${c.enabled ? '开启' : '关闭'} · 默认中文回复：${c.chineseReplies ? '开启' : '关闭'}${c.enabled ? '' : '（汉化关闭时不生效）'}
界面候选覆盖：${s.translated}/${s.candidates}
${HELP}`, 'info');
        } else if (action === 'toggle') {
          const enabled = await selectSwitch(ctx, '汉化设置', config().enabled, '关闭并恢复原界面');
          if (enabled === undefined) return;
          await ctx.waitForIdle();
          const p = patcher();
          if (enabled) p.apply();
          else p.restore();
          writeJSON(configFile, { ...config(), enabled });
          ctx.ui.setHiddenThinkingLabel(enabled ? '思考过程（已隐藏）' : undefined);
          ctx.ui.notify(enabled ? '汉化已开启，请重启 Pi。' : '汉化已关闭并恢复原文件，请重启 Pi。', 'info');
        } else if (action === 'replies') {
          const chineseReplies = await selectSwitch(ctx, '默认中文回复', config().chineseReplies);
          if (chineseReplies === undefined) return;
          writeJSON(configFile, { ...config(), chineseReplies });
          ctx.ui.notify(`${chineseReplies ? '默认中文回复已开启。' : '默认中文回复已关闭。'}${chineseReplies && !config().enabled ? '开启汉化后生效。' : ''}`, 'info');
        } else if (action === 'update') {
          if (!ctx.hasUI) throw new Error(`请退出 Pi 后执行 pi update ${PACKAGE_SOURCE}`);
          if (!(await ctx.ui.confirm('更新 Pi-CN？', '从 GitHub 获取最新版本。更新后请重新加载或重启 Pi。'))) return;
          await ctx.waitForIdle();
          const result = await updatePackage(packageRoot, (command, argv, options) => pi.exec(command, argv, options));
          ctx.ui.notify(result.updated ? '插件已更新，请运行 /reload 或重启 Pi。' : '插件已是最新版本。', 'info');
        }
      } catch (error) {
        ctx.ui.notify(`操作失败：${error instanceof Error ? error.message : String(error)}`, 'error');
      } finally { busy = false; }
    },
  });
}
