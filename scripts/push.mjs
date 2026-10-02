import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isProjectRemote } from '../lib/update.js';

const root = fileURLToPath(new URL('..', import.meta.url));
function run(command, args, capture = false) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit', timeout: 120000 });
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr || `${command} 执行失败`);
  return result.stdout?.trim();
}
try {
  if (!isProjectRemote(run('git', ['remote', 'get-url', 'origin'], true))) throw new Error('origin 必须指向 SuperYzs/Pi-CN');
  if (run('git', ['branch', '--show-current'], true) !== 'main') throw new Error('只允许发布 main 分支');
  if (run('git', ['status', '--porcelain'], true)) throw new Error('请先审阅并提交改动；发布脚本不会自动提交用户文件');
  run('npm', ['test']);
  run('npm', ['run', 'check']);
  run('git', ['push', 'origin', 'main']);
  console.log('已同步至 https://github.com/SuperYzs/Pi-CN');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
