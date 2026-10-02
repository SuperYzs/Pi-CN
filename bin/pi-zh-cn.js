#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { Patcher, discoverPi } from '../lib/patcher.js';
import { defaultDataDir, readJSON, writeJSON } from '../lib/storage.js';

const HELP = `用法：pi-zh-cn <apply|restore|status> [--root <Pi安装目录>] [--data-dir <数据目录>]

apply      开启汉化，应用界面与公告
restore    关闭汉化并恢复原文件；卸载前请先执行
status     查看候选文本覆盖情况、安装目录和备份信息

交互设置与说明：/zh-cn
更新插件：pi update git:github.com/SuperYzs/Pi-CN
修改核心界面后需要完全退出并重启 Pi。
`;

try {
  const args = process.argv.slice(2);
  if (!args.length || args.includes('--help') || args.includes('-h')) { console.log(HELP); }
  else {
    const action = args.shift();
    if (!['apply', 'restore', 'status'].includes(action)) throw new Error(`未知操作：${action}`);
    let root, dataDir = defaultDataDir();
    while (args.length) {
      const option = args.shift();
      if (!['--root', '--data-dir'].includes(option) || !args.length || args[0].startsWith('--')) throw new Error(`无效选项或缺少值：${option}`);
      const value = args.shift();
      if (option === '--root') root = value;
      else dataDir = value;
    }
    if (!root) {
      if (process.env.PI_ZH_CN_ROOT) root = process.env.PI_ZH_CN_ROOT;
      else for (const path of (process.env.PATH || '').split(delimiter)) {
        const executable = join(path, process.platform === 'win32' ? 'pi.cmd' : 'pi');
        if (!existsSync(executable)) continue;
        try { root = discoverPi(executable); break; } catch { /* Try the next PATH entry. */ }
      }
    }
    if (!root) throw new Error('找不到 npm 版 Pi；请通过 --root 或 PI_ZH_CN_ROOT 指定安装目录');
    const p = new Patcher(root, dataDir);
    const configFile = join(p.dataDir, 'config.json');
    const config = readJSON(configFile, { enabled: true, chineseReplies: true });
    if (action === 'status') console.log(JSON.stringify(p.status(), null, 2));
    else {
      const result = action === 'apply' ? p.apply() : p.restore();
      writeJSON(configFile, { ...config, enabled: action === 'apply' });
      console.log(JSON.stringify(result, null, 2));
      console.log('操作完成，请完全退出并重启 Pi。');
    }
  }
} catch (error) {
  console.error(`汉化操作失败：${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
