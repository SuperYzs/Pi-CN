## [1.1.0] - 2026-10-07

### 新功能

- **程序状态上报**：支持 OSC 7501 的终端和助手仪表板可查看 Pi 正在工作、被对话框或登录阻塞、已完成或失败的状态。参见[程序状态](docs/terminal-setup.md#program-status)。
- **Claude Haiku 5.5**：`anthropic/claude-haiku-5-5`，支持最高 `xhigh`/`max` 强度的自适应思考。
- **用 `+name`/`-name` 调整默认工具**：`--tools` 中的 `pi -t +codemode,-write` 等条目会调整默认选择，而非替换它。参见[工具](docs/cli.md#tools)。
- **GPT-6 Luna 与图片分类**：OpenAI 的 GPT-6 Luna 可通过 Decisions API 作为分类模型使用，codemode 的 `models.classify()` 也支持向具备图片能力的分类模型传入图片。参见[使用分类模型](docs/models.md#use-classifier-models)。
- **原生 llama.cpp 决策模型**：通过 llama.cpp 0.6.0 或更新版本提供的 Julia-1、Laya、Kev、lev 和 OpenJev，可经 `/v1/systemone` 原生作为分类模型运行。参见[分类](docs/llama-cpp.md#classification)。

### 新增

- 为 `--tools` 新增 `+name` 和 `-name` 条目，用于调整默认工具选择而非替换它，例如 `pi -t +codemode`
- 为工具渲染上下文和 `tool_execution_end` 扩展事件新增 `durationMs`：最终工具结果所记录的执行时间（[#10549](https://github.com/earendil-works/pi/issues/10549)）
- 为工具渲染上下文新增 `outputPad`（[#10557](https://github.com/earendil-works/pi/pull/10557)，由 [@rwachtler](https://github.com/rwachtler) 贡献）
- 新增 OpenAI 的 GPT-6 Luna 分类模型，通过 Decisions API 调用，使用 `OPENAI_API_KEY` 认证（参见[使用分类模型](docs/models.md#use-classifier-models)）
- 为 codemode 的 `models.classify()` 上下文新增 `images`，让 GPT-6 Luna 等支持图片的分类模型能够判断图片
- 新增基于 OSC 7501 的程序状态上报：支持该协议的终端和助手仪表板可查看 Pi 正在工作、被对话框或登录阻塞、已完成或失败的状态。`PI_PROGRAM_STATUS=1|0` 可覆盖自动检测（参见[终端设置](docs/terminal-setup.md#program-status)）（[#10607](https://github.com/earendil-works/pi/issues/10607)）
- 为会话、扩展和 JSON 的 `agent_settled` 事件新增 `aborted`，使集成方可区分取消的运行与正常完成的运行（[#10607](https://github.com/earendil-works/pi/issues/10607)）
- 新增 Claude Haiku 5.5（`anthropic/claude-haiku-5-5`），支持最高 `xhigh`/`max` 强度的自适应思考，以及 Bedrock 提示词缓存
- 新增原生 llama.cpp 决策模型：通过 llama.cpp 0.6.0 或更新版本提供的 Julia-1、Laya、Kev、lev 和 OpenJev，只会经 `/v1/systemone` 列为分类模型，不再列为聊天模型（参见[分类](docs/llama-cpp.md#classification)）（[#10382](https://github.com/earendil-works/pi/pull/10382)）

### 变更

- `outputPad` 现在也作用于 `!` 命令输出、工具输出和摘要块（[#9946](https://github.com/earendil-works/pi/issues/9946)、[#10557](https://github.com/earendil-works/pi/pull/10557)，由 [@rwachtler](https://github.com/rwachtler) 贡献）
- `pi mcp login --timeout` 现在限制整个登录过程，包括向授权服务器发出的请求，而非仅限制等待浏览器的时间（[#10565](https://github.com/earendil-works/pi/issues/10565)）

### 修复

- 修复重新加载会话后 bash 和 PowerShell 结果丢失 `Took`，以及实时 `Took` 包含墙钟时间步骤的问题；两者现在都显示记录的执行时间（[#10549](https://github.com/earendil-works/pi/issues/10549)）
- 修复托管安装保留所有旧版本的问题；`pi update` 现在只保留新版本及其更新前的版本（[#10392](https://github.com/earendil-works/pi/issues/10392)、[#10511](https://github.com/earendil-works/pi/pull/10511)，由 [@davidbrai](https://github.com/davidbrai) 贡献）
- 修复独立二进制版将启动目录中的 `.env`、`.env.local` 和 `.env.development` 加载到 Pi 环境中的问题（[#10473](https://github.com/earendil-works/pi/issues/10473)）
- 修复 `!!` 命令标题在输出到达后丢失暗色的问题（[#10557](https://github.com/earendil-works/pi/pull/10557)，由 [@rwachtler](https://github.com/rwachtler) 贡献）
- 修复 codemode 描述未将 `searchTools()`、`describeTool()` 和 `describeNamespace()` 标记为异步，导致模型将未等待的 promise 序列化为 `{}` 的问题（[#10555](https://github.com/earendil-works/pi/issues/10555)）
- 修复 codemode 输出项连在一起，导致模型无法区分一次 `text()` 或 `console.log()` 输出结束位置的问题。有多个文本项时，每项现在以 `==> text N/M <==` 行开头；`console` 调用在其他输出之后统一放入 `<console_output>` 块，每次调用占一行
- 修复 `/mcp` 打开前等待所有服务器连接的问题；管理器现在实时更新，启用、重连或禁用服务器时仍可使用（[#10562](https://github.com/earendil-works/pi/issues/10562)）
- 修复在 Node 24.19+ 和 26.x 上使用 `node --watch` 时，Node 向图片缩放 worker 通道发送自身消息，导致图片被以 "could not be resized" 丢弃的问题（[#10527](https://github.com/earendil-works/pi/issues/10527)）
- 修复 Termux 中剪贴板粘贴无效，以及复制失败时遗漏 Termux:API 安装提示的问题（[#10391](https://github.com/earendil-works/pi/issues/10391)）
- 修复 `!` 和 RPC `bash` 的输出在颜色码跨输出块拆分时残留颜色码片段（如单个 `m`）的问题（[#10504](https://github.com/earendil-works/pi/issues/10504)）
- 修复 MCP OAuth 登录等待授权服务器时无法取消，并在会话结束后继续运行的问题。登录界面现在每一步都可按 Esc 取消，关闭会话会中止进行中的登录，每次授权服务器请求在 15 秒后超时（[#10565](https://github.com/earendil-works/pi/issues/10565)）
- 修复关闭时最多等待 15 秒刷新即将过期的 MCP OAuth 令牌，却随即关闭服务器会话的问题（[#10565](https://github.com/earendil-works/pi/issues/10565)）
- 修复全屏文本选区在切换会话或重建记录后保留，导致新记录中无关文本被高亮的问题（[#9311](https://github.com/earendil-works/pi/issues/9311)、[#10567](https://github.com/earendil-works/pi/pull/10567)，由 [@christianklotz](https://github.com/christianklotz) 贡献）
- 修复 Bedrock 上的 OpenAI 模型忽略思考级别，始终采用 Bedrock 默认推理强度的问题（[#9331](https://github.com/earendil-works/pi/issues/9331)、[#10142](https://github.com/earendil-works/pi/pull/10142)，由 [@jsanter27](https://github.com/jsanter27) 贡献）
- 修复 `models.json` 中模型的 `headers` 无法覆盖 Codex 请求的 `originator` 和 `User-Agent` 头的问题（[#10429](https://github.com/earendil-works/pi/pull/10429)，由 [@lucasmeijer](https://github.com/lucasmeijer) 贡献）
- 修复提供商返回 `server_busy` 和 `servers are currently busy` 错误时直接结束回合而不重试的问题（[#10543](https://github.com/earendil-works/pi/issues/10543)）
- 修复 Mistral 响应以 `finish_reason: "error"` 结束时不重试的问题（[#10487](https://github.com/earendil-works/pi/issues/10487)）
- 计算输出限制时，将输入估算从每个 token 4 个字符调整为 3.5 个字符，以减少上下文长度限制导致的请求失败（[#10497](https://github.com/earendil-works/pi/issues/10497)）
- 修复 Radius 模型被组织所有者禁用后仍出现在列表中的问题
- 修复端口 53692 被预留或占用时（例如 Windows 上 Hyper-V/WSL 的端口排除），Anthropic 浏览器登录因 "localhost refused to connect" 失败的问题；登录现在会回退到空闲的回环端口（[#10571](https://github.com/earendil-works/pi/issues/10571)）
- 修复通过 OpenCode、OpenCode Go、OpenRouter、Vercel AI Gateway、Google、MiniMax 等提供商使用 Claude Haiku 5.5、Gemini 3.1 Pro 和 GPT-5.4 等具有提示词长度分层价格的模型时，会话低估长提示词费用的问题
- 修复 Herdr 中 Markdown 链接无法点击的问题（[#10573](https://github.com/earendil-works/pi/issues/10573)）

