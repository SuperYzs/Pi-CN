## [1.3.0] - 2026-10-15

### 新功能

- **选择 `/share` 的上传目标**：`sessionShareDestination` 可选择 `auto`、`gist` 或 `radius`。参见[会话与上下文](docs/settings.md#sessions-and-context)和[导出或分享会话](docs/sessions.md#export-or-share-a-session)。
- **OpenAI GPT-6 切换思考级别时保留缓存**：使用 API 密钥在会话中途切换思考级别时，会保留提示词缓存。
- **Kimi Code 使用 Chat Completions**：在对话中途添加工具不再使提示词缓存失效。`models.json` 中覆盖的基础 URL 现在必须包含 `/v1`。参见[提供商](docs/providers.md)。
- **干净地切换模型**：前一个模型的思考内容会被丢弃，不再作为文本展示给新模型。
- **恢复会话时保留已启用的工具**：`--tools +name`/`-name` 会在这些工具的基础上生效。参见[工具](docs/settings.md#tools)。

### 新增

- 使用 API 密钥时，在 OpenAI GPT-6 模型的会话中途切换思考级别会保留提示词缓存（[#10853](https://github.com/earendil-works/pi/issues/10853)）
- 新增 `sessionShareDestination` 设置，可为 `/share` 选择自动上传、GitHub gist 或 Radius 上传（[#10870](https://github.com/earendil-works/pi/issues/10870)，由 [@vegarsti](https://github.com/vegarsti) 贡献）

### 变更

- `kimi-coding` 提供商改用 `https://api.kimi.com/coding/v1` 上的 OpenAI Chat Completions，即官方 Kimi Code 客户端使用的协议。K3、K3-256K 和 Kimi For Coding 现在支持在对话中途添加工具而不使提示词缓存失效。`models.json` 中覆盖的 `kimi-coding` 基础 URL 现在必须包含 `/v1`（[#10720](https://github.com/earendil-works/pi/issues/10720)）
- 切换模型时，会丢弃之前由其他模型生成的助手消息中的思考块，不再将其作为纯文本发送。此前，新模型会把旧模型的推理看作其回复的一部分，并可能开始将自己的推理写入可见答案（[#10995](https://github.com/earendil-works/pi/issues/10995)）

### 修复

- 将 Pi 内部依赖固定为精确的发布版本，防止全新安装混入不兼容的包（[#10865](https://github.com/earendil-works/pi/issues/10865)）
- 修复恢复会话时丢失会话中已启用工具的问题。恢复时现在会还原会话的已启用工具，并应用 `--tools +name`/`-name` 条目；但通过含工具名称的 `--tools`、`--no-tools` 或 `--no-builtin-tools` 显式选择工具时除外（[#10785](https://github.com/earendil-works/pi/issues/10785)）
- 修复在 Bun 上停止 codemode 脚本或达到其截止时间时，仍需等待不可中断的内置操作返回的问题（[#10748](https://github.com/earendil-works/pi/issues/10748)）
- 修复反复发生 codemode 超时或中止时残留 worker 不断累积的问题；准入检查现在将跨会话的存活 worker 限制为两个，已取消的 worker 在实际退出前仍计入数量（[#10748](https://github.com/earendil-works/pi/issues/10748)）
- 修复多个提供商包含匹配模型时，`--model` 按目录顺序选择提供商的问题；Pi 现在优先选择已配置凭据的提供商，否则报告歧义。`--models` 和 `enabledModels` 会为每个提供该模型的提供商添加模型，并提示歧义（[#10160](https://github.com/earendil-works/pi/issues/10160)）
- 修复参数为数字字符串或 null 时，TUI、会话树、HTML 导出和示例中的 `read` 行范围标签错误（[#9887](https://github.com/earendil-works/pi/issues/9887)）
- 修复提供商切换 APIs 后 Nix flake 构建失败的问题：模型 API 分组不同时，现在会从最新发布的目录刷新固定的模型目录；发布时会在打标签前固定最新目录并使用它构建（[#10985](https://github.com/earendil-works/pi/issues/10985)）
- 修复 Nix 包将自身的 Node.js 放在 `PATH` 最前面，导致 bash 工具的 shell 使用 Pi 的 Node 而非用户的 `node`/`npm` 的问题。Pi 的 Node 现在仅作为后备（[#10519](https://github.com/earendil-works/pi/issues/10519)）
- 修复提示词模板丢弃带引号的空参数（`""` 或 `''`），导致后续位置参数错位且位置参数默认值无法生效的问题（[#10867](https://github.com/earendil-works/pi/issues/10867)）
- 修复 Nix 包构建在安装检查中失败的问题：检查仍要求 Pi 已不再依赖的 chord 和 esbuild
- 修复字符串中包含 `\usepackage` 等无效 `\u` 转义时，工具调用参数解析丢失字段的问题（[#10868](https://github.com/earendil-works/pi/issues/10868)）
- 修复错误工具结果包含图片时，Anthropic 和 Bedrock Claude 请求返回 400 的问题；图片现在会在该轮工具结果之后发送，模型仍能看到它们（[#10794](https://github.com/earendil-works/pi/issues/10794)）
- 修复 OpenCode Go Gemini 模型返回 404 的问题，将 OpenCode Zen 和 OpenCode Go 迁移到 `opencode.ai/inference` 端点，并为 OpenCode Go 提供商新增 Google Generative AI 支持
- 修复 OpenCode Go MiniMax M2.7 返回“Model does not support this protocol”的问题，改用 Anthropic Messages API
- 修复网关返回 `Unable to forward upstream stream` 错误时未触发自动重试的问题（[#10920](https://github.com/earendil-works/pi/issues/10920)）
- 修复 `The service is temporarily unavailable` 错误未触发自动重试，进而导致压缩在首次尝试时失败的问题（[#10965](https://github.com/earendil-works/pi/issues/10965)）
- 修复 LiteLLM 等代理在同一流式数据块中发送推理和正文时，OpenAI 兼容响应将思考显示在答案之后的问题（[#10926](https://github.com/earendil-works/pi/issues/10926)）
- 修复 Google Vertex 上的 Gemini 4 Argon 请求返回“Thinking budget is not supported”，以及 Gemini API 忽略其思考级别的问题（[#10890](https://github.com/earendil-works/pi/issues/10890)）
- 修复 Xiaomi MiMo 模型在 `minimal` 思考级别返回 400 的问题；现在仅提供 `off` 和 `high` 级别（[#10818](https://github.com/earendil-works/pi/issues/10818)）
- 修复 `openai-codex/gpt-6.1-sol` 使用 272K 上下文窗口，而非 Codex 现已提供的 500K 窗口的问题（[#10840](https://github.com/earendil-works/pi/issues/10840)）
- 修复最终参数为格式错误的 JSON 时，工具调用仍静默使用错误之前解析出的字段执行的问题；现在会使验证失败，并向模型展示其发送的原始参数（[#10897](https://github.com/earendil-works/pi/issues/10897)）
- 修复 Claude Haiku 5.5 和 Claude Opus 5 不支持 `off` 思考级别的问题（[#10753](https://github.com/earendil-works/pi/issues/10753)）
- 修复扩展的 `ctx.ui.custom({ overlay: true })` 中的 `done()` 关闭最上层浮层、而非自身浮层的问题；此前这会使已结束的浮层留在屏幕上，并让其他扩展的对话框无法完成（[#10648](https://github.com/earendil-works/pi/issues/10648)、[#10999](https://github.com/earendil-works/pi/pull/10999)，由 [@masonc15](https://github.com/masonc15) 贡献）

