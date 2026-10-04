## [1.0.1] - 2026-10-03

### 新功能

- **Nix flake** — `nix run github:earendil-works/pi/stable` 运行最新版本，`nix profile add github:earendil-works/pi/stable` 安装最新版本。参见[安装 pi](docs/quickstart.md#1-install-pi)。
- **MCP 服务器项目覆盖** — `.pi/mcp.json` 和 `/mcp` 可针对单个项目启用、禁用用户级服务器，或更改其工具暴露方式。参见[配置服务器](docs/mcp.md#configure-servers)。
- **MCP Client ID Metadata Documents** — `oauth.clientRegistration: "cimd"` 让授权服务器通过 pi 的文档 URL 放行客户端，而不使用动态注册。参见[通过 OAuth 认证](docs/mcp.md#authenticate-with-oauth)。
- **任意工具的渲染器** — `pi.registerToolRenderer()` 可以绘制尚未注册工具的调用，例如恢复会话中的 MCP 工具。参见[工具渲染](docs/extensions.md#tool-rendering)。
- **Cloudflare Clef 分类模型** — `@cf/cloudflare/clef` 和 `@cf/cloudflare/clef-flash` 可在 codemode 脚本和扩展中使用。参见[使用分类模型](docs/models.md#use-classifier-models)。

### 新增

- 在 `/login`、`/mcp` 和 `/mcp login` 的 OAuth 登录界面新增复制按键（`app.message.copy`，默认 `ctrl+x`）；浏览器无法打开，或换行后的链接无法选中时，可复制登录 URL。
- 为 MCP 服务器新增 `oauth.clientRegistration: "cimd"`，使用 pi.dev 上的 Client ID Metadata Document 标识 pi，而不使用动态客户端注册，让授权服务器可通过 URL 放行 pi（[#10302](https://github.com/earendil-works/pi/issues/10302)）
- 新增用户级 MCP 服务器的项目覆盖：`.pi/mcp.json` 中不含 `command` 或 `url` 的条目只设置用户级服务器的 `enabled`、`exposure` 和 `toolExposure`；`/mcp` 可为当前项目启用或禁用服务器（[#10277](https://github.com/earendil-works/pi/issues/10277)）
- 为 `cloudflare-workers-ai` 新增 Cloudflare 的 Clef 和 Clef Flash 分类模型，可在 codemode 脚本和扩展中使用（[#10316](https://github.com/earendil-works/pi/pull/10316)，由 [@ndisidore](https://github.com/ndisidore) 贡献；[#10322](https://github.com/earendil-works/pi/pull/10322)，由 [@RealAlexandreAI](https://github.com/RealAlexandreAI) 贡献）
- 新增 `pi.registerToolRenderer()`，用于选择工具调用的绘制方式，包括尚未注册的工具（[#10285](https://github.com/earendil-works/pi/issues/10285)）
- 为 macOS 和 Linux 新增 Nix flake：`nix run github:earendil-works/pi/stable` 运行最新版本，`nix profile add github:earendil-works/pi/stable` 安装最新版本。参见[安装 pi](docs/quickstart.md#1-install-pi)（[#9137](https://github.com/earendil-works/pi/pull/9137)）

### 变更

- 全局 npm 安装中的 `pi update` 现在建议迁移到 pi.dev 安装器提供的托管安装，以固定所有依赖版本。
- 对话中途新增或重新定义的 Anthropic 工具现在以内联形式定义在对话中；使用相同名称重新定义工具时可保留提示词缓存，而不必重新发送完整工具列表。

### 修复

- 将 `brace-expansion` 5.0.12 固定为直接依赖，修复安装时解析到存在漏洞的 `brace-expansion` 5.0.9 的问题（GHSA-q2hr-2g5m-vwhr、GHSA-qhr7-859c-m2p7、GHSA-6j4f-fj2g-mc7p）（[#10288](https://github.com/earendil-works/pi/issues/10288)）
- 修复 `--models` 末尾的逗号导致模型循环额外加入一个模型的问题（[#10334](https://github.com/earendil-works/pi/issues/10334)）
- 修复循环打印的 `codemode` 脚本耗尽内存并导致 pi 崩溃的问题：脚本输出超过 16 Mi 个字符或 100000 项时会失败（[#10283](https://github.com/earendil-works/pi/issues/10283)）
- 修复扩展通过 `Image` 渲染的 JPEG、GIF 和 WebP 图片不显示在 Kitty、Ghostty、WezTerm 和 Warp 中的问题（[#10292](https://github.com/earendil-works/pi/issues/10292)）
- 修复恢复会话和 HTML 导出中的 MCP 工具调用在服务器连接前始终完全展开，或服务器从未连接时永久展开的问题（[#10285](https://github.com/earendil-works/pi/issues/10285)）
- 修复在 WezTerm 中滚动后，全屏 Kitty 图片缩成单行条带的问题（[#10319](https://github.com/earendil-works/pi/issues/10319)）
- 修复提供商返回 "Selected model is at capacity" 错误时直接结束回合而不重试的问题（[#10278](https://github.com/earendil-works/pi/issues/10278)）
- 修复 Cloudflare AI Gateway 的 Claude 模型返回 404 的问题，改用短横线形式的模型 ID（`claude-opus-5-5`，而非 `claude-opus-5.5`）
- 修复 ChatGPT 登录回调端口被其他登录占用时仍继续，导致浏览器显示 "OAuth state mismatch" 的问题；现在会报端口占用错误并失败（[#10265](https://github.com/earendil-works/pi/issues/10265)）
- 修复 Amazon Bedrock 的 OpenAI 模型将超过 272k 输入 token 的请求按短上下文费率计费的问题；Bedrock 模型现在包含 models.dev 列出的分层价格（[#10326](https://github.com/earendil-works/pi/issues/10326)）
- 修复系统提示词或工具更改后，Amazon Bedrock 的 Claude 请求因 "Invalid `signature` in `thinking` block" 失败的问题（[#10324](https://github.com/earendil-works/pi/issues/10324)）
- 修复 Together 将 DeepSeek V4 Pro 重命名为 `deepseek-ai/DeepSeek-V4-Pro-0813` 后，该模型丢失思考级别控制的问题（[#10336](https://github.com/earendil-works/pi/pull/10336)，由 [@cv](https://github.com/cv) 贡献）
- 修复默认 NVIDIA 模型指向 NVIDIA 已停止提供的 `nvidia/nemotron-3-super-120b-a12b` 的问题；默认模型现在为 `nvidia/nemotron-3-ultra-550b-a55b`

### 移除

- 从发布包中移除 `npm-shrinkwrap.json`。npm 安装不再固定传递依赖版本，库使用者现在可以覆盖这些依赖。需要固定依赖版本的安装时，请使用 pi.dev 安装器（[#5653](https://github.com/earendil-works/pi/issues/5653)）

