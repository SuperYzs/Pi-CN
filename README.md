# Pi-CN

[![Checks](https://github.com/SuperYzs/Pi-CN/actions/workflows/check.yml/badge.svg)](https://github.com/SuperYzs/Pi-CN/actions/workflows/check.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Pi 1.0.0](https://img.shields.io/badge/Pi-1.0.0-blue.svg)](https://pi.dev)

**English** | [简体中文](README.zh-CN.md)

Simplified Chinese localization for [Pi](https://pi.dev)'s terminal UI, CLI messages, and native release history, with reversible patches and optional Chinese replies.

## Requirements

- **Pi 1.0.0 installed through npm**, Node.js 22.19.0 or newer, and a writable Pi installation directory.
- Standalone Pi binaries are not supported.

Pi-CN modifies selected core files, including a version-checked uninstall hook, and keeps verified originals for recovery. Conflicting external changes are never silently overwritten.

## Installation

```bash
pi install git:github.com/SuperYzs/Pi-CN
```

Restart Pi to apply localization automatically. After the first application, restart once more to load the localized core interface.

Pi-CN is currently distributed through GitHub; it has not been published to npm.

## Usage

| Command | Description |
| --- | --- |
| `/zh-cn` | Show status, coverage, and essential help |
| `/zh-cn toggle` | Choose whether localization is enabled |
| `/zh-cn replies` | Choose whether replies default to Simplified Chinese |
| `/zh-cn update` | Confirm and update a Git checkout |

Use **↑/↓ to select, Enter to confirm, and Esc to cancel**. The current setting is listed first. File processing runs in the background with a status indicator; the first application may take a few seconds.

Disabling localization restores the original core files and stops automatic application. Restart Pi after changing this setting.

The Chinese-reply preference applies only while localization is enabled. Explicit requests for another language are respected. Disabling the preference removes the plugin's language instruction; other instructions may still request Chinese.

Use Pi's built-in `/changelog` to read localized release notes.

## Updating

```bash
pi update git:github.com/SuperYzs/Pi-CN
```

Git checkouts can also use `/zh-cn update`. Then run `/reload` or restart Pi; fully restart when prompted. Local directory installations use the files in that directory.

After upgrading Pi, update Pi-CN if the new Pi version is reported as unsupported. If support is not available yet, wait for a compatible plugin release. Pinned tags and commits do not automatically move to newer releases. Updates refuse dirty checkouts or unexpected branches rather than discarding changes.

## Coverage

- Supports **Pi 1.0.0** and all **282 releases** included in its changelog, from 0.10.0 to 1.0.0. Historical translations do not imply support for running those older Pi versions.
- UI coverage is still partial. `/zh-cn` reports UI candidates and release-note coverage.
- Commands, configuration keys, model identifiers, and code remain unchanged. Third-party extensions, remote service errors, and web content are outside the guaranteed scope.
- Translations are included with the package. Normal use is offline; installation and updates require network access.

## Uninstalling

**You do not need to turn localization off first.** Exit running Pi sessions, then run:

```bash
pi uninstall git:github.com/SuperYzs/Pi-CN
```

`pi remove` works as well. Pi-CN restores the original files before Pi removes the package and its settings entry. Recovery conflicts abort removal and leave the package installed.

Use the source shown by `pi list` if you installed from a local directory or another source. Add `--local` (`-l`) for a project installation and follow Pi's project-trust prompts. Removing a local source unregisters it; Pi does not delete your source directory.

**Upgrading from an older Pi-CN release?** Restart Pi with this release once so the automatic recovery hook is applied before uninstalling. Manual directory deletion or `npm uninstall` outside Pi does not invoke this hook.

## Recovery

If Pi cannot start, restore from a terminal using your actual installation paths:

```bash
node /path/to/Pi-CN/bin/pi-zh-cn.js restore --root /path/to/node_modules/@earendil-works/pi-coding-agent
```

Backups and recovery files are stored in `~/.pi/agent/pi-zh-cn/` by default. **Do not delete them** while core files are patched. When recovery reports external changes, resolve the conflict or reinstall Pi; do not force unverified files over your installation.

## Feedback and license

[Report a bug or request a feature](https://github.com/SuperYzs/Pi-CN/issues) · [Changelog](CHANGELOG.md) · [Contributing](https://github.com/SuperYzs/Pi-CN/blob/main/CONTRIBUTING.md)

Unofficial Pi package. Licensed under [MIT](LICENSE).
