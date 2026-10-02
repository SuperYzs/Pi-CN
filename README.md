# Pi-CN · pi-zh-cn

Pi 核心终端界面、CLI 与更新公告的离线简体中文 Pi package。

固定维护与同步地址：**https://github.com/SuperYzs/Pi-CN**。

## 0.2.0 更新方式

**不再在使用插件时调用模型翻译。** 新 Pi 版本的词库及中文公告在插件维护/发布时准备、审阅并打包；用户更新插件后直接使用内置资源。

- 运行时只读取静态词库和公告，不需要 API key，不产生翻译模型费用。
- 已内置 **Pi 1.0.0 的完整本版中文更新公告**。
- 新 Pi 版本尚未适配时，拒绝修改该版本文件，提示先更新插件；不会偷偷用模型补译。
- `/zh-cn setup`、`/zh-cn ui` 保留为离线应用别名，不再触发模型请求。
- 旧版本生成的 `ui.json`、`changelog.json` 缓存保留，但不再覆盖插件发布的词库。

这是可恢复安装文件补丁，不是上游官方 i18n。支持 npm 安装版 Pi；不支持独立二进制。核心界面修改后需完全退出并重启 Pi。

## 安装与更新

```bash
pi install git:github.com/SuperYzs/Pi-CN
```

安装后重启 Pi，启动时自动应用对应版本的内置中文资源。再次重启，使核心界面代码生效。公告可直接使用 `/changelog` 查看。

发现 Pi 版本更新时，更新插件：

```bash
pi update git:github.com/SuperYzs/Pi-CN
```

或者在 Pi 内运行：

```text
/zh-cn update
```

确认后从本仓库 `main` 分支执行 `git pull --ff-only`；更新完运行 `/reload` 或重启。插件有未提交修改、不是 `main` 分支或 `origin` 指向其他仓库时，拒绝自动更新，避免破坏用户改动。固定标签/提交安装请使用 Pi 原生包更新方式或手动切换版本；固定 ref 不会自动移动到新版本。

**只有显式更新插件才需要联网。应用内置译文不联网、不调用模型。** 当前发行版只声明已维护的 Pi 版本；更新插件之后仍提示未适配，表示对应译文尚未发布，而不是让客户端即时翻译。

### 本地开发安装

```bash
cd ~/projects/pi-zh-cn
npm ci --ignore-scripts --omit=peer
pi install /home/superyzs/projects/pi-zh-cn
```

其他用户替换为自己的路径。当前使用本地路径安装的用户，本次更新运行 `/reload` 即可加载新插件，不需要清空备份或缓存。

切换 Git 安装时，先 `pi remove <旧本地路径>`，再安装 Git source，避免两份插件重复加载。迁移时保留 `~/.pi/agent/pi-zh-cn/`，新安装能继续识别原有补丁备份。

## 命令

| 命令 | 作用 |
|---|---|
| `/zh-cn apply` / `/zh-cn setup` | 离线应用内置资源 |
| `/zh-cn update` | 确认后从固定 GitHub 仓库更新插件 |
| `/zh-cn changelog` | 应用随包公告；用原生 `/changelog` 查看 |
| `/zh-cn status` | 当前 Pi、支持版本、候选覆盖及备份信息 |
| `/zh-cn restore` | 恢复修改前文件，关闭自动补丁 |
| `/zh-cn enable` | 重新启用启动自动补丁 |
| `/zh-cn replies on\|off` | 开启或关闭默认中文回复指导 |

默认中文回复指导只影响正常对话语言，不会主动发起模型调用或改写工具协议。

JSON、RPC、print 模式不会在加载时自动修改安装文件；显式执行离线命令仍可工作。RPC stdout 保持协议记录。

## 公告与覆盖边界

公告译文随 `locales/releases.json` 发布。按原文 SHA-256 精确匹配，直接写入 Pi 的 `CHANGELOG.md`，因此原生启动公告和 `/changelog` 都使用对应译文。代码、命令、链接、版本号及日期在发布时校验。

当前内置的是 **1.0.0 本版公告**，尚未内置的旧版历史条目保留原文；不会自动生成历史译文。后续适配版本的公告会累积随插件发布。

界面词库仍在完善：当前维护样本覆盖 **697/1214 条安全扫描候选**，并非整个生态 100% 中文化。安装来源及已有补丁不同，候选数量也可能不同；以 `/zh-cn status` 为准。未维护项保留原文，维护脚本明确列出待补充项，不伪称已翻译。

命令名、模型名、品牌、配置键/枚举值、协议字段及代码保持原样。第三方扩展、远端错误、在线网站、HTML 导出页面和全部文档不保证汉化。已安装 `@juicesharp/rpiv-i18n` 时，可另用 `/languages` 选择 `zh` 汉化支持它的扩展。

## 恢复与卸载

卸载前运行：

```text
/zh-cn restore
```

退出 Pi，然后：

```bash
pi remove git:github.com/SuperYzs/Pi-CN
```

Pi 的包移除没有可靠的插件卸载钩子，仅移除包不会撤销文件补丁。

即使 Pi 启动失败，也可以离线恢复：

```bash
node /path/to/Pi-CN/bin/pi-zh-cn.js restore --root /path/to/node_modules/@earendil-works/pi-coding-agent
```

CLI 还支持 `apply`、`status`、`inventory` 与 `--data-dir`。默认备份目录为 `~/.pi/agent/pi-zh-cn/`，遵从 `PI_CODING_AGENT_DIR`；Pi 根目录可用 `PI_ZH_CN_ROOT` 覆盖。

AST 补丁同时处理 bundled CLI 与 unbundled 模块，保护对象键、导入、比较值、正则、配置值和模板表达式顺序。写入前备份、原子替换并保留权限；外部修改会导致拒绝覆盖。恢复不会把旧版本原文盖到升级后被替换的文件上。不跟随目标符号链接，不修改凭据文件。

安装目录需要可写，不要求 sudo。异常退出留下锁时，确认没有汉化进程后再按错误提示删除锁目录，**不要删除原始备份**。

## 新 Pi 版本维护流程

后续更新必须继续提交并推送至 **SuperYzs/Pi-CN**，不能只改本机。详见 [AGENTS.md](AGENTS.md)。

1. 获取新版本并导出差异（不会调用模型）：

   ```bash
   npm run prepare:pi -- --version 1.0.0
   # 或使用本地已安装 Pi 的原始备份：
   npm run prepare:pi -- --root /path/to/node_modules/@earendil-works/pi-coding-agent
   ```

2. 在 `maintenance/<Pi版本>/ui.zh.json` 维护新增界面译文，在 `changelog.zh.md` 维护对应版本完整中文公告。`ui.pending.json` 列出未维护项，`changelog.source.md` 保存本版原文。译文在维护阶段生成/审阅，不留给客户端执行。
3. 编译进发布资源：

   ```bash
   npm run build:pi -- --version 1.0.0
   ```

   默认要求全部候选已维护，且公告完整、代码/链接/命令未被改动。确需保留部分英文时必须显式 `--allow-partial-ui`，发布清单会记录真实覆盖情况。上游公告变化则拒绝编译，要求重新审阅。
4. 提升插件版本、记录 `CHANGELOG.md`，并测试：

   ```bash
   npm test
   npm run check
   npm run smoke -- /path/to/node_modules/@earendil-works/pi-coding-agent
   npm pack --dry-run
   ```

5. 审阅并提交，再同步到固定仓库：

   ```bash
   git add <本次维护的文件>
   git commit -m "Adapt offline Chinese resources for Pi <version>"
   npm run release:push
   ```

`release:push` 检查 `origin`、`main`、干净工作区及测试结果，然后普通 `git push origin main`，不强推、不自动提交用户文件。GitHub Actions 在后续提交/PR 上检查测试和静态发布资源。本项目没有后台自动翻译、自动创建译文或未经授权自动发布机制。

维护用 `--version` 从 npm 下载固定上游包并只解析其文件；不运行其生命周期脚本，需要 npm 与 tar。测试和发布包不包含本机备份、旧模型缓存或凭据。上游 Pi 原文和品牌属于其作者，Pi 上游采用 MIT 协议。
