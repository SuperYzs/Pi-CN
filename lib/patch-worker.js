import { parentPort, workerData } from 'node:worker_threads';
import { Patcher } from './patcher.js';

if (parentPort) {
  try {
    const { root, dataDir, catalog, action } = workerData;
    if (!['apply', 'restore', 'status'].includes(action)) throw new Error('不支持的汉化操作');
    const patcher = new Patcher(root, dataDir, { catalog });
    parentPort.postMessage({ ok: true, result: patcher[action]() });
  } catch (error) {
    parentPort.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}
