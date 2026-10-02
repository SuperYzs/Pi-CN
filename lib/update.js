import { resolve } from 'node:path';
import { PACKAGE_SOURCE } from './releases.js';

export function isProjectRemote(remote) {
  return /^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/|ssh:\/\/git@ssh\.github\.com(?::443)?\/)(?:SuperYzs\/Pi-CN)(?:\.git)?\/?$/i.test(remote.trim());
}
export async function updatePackage(root, exec) {
  const run = async (args) => {
    const result = await exec('git', ['-C', root, ...args], { timeout: 120000 });
    if (result.code !== 0) throw new Error(result.stderr?.trim() || `Git 更新失败，请使用 pi update ${PACKAGE_SOURCE}`);
    return result.stdout.trim();
  };
  const top = await run(['rev-parse', '--show-toplevel']);
  if (resolve(top) !== resolve(root)) throw new Error('插件目录不是仓库根目录，拒绝更新父级仓库');
  const origin = await run(['remote', 'get-url', 'origin']);
  if (!isProjectRemote(origin)) throw new Error('origin 不是 SuperYzs/Pi-CN，拒绝更新其他仓库');
  if (await run(['status', '--porcelain'])) throw new Error('插件仓库存在未提交修改，请先提交或手动处理。不会自动覆盖或暂存。');
  const branch = await run(['branch', '--show-current']);
  if (branch !== 'main') throw new Error(`只自动更新 main 分支。固定标签或其他分支请使用 pi update ${PACKAGE_SOURCE}，或手动更新。`);
  const before = await run(['rev-parse', 'HEAD']);
  await run(['pull', '--ff-only', 'origin', 'main']);
  const after = await run(['rev-parse', 'HEAD']);
  return { updated: before !== after, commit: after };
}
