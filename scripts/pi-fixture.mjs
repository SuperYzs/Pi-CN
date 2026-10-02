import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, realpathSync, symlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';

// Keep copied Pi SDK imports resolvable with both global npm's nested layout
// and ordinary npm installs' hoisted layout. Never copy or mutate dependencies.
export function linkPiDependencies(original, copy) {
  const manifest = JSON.parse(readFileSync(join(original, 'package.json'), 'utf8'));
  const resolver = createRequire(join(original, 'package.json'));
  for (const name of Object.keys(manifest.dependencies ?? {})) {
    const directory = resolver.resolve.paths(name)?.map((base) => join(base, name)).find((path) => existsSync(join(path, 'package.json')));
    if (!directory) throw new Error(`Pi dependency is not installed: ${name}`);
    const target = join(copy, 'node_modules', name);
    mkdirSync(dirname(target), { recursive: true });
    symlinkSync(realpathSync(directory), target, process.platform === 'win32' ? 'junction' : 'dir');
  }
}
