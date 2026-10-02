# Pi-CN 项目维护约定

## 用户的固定要求

- 本项目路径：`/home/superyzs/projects/pi-zh-cn`。
- 唯一维护与后续同步仓库：`https://github.com/SuperYzs/Pi-CN`，发布分支 `main`。
- 后续 Pi 版本适配、插件修复、词库和公告更新，必须在测试通过后提交并 push 到该仓库，不能只保留在本机。
- 禁止运行时调用模型实时翻译。新版本译文在插件维护/发布阶段生成、审阅、编译并随包发布。
- 不要承诺尚未完成的后台自动更新或自动翻译。未适配 Pi 版本应提示更新插件，不要强行补丁。

## 版本发布

1. `npm run prepare:pi -- --version <Pi版本>` 或 `--root <目录>` 获取本版待维护内容。
2. 更新 `maintenance/<Pi版本>/ui.zh.json` 与 `changelog.zh.md`；保留准确的原文快照。
3. `npm run build:pi -- --version <Pi版本>` 编译到 `locales/releases.json`。完整公告必须通过技术标记校验；部分 UI 覆盖必须显式标记，不得宣称 100%。
4. 更新插件版本及项目 `CHANGELOG.md`。
5. `npm test`、`npm run check`、可用时 `npm run smoke -- <Pi安装目录>`、`npm pack --dry-run`。
6. 审阅改动，普通提交并 `npm run release:push`；核对远端 main 与本地 HEAD 一致。

## 安全

- 不上传 `auth.json`、API key、用户配置、会话、缓存、原始备份或 `node_modules`。
- 不强推、不覆盖其他仓库、不自动丢弃或暂存用户未提交修改。
- 自动插件更新仅允许本仓库 origin/main 的 fast-forward；固定标签、其他分支或脏工作区应拒绝。
- 保留原始备份与恢复兼容性，未知 Pi 版本不得修改安装文件。
- 运行时依赖不打包 Pi 提供的宿主模块，不引入另一份宿主类实例。
