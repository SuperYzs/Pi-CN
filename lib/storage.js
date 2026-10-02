import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, renameSync, unlinkSync, statSync, existsSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';

export const hash = (text) => createHash('sha256').update(text).digest('hex');
export const defaultDataDir = () => join(resolve(process.env.PI_CODING_AGENT_DIR || join(homedir(), '.pi', 'agent')), 'pi-zh-cn');
export function readJSON(file, fallback) {
  if (!existsSync(file)) return fallback;
  return JSON.parse(readFileSync(file, 'utf8')); // Corruption is an error, not a silent reset.
}
export function atomicWrite(file, content, mode) {
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  const tmp = join(dirname(file), `.pi-zh-cn-${randomUUID()}.tmp`);
  try {
    writeFileSync(tmp, content, { flag: 'wx', mode: mode ?? (existsSync(file) ? statSync(file).mode & 0o777 : 0o600) });
    renameSync(tmp, file);
  } finally {
    if (existsSync(tmp)) unlinkSync(tmp);
  }
}
export const writeJSON = (file, value) => atomicWrite(file, JSON.stringify(value, null, 2) + '\n');

export function withLock(dir, work) {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const lock = join(dir, 'lock');
  try { mkdirSync(lock); } catch (error) {
    if (error.code === 'EEXIST') throw new Error(`另一个汉化操作正在运行；若上次异常退出，请确认没有汉化进程后删除 ${lock}`);
    throw error;
  }
  try {
    writeJSON(join(lock, 'owner.json'), { pid: process.pid, createdAt: new Date().toISOString() });
    const result = work();
    if (result && typeof result.then === 'function') throw new Error('补丁锁内不能执行异步操作');
    return result;
  } finally { rmSync(lock, { recursive: true }); }
}
