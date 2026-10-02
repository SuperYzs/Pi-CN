// Dependency-light recovery: also copied with storage.js to the private backup
// directory so native uninstall does not rely on files it is about to delete.
import { existsSync, readFileSync, lstatSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { hash, readJSON, writeJSON, atomicWrite, withLock } from './storage.js';

export function safeTarget(root, name) {
  if (!name || name.includes('\\') || name.split('/').includes('..') || name.startsWith('/')) throw new Error('不安全的备份路径');
  const target = join(root, name);
  if (name !== 'CHANGELOG.md' && !(name.startsWith('dist/') && name.endsWith('.js'))) throw new Error('不允许的补丁目标');
  let path = target;
  while (path !== root) {
    if (existsSync(path) && lstatSync(path).isSymbolicLink()) throw new Error(`拒绝修改符号链接：${path}`);
    path = dirname(path);
  }
  return target;
}
export function readState(root, dir) {
  const state = readJSON(join(dir, 'state.json'), { schema: 1, root, files: {} });
  if (state.schema !== 1 || state.root !== root || !state.files || typeof state.files !== 'object') throw new Error('备份清单无效');
  for (const [name, record] of Object.entries(state.files)) {
    safeTarget(root, name);
    if (!record || !/^[a-f0-9]{64}$/.test(record.originalHash) || !/^[a-f0-9]{64}$/.test(record.patchedHash)
        || (record.previousPatchedHash && !/^[a-f0-9]{64}$/.test(record.previousPatchedHash))) throw new Error('备份摘要无效');
  }
  return state;
}
export function restoreInstallation(root, dir) {
  return withLock(dir, () => {
    const state = readState(root, dir);
    const previous = structuredClone(state);
    const version = readJSON(join(root, 'package.json'), {}).version;
    const restores = [], stale = [];
    for (const [name, record] of Object.entries(state.files)) {
      const target = safeTarget(root, name);
      if (!existsSync(target)) { stale.push(name); continue; }
      const current = readFileSync(target, 'utf8');
      const digest = hash(current);
      if (digest === record.originalHash) { stale.push(name); continue; }
      if (digest !== record.patchedHash && digest !== record.previousPatchedHash) {
        if (record.version !== version) { stale.push(name); continue; }
        throw new Error(`文件已被修改，拒绝恢复：${name}`);
      }
      const original = readFileSync(join(dir, 'originals', `${record.originalHash}.txt`), 'utf8');
      if (hash(original) !== record.originalHash) throw new Error(`原始备份损坏：${name}`);
      restores.push({ name, original, current });
    }
    // Preflight finishes before any write. Recheck immediately before restoring.
    for (const { name, current } of restores) {
      if (readFileSync(safeTarget(root, name), 'utf8') !== current) throw new Error(`文件在恢复期间被修改，拒绝覆盖：${name}`);
    }
    try {
      for (const { name, original } of restores) atomicWrite(safeTarget(root, name), original);
      for (const { name } of restores) delete state.files[name];
      for (const name of stale) delete state.files[name];
      writeJSON(join(dir, 'state.json'), state);
    } catch (error) {
      for (const { name, current } of restores) atomicWrite(safeTarget(root, name), current);
      writeJSON(join(dir, 'state.json'), previous);
      throw error;
    }
    return { restoredFiles: restores.length, skippedOldFiles: stale.length };
  });
}
