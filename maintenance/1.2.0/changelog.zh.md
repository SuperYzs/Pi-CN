## [1.2.0] - 2026-10-12

### 新功能

- **按密钥提供 OpenRouter 模型列表**：配置 OpenRouter 密钥后，Pi 仅列出该密钥可用的模型，并显示对应的上下文大小、最大输出和价格，也支持在 `models.json` 中设置的区域端点。参见 [OpenRouter](docs/providers.md#openrouter)。
- **发布配置模式**：在 `settings.json`、`models.json`、键盘绑定和主题中添加 `$schema`，即可获得编辑器校验和补全。参见[设置](docs/settings.md)、[模型](docs/models.md)、[键盘绑定](docs/keybindings.md)和[主题](docs/themes.md)。
- **远程会话剪贴板复制**：当 Pi 无法识别远程会话（例如从另一台机器接入终端复用器）时，`PI_CLIPBOARD_OSC52=1` 可将复制的文本发送到远程客户端剪贴板。参见 [Pi 进程配置](docs/environment-variables.md#pi-process-configuration)。
- **Codemode 改进**：工具声明展示整数、最小值/最大值和默认值等输入约束，codemode 工具行显示已用时间和总耗时。参见 [Codemode](docs/codemode.md)。
- **扩展触发的运行也支持 `before_agent_start`**：通过 `pi.sendMessage(..., { triggerTurn: true })` 启动的运行与用户提示词经过相同的准备流程。参见[事件与并发](docs/extensions.md#events-and-concurrency)。

### 不兼容变更

- 在 `https://pi.dev/schemas/*.schema.json` 发布生成的模型、设置、键盘绑定和主题配置模式。主题模式已迁移至 `https://pi.dev/schemas/theme.schema.json`；启动时加载的主题现在与之后重新加载时执行相同的模式校验。请更新主题的 `$schema` 引用，在 `vars` 下定义可复用颜色，并移除不支持的元数据（[#9880](https://github.com/earendil-works/pi/pull/9880)、[#10751](https://github.com/earendil-works/pi/pull/10751)，由 [@christianklotz](https://github.com/christianklotz) 贡献）
- 调整 `before_agent_start`，在空闲时通过 `pi.sendMessage(..., { triggerTurn: true })` 启动运行也会触发。`BeforeAgentStartEvent` 现在是按 `messageType` 区分的联合类型：`"user"` 事件携带 `prompt` 和 `images`，`"custom"` 事件携带启动运行的 `message`，不含 `prompt`。处理器返回的消息会加入这两类运行，待处理的 `deliverAs: "nextTurn"` 消息也会随自定义消息运行一起投递。仅应处理用户提示词的处理器必须检查 `event.messageType === "user"`（[#10267](https://github.com/earendil-works/pi/issues/10267)、[#5581](https://github.com/earendil-works/pi/issues/5581)、[#10739](https://github.com/earendil-works/pi/pull/10739)，由 [@davidbrai](https://github.com/davidbrai) 贡献）
- 会话从运行启动阶段起即视为忙碌，包括执行 `before_agent_start` 处理器期间：`ctx.isIdle()` 为 false；`pi.sendMessage()` 会排入正在启动的运行，而不是启动第二个运行并报出 "Agent is already processing"；`pi.sendUserMessage()` 必须指定 `deliverAs`；此时请求中止，会在运行启动后立即中止（[#10739](https://github.com/earendil-works/pi/pull/10739)，由 [@davidbrai](https://github.com/davidbrai) 贡献）
- 调整 `pi mcp list --json`，对提供资源的服务器报告 `resources: true`，不再报告 `resources` 和 `resourceTemplates` 数量；Pi 连接时不再枚举资源（[#10526](https://github.com/earendil-works/pi/issues/10526)）

### 新增

- 为工具定义新增 `reachesTools`，使能够调用其他工具的工具（如 `codemode` 和 `tool_search`）声明一次调用可能触达哪些工具；MCP 扩展据此等待调用所需的服务器，并判断替代的 `codemode` 或 `tool_search` 工具能否触达 MCP 工具
- 为工具命名空间新增 `aliases`；codemode 的 `describeNamespace()` 和 `searchTools()` 的 `namespace` 选项均支持匹配别名，MCP 命名空间使用服务器名称作为别名
- 新增按密钥提供的 OpenRouter 模型列表：配置 OpenRouter 密钥后，Pi 仅列出该密钥可用的聊天模型，并显示对应的上下文大小、最大输出和价格，支持防护规则以及通过 `models.json` 基础 URL 设置的区域端点。列表会保存并供离线使用（[#10353](https://github.com/earendil-works/pi/issues/10353)、[#10672](https://github.com/earendil-works/pi/pull/10672)，由 [@davidbrai](https://github.com/davidbrai) 贡献）
- 新增 `PI_CLIPBOARD_OSC52=1`，在写入本地剪贴板后通过 OSC 52 将复制文本发送到终端，使 Pi 无法识别远程会话时也能复制到远程客户端剪贴板，例如从另一台机器接入终端复用器或使用远程 IDE 守护进程（[#10826](https://github.com/earendil-works/pi/issues/10826)、[#10835](https://github.com/earendil-works/pi/issues/10835)、[#10114](https://github.com/earendil-works/pi/issues/10114)）
- codemode 工具行现在与 bash 工具行一样，在脚本运行时显示已用时间，结束后显示总耗时（[#10708](https://github.com/earendil-works/pi/issues/10708)）

### 变更

- 调整 `showHardwareCursor` 设置，启用后仅使用终端光标，不再同时绘制 Pi 的反色视频光标
- 调整 codemode 工具声明，通过属性注释中的 `@` 标签展示整数、最小值/最大值、长度、模式和默认值等输入约束，使脚本无需依赖工具描述中的重复说明即可获得约束（[#10707](https://github.com/earendil-works/pi/issues/10707)）
- 调整 codemode 中 MCP 工具的声明，明确展开结果类型（`content`、`structuredContent`、`isError`），不再引用此前在 `describeTool()`、`searchTools()` 和 `ALL_TOOLS` 中展示却未定义的 `CallToolResult<T>`；codemode 描述也不再包含共享 MCP 类型
- 调整 `serializeConversation()`（用于压缩、分支摘要和错误报告），不再包含思考块；重放的思考内容通常不在当前上下文中，包含这些内容可能使摘要请求超过被摘要上下文的大小并导致失败

### 修复

- 修复 codemode 忽略不在脚本首行的 `// @options:`，导致脚本未使用请求的 `timeout_ms` 运行的问题；现在会在执行脚本前报错（[#10631](https://github.com/earendil-works/pi/issues/10631)）
- 修复 Mistral 流式输出在请求超时后于生成过程中中断的问题（例如长时间思考）；现在超时仅适用于等待响应头（[#10609](https://github.com/earendil-works/pi/issues/10609)）
- 修复主仓库内部嵌套的 git worktree 中，符号链接形式的 `AGENTS.md` 导致项目上下文文件完全未加载的问题（[#10681](https://github.com/earendil-works/pi/issues/10681)）
- 修复代码模式工具描述错误声称所有失败的工具调用都会拒绝的问题；声明了输出模式的工具即使失败也会返回其值（例如以非零退出码结束的 `bash`）
- 修复通过 `pi.sendMessage(..., { triggerTurn: true })` 启动的运行，在首次工具调用后移除由 `before_agent_start` 添加的系统提示词章节，导致运行中提示词变化并使提供商提示词缓存每次运行失效两次的问题（[#10267](https://github.com/earendil-works/pi/issues/10267)、[#10739](https://github.com/earendil-works/pi/pull/10739)，由 [@davidbrai](https://github.com/davidbrai) 贡献）
- 修复包含大量 `text()` 调用的脚本结束后，codemode 仍会阻塞进程数秒至数分钟的问题；此前合并输出项的耗时为平方级（[#10678](https://github.com/earendil-works/pi/issues/10678)）
- 修复打印模式（`-p`）在最终回复被模型输出 token 上限截断时，未警告却以 0 退出的问题；现在会输出已生成部分，向 stderr 写入警告，并以 1 退出（[#10799](https://github.com/earendil-works/pi/issues/10799)）
- 修复 `pi mcp login --help` 和 CLI 文档将 `--timeout` 仅描述为等待浏览器时长的问题；该参数限制整个登录过程（[#10636](https://github.com/earendil-works/pi/issues/10636)）
- 修复 `extensions`、`skills`、`prompts` 和 `themes` 设置的 `!pattern`、`+path`、`-path` 项中未展开 `~`，导致 `!~/skills/pdf` 等项无法匹配任何内容的问题（[#10765](https://github.com/earendil-works/pi/issues/10765)）
- 修复提供资源的 MCP 服务器必须枚举完所有资源后才注册工具的问题；Pi 连接时不再枚举资源，`/mcp` 和 `pi mcp list` 改为显示服务器是否提供资源，而不是统计数量（[#10526](https://github.com/earendil-works/pi/issues/10526)）
- 修复服务器返回非对象结构化内容（数组、`null` 或原始值，MCP 2026-07-28 已允许）时 MCP 工具调用失败的问题；未声明输出模式的 MCP 工具，其 codemode 声明现在将 `structuredContent` 类型设为 `unknown`，而非对象（[#10416](https://github.com/earendil-works/pi/issues/10416)）
- 修复 Windows 上前一个锁目录仍在删除时，读取或写入 `auth.json` 报出 `EPERM` 的问题；现在 Pi 会短暂重试后再报告错误（[#10801](https://github.com/earendil-works/pi/issues/10801)）
- 修复 `openrouter/auto` 等 OpenRouter 路由模型显示每 1M token 费用为 -$1,000,000 的问题；OpenRouter 的负数占位价格现在按 0 处理（[#10672](https://github.com/earendil-works/pi/pull/10672)，由 [@davidbrai](https://github.com/davidbrai) 贡献）
- 修复 Anthropic 因语法大小、工具数量或联合类型限制而拒绝严格工具集时请求失败的问题；Pi 现在会将首选工具设为非严格模式后重试一次（[#10409](https://github.com/earendil-works/pi/issues/10409)）
- 修复未将 "The upstream provider returned an error" 作为暂时性提供商错误重试的问题（[#10842](https://github.com/earendil-works/pi/issues/10842)）
- 修复获得焦点的全屏浮层阻止鼠标滚轮滚动对话记录的问题（[#10769](https://github.com/earendil-works/pi/issues/10769)）
- 修复分片到达的终端颜色响应将十六进制值泄漏到输入提示中并打开外部编辑器的问题（相关报告：[#10256](https://github.com/earendil-works/pi/issues/10256)、[#10657](https://github.com/earendil-works/pi/issues/10657)）
- 修复从 1.1.0 起 Herdr 中行内图片无法渲染的问题（[#10774](https://github.com/earendil-works/pi/pull/10774)，由 [@ogulcancelik](https://github.com/ogulcancelik) 贡献）
- 修复 Kitty 键盘协议或 modifyOtherKeys 下，引用 Shift 符号的按键绑定（例如 `+` 或 `ctrl++`）无法匹配的问题（[#9880](https://github.com/earendil-works/pi/pull/9880)，由 [@christianklotz](https://github.com/christianklotz) 贡献）
- 修复自定义编辑器内嵌的压缩状态指示器使用默认弱化颜色，而非像工作指示器那样使用编辑器边框或思考级别颜色的问题（[#10809](https://github.com/earendil-works/pi/issues/10809)、[#10810](https://github.com/earendil-works/pi/pull/10810)，由 [@Jay-Madden](https://github.com/Jay-Madden) 贡献）
- 修复 MCP 工具调用在等待 OAuth 刷新时已取消或超时，却仍在刷新完成后发送到服务器的问题（[#10598](https://github.com/earendil-works/pi/issues/10598)）
- 修复 MCP OAuth 登录接受带有 `iss` 参数的授权响应，却因未发现授权服务器元数据而无法校验该参数的问题；现在会以签发者不匹配为由拒绝登录。由 [@AizenvoltPrime](https://github.com/AizenvoltPrime) 报告
- 修复在 Node 24 或 26 下使用 `node --watch` 运行 Pi 时，codemode 因桥接损坏错误而失败的问题（[#10725](https://github.com/earendil-works/pi/issues/10725)）

### 移除

- 移除尚未发布的实验性服务器、客户端和插件栈（`src/experimental`、`src/cli/experimental`），以及仅在源码中提供的 `./client` 和 `./experimental/plugin` 导出；这些内容均未包含在已发布的包中。其使用的 `@earendil-works/pi-client`、`@earendil-works/pi-protocol` 和 `@earendil-works/pi-server` 包也已移除，不再发布
- 移除对 `@earendil-works/chord` 的依赖

