## [1.0.2] - 2026-10-04

### New Features

- **Sampling by thinking level** — `samplingParamsByThinkingLevel` in `models.json` sets sampling parameters such as `temperature` and `top_p` for each thinking level on OpenAI-compatible APIs. See [Configure sampling by thinking level](docs/models.md#configure-sampling-by-thinking-level).

### Added

- Added `samplingParamsByThinkingLevel` to `models.json` for per-thinking-level sampling parameter overrides on OpenAI-compatible APIs. See [Configure sampling by thinking level](docs/models.md#configure-sampling-by-thinking-level) ([#9776](https://github.com/earendil-works/pi/pull/9776) by [@mrexodia](https://github.com/mrexodia))

