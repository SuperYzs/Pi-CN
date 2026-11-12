## [1.5.2] - 2026-11-10

### 新功能

- **原文件夹丢失时分叉会话**：会话的原始文件夹被移动或删除后，现在可以将其分叉到当前文件夹，不必仅临时继续，下次恢复也不再询问。参见 [Continue or switch sessions](docs/sessions.md#continue-or-switch-sessions)。

### 变更

- 会话工作目录不存在时（例如项目文件夹被重命名后），交互模式现在提供 `Continue`、`Fork` 和 `Cancel`，而非只能继续。`Continue` 与以前一样，在当前目录运行但不保存选择；`Fork` 则像 `--fork` 一样，将会话复制到当前目录，创建具有新 ID 的会话，下次恢复不再询问。适用于启动时的 `--session`、`--resume`、`/resume`、`/import` 以及扩展的 `ctx.switchSession()` ([#11975](https://github.com/earendil-works/pi/pull/11975) by [@petrroll](https://github.com/petrroll), fixes [#11060](https://github.com/earendil-works/pi/issues/11060))

### 修复

- 修复 `/import` 工作目录已不存在的会话后，在会话目录遗留副本，以及继续会话后留下两个相同 ID 的副本（`s.jsonl` 和 `s-1.jsonl`）的问题；失败的副本现在会被删除 ([#11975](https://github.com/earendil-works/pi/pull/11975) by [@petrroll](https://github.com/petrroll), fixes [#11060](https://github.com/earendil-works/pi/issues/11060))
- 修复 Anthropic OAuth 请求报告过时的 Claude Code 版本

