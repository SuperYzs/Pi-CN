# Contributing

Bug reports, translation corrections, compatibility reports, and pull requests are welcome. You may write issues in English or Simplified Chinese.

## Reporting problems

Include your Pi and Pi-CN versions, operating system, installation source, reproducible steps, and the relevant error message. Redact private paths where appropriate. Never include credentials, private conversations, or backup contents.

## Pull requests

- Keep changes focused and include regression tests for behavior changes.
- Keep English and Simplified Chinese user documentation synchronized.
- Preserve command names, configuration keys, executable code, links, and template-expression order when correcting translations.
- Do not remove safety checks or force recovery over external modifications.
- Do not include generated package archives, user data, or installed dependencies.

Install development dependencies with `npm ci --ignore-scripts --omit=peer`, then run `npm test` and `npm run check`.

Integration checks require a supported npm Pi installation. Both commands below operate on temporary copies, not the original installation:

```bash
npm run smoke -- /path/to/node_modules/@earendil-works/pi-coding-agent
npm run smoke:uninstall -- /path/to/node_modules/@earendil-works/pi-coding-agent
```

Contributions are licensed under the project's [MIT license](LICENSE).
