## [1.0.2] - 2026-10-04

### 新功能

- **按思考级别设置采样参数** — `models.json` 中的 `samplingParamsByThinkingLevel` 可为 OpenAI 兼容 APIs 的各个思考级别设置 `temperature`、`top_p` 等采样参数。参见[按思考级别配置采样参数](docs/models.md#configure-sampling-by-thinking-level)。

### 新增

- 在 `models.json` 中新增 `samplingParamsByThinkingLevel`，支持为 OpenAI 兼容 APIs 按思考级别覆盖采样参数。参见[按思考级别配置采样参数](docs/models.md#configure-sampling-by-thinking-level)（[#9776](https://github.com/earendil-works/pi/pull/9776)，由 [@mrexodia](https://github.com/mrexodia) 贡献）

