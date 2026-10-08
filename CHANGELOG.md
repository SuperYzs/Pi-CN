# Changelog

**English** | [简体中文](CHANGELOG.zh-CN.md)

## 0.7.0

- Support Pi 1.1.0 with 863/888 maintained UI candidates, including restart hints, program status, and updated tool-selection help.
- Translate all 287 bundled releases, adding Pi 1.0.3, 1.0.4, and 1.1.0 without changing the previous 284 translations.
- Recognize Pi's managed launcher for emergency CLI operations; validate install metadata and version pointers without executing the launcher or selecting a fallback installation.
- Review the new bundle uninstall entry while retaining SDK recovery safeguards and Pi 1.0.0–1.0.2 resources.
- Pair Pi 1.1.0 with Pi-CN 0.7.0; Pi minor upgrades increment the plugin minor and reset its patch, while patch upgrades increment the plugin patch (Pi 1.1.1 → Pi-CN 0.7.1).

## 0.6.1

- Support npm-installed Pi 1.0.2, with reviewed bundle/SDK uninstall recovery and unchanged 856/881 UI-candidate coverage.
- Translate all 284 bundled release announcements, including per-thinking-level sampling overrides; preserve configuration keys, code, links, and earlier translations.
- Keep Pi 1.0.0 and 1.0.1 compatibility. Pair Pi 1.0.2 with Pi-CN 0.6.1, then increment the plugin patch number for each subsequent Pi 1.0.x patch release.

## 0.6.0

- Support npm-installed Pi 1.0.1 while retaining Pi 1.0.0 compatibility and version-checked native uninstall recovery.
- Maintain 856/881 Pi 1.0.1 UI candidates, including OAuth URL copying, MCP project overrides, CLI help, and settings; preserve technical tags and command examples.
- Include all 283 release announcements shipped with Pi 1.0.1, keeping earlier translations and protected technical content intact.
- Refuse localization when a reviewed uninstall entry is missing, and clarify that manual recovery is not required before native uninstall.

## 0.5.0

- Restore original core files automatically before native `pi uninstall` or `pi remove`; no manual localization switch is required.
- Keep trust checks, installation-source handling, and removal under Pi's control. Recovery conflicts abort removal.
- Verify uninstall entry-point hashes for each supported Pi version and retain standalone recovery files alongside backups.
- Make the default README and changelog English, with linked Simplified Chinese documentation.
- Add contribution guidance, issue templates, and native-uninstall integration checks.

## 0.4.0

- Process localization changes in a background worker with status feedback to keep the interface responsive.
- Reuse verified patch plans for repeated application and re-enabling after restoration.
- Include Chinese translations of all 282 releases shipped with Pi 1.0.0, preserving code, commands, links, and version dates.
- Match release notes with previously localized headings or Windows line endings.
- Show UI-candidate and release-note coverage in `/zh-cn`.
- Refuse to overwrite files edited or upgraded during preparation; preserve settings on failure.

## 0.3.0

- Simplify installation, settings, update, and recovery documentation.
- Consolidate status and essential help under `/zh-cn`.
- Use keyboard selectors with confirmation and cancellation for `/zh-cn toggle` and `/zh-cn replies`.
- Restore original files when localization is disabled; preserve settings on cancellation or failure.
- Remove redundant command aliases; use `/zh-cn toggle` to enable, disable, or reapply localization.

## 0.2.0

- Include Chinese UI resources and the complete current-release announcement for Pi 1.0.0.
- Prompt users to update the plugin for unsupported Pi versions.
- Add `/zh-cn update` for safe plugin updates.
- Preserve backup and recovery capabilities.

## 0.1.1

- Fix a localization operation error.

## 0.1.0

- Initial release with UI localization and backup-based recovery.
