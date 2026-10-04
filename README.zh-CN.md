# Pi-CN

[![检查](https://github.com/SuperYzs/Pi-CN/actions/workflows/check.yml/badge.svg)](https://github.com/SuperYzs/Pi-CN/actions/workflows/check.yml)
[![MIT 协议](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Pi 1.0.0–1.0.2](https://img.shields.io/badge/Pi-1.0.0--1.0.2-blue.svg)](https://pi.dev)

[English](README.md) | **简体中文**

为 [Pi](https://pi.dev) 的终端界面、命令行提示和原生更新公告提供简体中文，支持恢复原文件，并可选择默认中文回复。

## 环境要求

- **通过 npm 安装的 Pi 1.0.0、1.0.1 或 1.0.2**、Node.js 22.19.0 或更新版本，且 Pi 安装目录可写。
- 暂不支持独立二进制版 Pi。

Pi-CN 会修改选定的核心文件，包括经过版本检查的卸载恢复钩子，并保存已验证的原文备份。文件被其他工具修改时，不会静默覆盖。

## 安装

```bash
pi install git:github.com/SuperYzs/Pi-CN
```

重新启动 Pi 后会自动应用汉化；首次应用后，再重启一次使核心界面生效。

目前通过 GitHub 分发，尚未发布到 npm。

## 使用

| 命令 | 作用 |
| --- | --- |
| `/zh-cn` | 查看状态、覆盖情况和简要说明 |
| `/zh-cn toggle` | 选择开启或关闭汉化 |
| `/zh-cn replies` | 选择是否默认使用简体中文回复 |
| `/zh-cn update` | 确认后更新 Git 仓库安装的插件 |

使用 **↑/↓ 选择、Enter 确认、Esc 取消**，当前设置放在首项并标注。文件处理在后台进行，并显示处理状态；首次开启可能需要几秒。

关闭汉化会恢复核心原文件并停止自动应用；切换后请重启 Pi。

默认中文回复仅在汉化开启时生效；你指定其他语言时仍会遵从。关闭中文回复偏好只移除插件的语言要求，其他指令仍可能要求使用中文。

更新公告直接使用 Pi 的 `/changelog` 查看。

## 更新

```bash
pi update git:github.com/SuperYzs/Pi-CN
```

Git 仓库安装也可使用 `/zh-cn update`。更新后运行 `/reload` 或重启 Pi；提示需要重启时，请完全退出后再启动。本地目录安装直接使用该目录中的文件。

升级 Pi 后若提示版本未适配，请先更新插件；若仍未适配，需等待兼容版本发布。固定标签或提交不会自动切换到新版本。仓库存在未提交修改或分支不符合要求时，更新会中止，不会丢弃你的改动。

Pi-CN **0.6.1** 对应 Pi **1.0.2**。此后 Pi 1.0.x 每递增一个补丁版本，Pi-CN 0.6.y 的补丁版本也递增一次（例如 Pi 1.0.3 → Pi-CN 0.6.2）。新 Pi 版本仍需经过明确适配，不会仅根据版本号自动批准。

## 支持范围

- 支持 **Pi 1.0.0、1.0.1 和 1.0.2**。Pi 1.0.2 随包提供的全部 **284 个版本**公告均已汉化（0.10.0 至 1.0.2）；Pi 1.0.1 和 1.0.0 分别保持 283 和 282 个版本的公告覆盖。历史公告中文化不代表支持运行这些旧版 Pi。
- 界面覆盖仍为部分汉化。Pi 1.0.1 和 1.0.2 均已维护 **856/881 个候选**；其余技术标记、命令示例和路径保持原样。`/zh-cn` 会显示实际安装的界面候选及公告覆盖情况。
- 命令、配置键、模型标识和代码保持原样；第三方扩展、远程服务错误和网页不在保证范围内。
- 译文随插件提供，正常使用不需要联网；安装和更新需要联网。

## 卸载

**不需要先关闭汉化。** 完全退出正在运行的 Pi 会话，然后执行：

```bash
pi uninstall git:github.com/SuperYzs/Pi-CN
```

`pi remove` 同样可用。插件先恢复原文件，随后由 Pi 移除插件和安装配置。恢复遇到冲突时会中止卸载，保留插件。

如果通过本地目录或其他来源安装，请使用 `pi list` 显示的实际来源。项目级安装加 `--local`（`-l`），并遵从 Pi 的项目信任提示。本地来源只会取消注册，Pi 不会删除你的源码目录。

**从旧版 Pi-CN 更新时**，请先用新版重新启动 Pi 一次，使自动恢复钩子生效，再卸载。手动删除插件目录或在 Pi 之外执行 `npm uninstall` 不会触发此钩子。

## 应急恢复

如果 Pi 无法启动，可以从终端恢复。将路径替换为实际安装位置：

```bash
node /path/to/Pi-CN/bin/pi-zh-cn.js restore --root /path/to/node_modules/@earendil-works/pi-coding-agent
```

备份及恢复文件默认保存在 `~/.pi/agent/pi-zh-cn/`。核心文件仍处于汉化状态时，**不要删除这些文件**。遇到外部修改提示，请先处理冲突或重装 Pi，不要强行覆盖。

## 反馈与协议

[反馈问题或建议](https://github.com/SuperYzs/Pi-CN/issues) · [更新记录](CHANGELOG.zh-CN.md) · [参与贡献](https://github.com/SuperYzs/Pi-CN/blob/main/CONTRIBUTING.md)

本项目非 Pi 官方项目，采用 [MIT 协议](LICENSE)。
