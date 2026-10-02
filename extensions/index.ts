import { getPackageDir, type ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Patcher } from '../lib/patcher.js';
import { defaultDataDir, readJSON, writeJSON } from '../lib/storage.js';
import { PACKAGE_SOURCE, REPOSITORY } from '../lib/releases.js';
import { updatePackage } from '../lib/update.js';

const HELP = `Pi 离线简体中文化
/zh-cn apply 或 setup       应用随插件内置的词库和公告（不调用模型）
/zh-cn update               从 SuperYzs/Pi-CN 更新插件（需联网并确认）
/zh-cn changelog            应用内置中文公告，然后用 /changelog 查看
/zh-cn status              查看 Pi 版本、离线适配版本和候选覆盖情况
/zh-cn restore             恢复修改前文件并停用自动补丁
/zh-cn enable              重新启用启动自动补丁
/zh-cn replies on|off      开启或关闭默认中文回复

发现未适配 Pi 版本时先更新插件，再 /reload 或重启。
核心界面补丁需完全退出并重启 Pi。旧版本实时模型翻译入口已移除。
安装：pi install ${PACKAGE_SOURCE}
更新：pi update ${PACKAGE_SOURCE}
仓库：${REPOSITORY}`;

export default function (pi: ExtensionAPI) {
  const dataDir = defaultDataDir();
  const configFile = join(dataDir, 'config.json');
  const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
  const config = () => readJSON(configFile, { enabled: true, chineseReplies: true });
  const patcher = () => new Patcher(process.env.PI_ZH_CN_ROOT || getPackageDir(), dataDir);
  let busy = false;

  pi.on('before_agent_start', (event) => {
    if (!config().enabled || !config().chineseReplies) return;
    const guideline = '默认使用简体中文向用户解释和回复；如果用户指定其他语言则遵从用户。保留代码、命令、路径、配置键和协议字段原样。';
    if (!event.systemPromptOptions.promptGuidelines.includes(guideline)) event.systemPromptOptions.promptGuidelines.push(guideline);
  });
  pi.on('session_start', (_event, ctx) => {
    if (ctx.mode !== 'tui' || !config().enabled) return;
    ctx.ui.setHiddenThinkingLabel('思考过程（已隐藏）');
    try {
      const result = patcher().apply();
      if (result.changedFiles) ctx.ui.notify(`已离线应用中文资源至 ${result.changedFiles} 个文件。核心界面请重启 Pi；公告可用 /changelog 查看。`, 'info');
    } catch (error) {
      ctx.ui.notify(`中文补丁未应用：${error instanceof Error ? error.message : String(error)}`, 'warning');
    }
  });

  pi.registerCommand('zh-cn', {
    description: '离线中文界面及更新公告；新 Pi 版本随插件更新，无实时模型翻译',
    handler: async (args, ctx) => {
      if (busy) { ctx.ui.notify('已有汉化操作正在运行。', 'warning'); return; }
      const [action = 'help', selection, extra] = args.trim().split(/\s+/).filter(Boolean);
      if (extra) { ctx.ui.notify(HELP, 'info'); return; }
      busy = true;
      try {
        if (action === 'update') {
          if (!ctx.hasUI) throw new Error(`请在交互界面更新，或退出 Pi 后执行 pi update ${PACKAGE_SOURCE}`);
          if (!(await ctx.ui.confirm('从 GitHub 更新中文插件？', '将从 SuperYzs/Pi-CN 拉取 main 分支。需要联网，但不会调用模型。存在未提交修改时拒绝更新。'))) return;
          await ctx.waitForIdle();
          const result = await updatePackage(packageRoot, (command, argv, options) => pi.exec(command, argv, options));
          ctx.ui.notify(result.updated ? '插件已更新。运行 /reload 或重启 Pi 后应用新版本内置译文；核心界面仍需重启。' : '插件已经是最新版本。', 'info');
        } else if (['setup', 'apply', 'ui', 'enable', 'changelog'].includes(action)) {
          const p = patcher();
          if (action === 'changelog' && selection && !['latest', 'all'].includes(selection) && !p.catalog.versions[selection.replace(/^v/, '')]) throw new Error('该版本中文公告尚未随插件发布，请更新插件。不会调用模型即时生成。');
          const result = p.apply();
          writeJSON(configFile, { ...config(), enabled: true });
          ctx.ui.notify(`已应用内置离线译文（${result.changedFiles} 个文件），没有模型调用。核心界面请重启；公告使用 /changelog 查看。`, 'info');
        } else if (action === 'restore') {
          if (ctx.hasUI && !(await ctx.ui.confirm('恢复汉化前的 Pi 文件？', '停用自动补丁，保留原始备份。核心界面需要重启。'))) return;
          const result = patcher().restore();
          writeJSON(configFile, { ...config(), enabled: false });
          ctx.ui.setHiddenThinkingLabel();
          ctx.ui.notify(`已恢复 ${result.restoredFiles} 个文件。请重启 Pi；之后可以安全移除此 package。`, 'info');
        } else if (action === 'status') {
          const s = patcher().status();
          ctx.ui.notify(`Pi ${s.version}：${s.supported ? '已有配套离线资源' : '请先更新中文插件'}\n内置适配版本：${s.supportedVersions.join(', ')}\n候选文本覆盖：${s.translated}/${s.candidates}\n安装目录：${s.root}\n备份记录：${s.patchedFiles} 个文件\n运行时翻译：关闭（只使用内置资源）\n固定同步仓库：${REPOSITORY}`, 'info');
        } else if (action === 'replies' && ['on', 'off'].includes(selection ?? '')) {
          writeJSON(configFile, { ...config(), chineseReplies: selection === 'on' });
          ctx.ui.notify(selection === 'on' ? '已启用默认简体中文回复。' : '已关闭默认中文回复。', 'info');
        } else ctx.ui.notify(HELP, 'info');
      } catch (error) {
        ctx.ui.notify(`汉化操作失败：${error instanceof Error ? error.message : String(error)}`, 'error');
      } finally { busy = false; }
    },
  });
}
