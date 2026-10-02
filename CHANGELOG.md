# 更新记录

## 0.2.0

- 改为发布时维护并内置中文资源，彻底移除运行时模型翻译及模型接口调用。
- 内置 Pi 1.0.0 的完整本版中文公告，并补充静态界面词库。
- 对未适配 Pi 版本拒绝补丁并提示更新插件。
- 增加 `/zh-cn update`，仅允许固定仓库 origin/main 的安全 fast-forward。
- 增加维护阶段的 `prepare:pi`、`build:pi`、发布校验与 `release:push`。
- 固定后续发布与同步地址为 https://github.com/SuperYzs/Pi-CN。
- 保留备份恢复与旧命令兼容；旧的模型译文缓存不再覆盖内置资源。

## 0.1.1

- 修复 ModelRegistry 与 ModelRuntime 接口差异导致的模型翻译调用错误。

## 0.1.0

- 初始补丁包，支持界面词库、公告按需模型翻译、缓存、备份及恢复。
