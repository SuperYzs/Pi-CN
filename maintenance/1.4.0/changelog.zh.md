## [1.4.0] - 2026-10-21

### 新功能

- **分类器图像输入**：codemode `models.classify()` 在 `typesafe`、`cloudflare-workers-ai` 和 OpenRouter 上为 TypeSafe 的 Jev 与 Cloudflare 的 Clef 模型支持 `images`。参见[使用分类器模型](docs/models.md#use-classifier-models)和 [Codemode](docs/codemode.md#models)。
- **模型配置参考**：从模式生成 `models.json` 中全部提供商、模型、模型覆盖和兼容性字段的说明。参见[模型配置](docs/models-configuration.md)。
- **取消固定输出上限的摘要**：上下文压缩与分支摘要使用模型的输出上限，避免因推理过长而失败。参见[上下文压缩](docs/compaction.md#compaction)。
- **Codemode 等待空闲 worker**：并行脚本和进程内子代理改为排队，而不是直接失败；可用 `PI_CODEMODE_MAX_WORKERS` 提高上限。参见 [Codemode 限制](docs/codemode.md#limits)。
- **支持 Rex 终端**：支持 OSC 8 超链接、真彩色和内联图像。

### 新增

- 新增从 `models.json` 模式生成的模型配置参考，列出全部提供商、模型、模型覆盖和兼容性字段（[#10790](https://github.com/earendil-works/pi/issues/10790)）
- Codemode `models.classify()` 现可在 `typesafe`、`cloudflare-workers-ai` 和 OpenRouter 上为 TypeSafe 的 Jev 与 Cloudflare 的 Clef 模型接收 `images`，并在 Workers AI 中列出 Clef Omni 和 Jev 1.14。
- `models.json` 中提供商级别的 `compat` 现也适用于分类器模型，包含 System One 的 `imageInput` 与 `sendImageOptInHeader` 字段，用于代理其他服务分类器的场景。扩展注册的分类器模型也可接受 `compat`。
- 为 `minimax` 和 `minimax-cn` 提供商新增 `MiniMax-M3.1-Flash`，支持从 low 到 max 的思考级别（[#11121](https://github.com/earendil-works/pi/issues/11121)）
- 新增 Rex 终端支持：OSC 8 超链接、真彩色和内联图像（[#11131](https://github.com/earendil-works/pi/issues/11131)、[@petrroll](https://github.com/petrroll) 贡献的 [#11150](https://github.com/earendil-works/pi/pull/11150)、[@nihaals](https://github.com/nihaals) 贡献的 [#11183](https://github.com/earendil-works/pi/pull/11183)）

### 变更

- 提供商归属标头现由 pi-ai 的客户端标识生成。扩展的 `before_provider_headers` 处理器不再看到 OpenRouter、NVIDIA NIM 和 OpenCode 的归属标头；为某个标头返回 `null` 仍可将其移除。Cloudflare 请求与工具下载时的 GitHub 发布检查现会发送 pi 的详细 `User-Agent`，而非 `pi-coding-agent`；只要启用了归属标识，OpenCode 请求就会发送 `x-opencode-client`，不再仅限于存在会话时。
- `generateSummary()` 和 `generateSummaryWithUsage()` 现忽略 `reserveTokens` 参数，摘要请求改用模型的输出上限。
- 将 GitHub Copilot 默认模型从已被 Copilot 停用的 `gpt-5.4` 改为 `gpt-6.1-sol`。
- 将 NVIDIA 默认模型改为 `nvidia/nemotron-3.5-super-vl-120b-a12b`（[@cv](https://github.com/cv) 贡献的 [#10910](https://github.com/earendil-works/pi/pull/10910)）
- 为 `xiaomi` 和 Xiaomi Token Plan 提供商将 Xiaomi 默认模型改为 `mimo-v2.6-pro`，因为 `mimo-v2.5-pro` 已从目录移除。
- `xai` 提供商上的 Grok 4.3 和 Grok 4.5 现提供 `xhigh` 思考级别。
- 使用 ChatGPT 登录：ChatGPT Business 工作区的用量上限错误不再重试，并提示用户联系工作区管理员提高上限。

### 修复

- 修复上下文压缩和分支摘要因推理消耗固定摘要输出额度的大部分而报出“generation hit the token cap”的问题。摘要现使用模型的输出上限，`compaction.reserveTokens` 只控制何时开始压缩（[#9512](https://github.com/earendil-works/pi/issues/9512)、[#9075](https://github.com/earendil-works/pi/issues/9075)）。
- 修复 `models.schema.json` 缺少提供商和模型字段描述，导致编辑器无法显示相应提示的问题（[#10790](https://github.com/earendil-works/pi/issues/10790)）
- 修复 Windows PowerShell 5.1 重写 `managed-install.json` 时加入 UTF-8 BOM，导致 `pi update` 报出“Managed install marker is missing or invalid”的问题。
- 修复 HTML 导出时，CJK 标点旁的 Markdown 粗体和斜体显示为字面星号的问题（[#3353](https://github.com/earendil-works/pi/issues/3353)、[#10154](https://github.com/earendil-works/pi/issues/10154)）
- 修复 pi 未正常清理终端就退出时，终端仍处于鼠标跟踪、焦点上报、Kitty 键盘和备用屏幕模式，导致 shell 提示符被转义序列刷屏的问题（[#11170](https://github.com/earendil-works/pi/issues/11170)）
- 修复交互模式中并发的扩展 `select`/`confirm`/`input`/`editor` 对话框及内联 `custom()` 组件：此前第二个对话框会替换第一个，使第一个 promise 永远无法完成；现在关闭可见对话框后会重新显示之前的对话框（[#11166](https://github.com/earendil-works/pi/issues/11166)、[#9909](https://github.com/earendil-works/pi/issues/9909)）
- 修复 Linux 上在 pi 中复制文本后按 Ctrl+Z 挂起进程，导致 shell 粘贴卡住的问题：持续提供剪贴板内容的后台 `wl-copy`/`xclip`/`xsel` 进程此前会随 pi 一起被挂起（[#11179](https://github.com/earendil-works/pi/issues/11179)）
- 修复 codemode 的两个 worker 都忙碌时，脚本立即失败的问题，例如并行 codemode 调用或进程内子代理场景。脚本现会等待空闲 worker，最长 60 秒；可用 `PI_CODEMODE_MAX_WORKERS` 提高默认两个 worker 的上限（[#11184](https://github.com/earendil-works/pi/issues/11184)）
- 修复扩展导入 `@earendil-works/pi-ai/models`（例如使用 `clampThinkingLevel`）时加载失败的问题，现已通过扩展加载器别名和虚拟模块暴露该子路径（[#11156](https://github.com/earendil-works/pi/issues/11156)）
- 修复以 UTF-8 BOM 开头的 `mcp.json` 解析失败，导致其中所有 MCP 服务器被跳过且 `pi mcp add`/`pi mcp remove` 失败的问题（[#11191](https://github.com/earendil-works/pi/issues/11191)）
- 修复 `/compact <instructions>` 在汇总被压缩拆分的回合开头时忽略指令的问题。若拆分回合是上次压缩后的唯一新增内容，指令此前会被完全忽略（[#11058](https://github.com/earendil-works/pi/issues/11058)）
- 修复恢复会话和通过 `/tree` 导航时，分支在扩展工具注册前记录了工具，导致这些工具保持未激活的问题，例如会话开始后才安装的扩展提供的工具。分支中从未显式添加或移除的扩展工具现会默认激活，除非注册时设置了 `defaultActive: false`（[#11062](https://github.com/earendil-works/pi/issues/11062)、[#11075](https://github.com/earendil-works/pi/issues/11075)）
- 修复从输出上限截断的响应恢复后会话失效的问题：此前截断的工具调用被省略，但其工具结果仍被保留，导致提供商拒绝后续全部请求（[#11227](https://github.com/earendil-works/pi/issues/11227)、[@petrroll](https://github.com/petrroll) 贡献的 [#11233](https://github.com/earendil-works/pi/pull/11233)）
- 修复 `grep` 工具遵从 `RIPGREP_CONFIG_PATH`，导致 `--fixed-strings` 等选项静默地把正则搜索改成字面搜索的问题。工具现执行 `rg --no-config`（[#11203](https://github.com/earendil-works/pi/issues/11203)、[@petrroll](https://github.com/petrroll) 贡献的 [#11230](https://github.com/earendil-works/pi/pull/11230)）
- 修复 Windows shell 检测拒绝可执行的 Microsoft Store shell 别名的问题（[@petrroll](https://github.com/petrroll) 贡献的 [#9504](https://github.com/earendil-works/pi/pull/9504)）
- 修复 Windows 未安装在 `C:\Windows` 时，shell 检测遗漏 `PATH` 之外的 PowerShell 和旧版 WSL `bash.exe` 启动器的问题。pi 现会检查 `%ProgramFiles%\PowerShell\7`、`%SystemRoot%\System32\WindowsPowerShell\v1.0` 和 `%SystemRoot%`（[@petrroll](https://github.com/petrroll) 贡献的 [#9501](https://github.com/earendil-works/pi/pull/9501)）
- 修复 GitHub Copilot 会话在请求体过大（例如包含大量图像）时，报出 HTTP 413 `failed to parse request`，而非压缩并重试的问题（[@petrroll](https://github.com/petrroll) 贡献的 [#11016](https://github.com/earendil-works/pi/pull/11016)）
- 修复 `openai-codex` 提供商列出 `gpt-5.5` 和 `gpt-5.3-codex-spark`，而这些模型始终无法用于 ChatGPT 账户的问题（[@lucasmeijer](https://github.com/lucasmeijer) 贡献的 [#11173](https://github.com/earendil-works/pi/pull/11173)）
- 修复仅含空白的工具输出（例如 bash 返回单独的 `\r\n`）导致 OpenAI Completions、OpenAI Responses 和 Google 请求报出 400 的问题（[#8720](https://github.com/earendil-works/pi/issues/8720)）
- 修复更多网关上游失败、Codex CLI 代理转发的 `stream disconnected before completion` 错误及 Google Vertex OAuth 令牌刷新暂时失败未触发自动重试的问题，并修复请求标识或字节数中的数字导致错误被重试的问题（[#10920](https://github.com/earendil-works/pi/issues/10920)、[#11057](https://github.com/earendil-works/pi/issues/11057)、[#10996](https://github.com/earendil-works/pi/issues/10996)）
- 修复 OpenAI Responses 模型在移除工具后，每次延迟加载工具都会丢失提示词缓存的问题（[#10940](https://github.com/earendil-works/pi/issues/10940)）
- 修复 Cloudflare Workers AI 分类器定价：Clef Flash 每百万输入 token 为 $0.038，Jev 为 $0.042，不再将 Jev 标为免费。
- 修复未闭合的 `$$` 展示数学块吞掉或破坏后续所有 Markdown 表格的问题（[#11159](https://github.com/earendil-works/pi/issues/11159)）
- 修复 CJK 标点旁的 Markdown 粗体和斜体无法渲染的问题（[@theBucky](https://github.com/theBucky) 贡献的 [#10730](https://github.com/earendil-works/pi/pull/10730)）
- 修复 `@` 文件自动补全在查询包含 `[` 或 `(` 等正则元字符时没有结果的问题（[#10972](https://github.com/earendil-works/pi/issues/10972)）

