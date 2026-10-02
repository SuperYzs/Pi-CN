## [1.0.0] - 2026-10-01

### 新功能

- **默认全屏** — TUI 现在默认使用全屏模式。将 `tuiMode` 设为 `"regular"` 可保留终端的普通滚动历史。参见[终端与显示](docs/settings.md#terminal-and-display)。
- **更精简的 codemode** — 提示词 token 数量减少约 40%，错误信息会告诉模型如何恢复。参见 [Codemode](docs/codemode.md)。
- **在 codemode 中生成图片** — 脚本使用会话凭据调用 `models.generateImages()`。参见[生成图片](docs/codemode.md#generate-images)和[使用图片模型](docs/models.md#use-image-models)。
- **在 `/login` 中使用 Radius** — 一步完成 Radius 登录及其 MCP 服务器配置。参见 [Radius](docs/providers.md#radius)。
- **Anthropic 复制授权码登录** — 浏览器位于另一台机器时也能登录。参见[交互式认证](docs/providers.md#authenticate-interactively)。
- **强化 MCP OAuth 安全性** — 支持 `oauth.authServerMetadataUrl`、RFC 9207 `iss` 校验、各服务器独立凭据，以及保留已授权范围的追加授权登录。参见[使用 OAuth 认证](docs/mcp.md#authenticate-with-oauth)。
- **仅显示标题的安静启动** — `quietStartup: "header"` 保留版本和快捷键提示，隐藏其他内容。参见[终端与显示](docs/settings.md#terminal-and-display)。

### 新增

- 为错误声明 OAuth 授权服务器或未声明授权服务器的 MCP 服务器新增 `oauth.authServerMetadataUrl` 设置。Pi 使用配置的元数据文档，替代自动发现（[#10172](https://github.com/earendil-works/pi/issues/10172)）。
- 新增 `quietStartup: "header"`，保留启动标题中的版本和快捷键提示，隐藏模型范围及已加载资源列表。
- codemode 脚本新增 `models.generateImages()`。它使用会话凭据调用 OpenRouter 等提供商的图片模型，返回可由 `image()` 附加至结果的 base64 图片块；与 `models.classify()` 一样，用量计入会话费用。扩展可调用 `ctx.modelRegistry.generateImages()`。参见[使用图片模型](docs/models.md#use-image-models)。
- Anthropic `/login` 新增复制授权码的登录方式，适用于浏览器位于另一台机器的无界面环境（[#10194](https://github.com/earendil-works/pi/pull/10194)，由 [@lucasmeijer](https://github.com/lucasmeijer) 贡献）。

### 变更

- TUI 默认模式改为全屏。将 `tuiMode` 设为 `"regular"`，或传入 `--tui-mode regular`，可保留终端的普通滚动历史。
- `/login` 现在将“使用 Radius 登录”作为顶层菜单的最后一项，并显示其状态。登录 Radius 后，`/login` 会询问是否在全局 `mcp.json` 中以 `"auth": { "provider": "radius" }` 配置 Radius MCP 服务器，然后重新加载。取消登录会返回发起登录的菜单。
- 提供商文档页面改名为[提供商](docs/providers.md)；其中的“云提供商”章节改为“提供商专用配置”，并优先介绍 Radius。
- MCP OAuth 凭据现在按服务器名称和 URL 分别存储，使用相同 URL 的 MCP 服务器可登录不同账号。过去仅按 URL 保存的凭据会迁移给第一个使用它的服务器（[#10252](https://github.com/earendil-works/pi/issues/10252)）。
- codemode 显著减少提示词 token 用量：启用默认工具和 codemode 时，GPT-5.6 请求从约 5,300 token 缩减至 3,300 token。`codemode` 的说明为各脚本全局对象仅保留一行，并指向新的 [Codemode](docs/codemode.md) 参考文档；模型需要时再读取其中的 `models` API。已声明工具用一行说明脚本调用方式及返回值，不再重复完整声明；系统提示中的 codemode 指引和 MCP 服务器章节也更精简。
- codemode 错误现在提供恢复建议：访问不存在的工具或 `models` 成员时列出相近名称（`tools.Bash` 会建议 `tools.bash`）；`models.classify()` 和 `models.generateImages()` 会拒绝格式错误的参数，并展示预期结构；未知模型会提示使用 `models.getAvailableOfType()`；过大的 `store()` 值会解释存储区用途；脚本生成图片却未显示时也会提示。过去使用 `typeof tools.name` 检查工具的脚本，必须改用 `"name" in tools`。
- `/login` 和 `/logout` 现在将没有凭据的提供商标为“未配置”，替代原来的“未设置”。
- OAuth 浏览器页面现在显示彩色 Pi 标志。

### 修复

- 修复 MCP OAuth 登录接受错误授权服务器响应的问题：若 `iss` 参数指向另一授权服务器，现在会在交换授权码前拒绝该授权码（RFC 9207）。
- 修复 MCP OAuth 登录在令牌响应包含 `"scope": ""` 时报 `Invalid scope` 的问题，以及其他可选 OAuth 字段为空或 `null` 时的类似失败（[#10266](https://github.com/earendil-works/pi/issues/10266)）。
- 修复 `/mcp login` 输出的登录 URL 换行后无法点击的问题（[#10186](https://github.com/earendil-works/pi/issues/10186)）。
- 修复只传入 `--provider`、未传入 `--model` 时参数被静默忽略，进而使用其他提供商默认模型的问题；现在会明确报错（[#10236](https://github.com/earendil-works/pi/issues/10236)）。
- 修复 MCP 服务器请求额外授权范围（`insufficient_scope`）时反复要求登录的问题。此前追加登录仅请求缺少的范围，导致新令牌失去旧令牌已有权限；现在会保留已经授予的范围。
- 修复对话中用户消息为每个渲染行保留两份完整宽度副本的问题；现在只保留一份，显示结果不变。
- 修复 `/login` 和 `/logout` 将所有 OAuth 登录（包括 Radius）标为订阅的问题；现在只有基于订阅的提供商显示“订阅”，其他 OAuth 登录显示“账号”。
- 修复启动标题标志在 Apple Terminal 中出现空隙的问题；现在改为显示彩色“Pi”和版本号。
- 修复恢复会话或 `/reload` 时，已由 `tool_search` 加载的延迟 MCP 工具被丢弃的问题：即使服务器在下次提示前已重连，也会因工具先于 MCP 服务器恢复而丢失。
- 修复系统主题将 Catppuccin Frappe 等柔和配色变得过于鲜艳的问题；现在保留原有色度（[#10255](https://github.com/earendil-works/pi/issues/10255)，[#10293](https://github.com/earendil-works/pi/pull/10293)，由 [@dgtlntv](https://github.com/dgtlntv) 贡献）。
- 修复输入以空白字符开头时斜杠命令无法触发自动补全的问题（[#10218](https://github.com/earendil-works/pi/pull/10218)，由 [@haoqixu](https://github.com/haoqixu) 贡献）。
- 修复全屏模式下，带样式的 token 恰好在高亮边界结束时，颜色溢出到鼠标选区和搜索高亮之外的问题（[#10169](https://github.com/earendil-works/pi/issues/10169)）。
- 修复对话中每条渲染消息保留过多内存的问题；长助手消息的堆内存占用现在约为原来的五分之一。

