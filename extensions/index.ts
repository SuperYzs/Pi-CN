import { getPackageDir, type ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Patcher } from '../lib/patcher.js';
import { defaultDataDir } from '../lib/storage.js';
import { registerChineseUI } from '../lib/ui.js';

export default function (pi: ExtensionAPI) {
  const dataDir = defaultDataDir();
  registerChineseUI(pi, {
    dataDir,
    packageRoot: dirname(dirname(fileURLToPath(import.meta.url))),
    patcher: () => new Patcher(process.env.PI_ZH_CN_ROOT || getPackageDir(), dataDir),
  });
}
