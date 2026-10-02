import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';

export function runWorker(patcher, action) {
  if (!['apply', 'restore', 'status'].includes(action)) return Promise.reject(new Error('不支持的汉化操作'));
  return new Promise((resolve, reject) => {
    const worker = new Worker(fileURLToPath(new URL('./patch-worker.js', import.meta.url)), {
      workerData: { root: patcher.root, dataDir: patcher.dataDir, catalog: patcher.catalog, action },
      execArgv: [], stdout: true, stderr: true,
    });
    let settled = false;
    worker.stdout.on('data', () => {}); // Never leak ordinary output into the RPC protocol.
    worker.stderr.on('data', () => {});
    worker.on('message', (message) => {
      if (settled) return;
      settled = true;
      if (message.ok) resolve(message.result);
      else reject(new Error(message.error));
    });
    worker.once('error', (error) => { settled = true; reject(error); });
    worker.once('exit', (code) => {
      if (!settled) reject(new Error(`汉化任务异常退出（${code}）`));
    });
  });
}
