import { parseJS } from './syntax.js';

function visit(node, fn) {
  if (!node || typeof node.type !== 'string') return;
  fn(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) for (const child of value) visit(child, fn);
    else if (value && typeof value === 'object') visit(value, fn);
  }
}
export function insertUninstallHook(source, hookURL, context, tree = parseJS(source)) {
  const sites = [];
  visit(tree, (node) => {
    if (!['ClassDeclaration', 'ClassExpression'].includes(node.type)) return;
    const methods = node.body.body.filter((method) => method.type === 'MethodDefinition' && method.kind === 'method');
    const named = (method, name) => new RegExp(`^(?:async\\s+)?${name}\\s*\\(`).test(source.slice(method.start, method.value.body.start).trim());
    if (!['getInstalledPath', 'removeAndPersist', 'parseSource'].every((name) => methods.some((method) => named(method, name)))) return;
    for (const method of methods.filter((method) => named(method, 'remove'))) {
      const fn = method.value;
      if (!fn.async || fn.params.length !== 2 || fn.params.some((param) => param.type !== 'Identifier')) throw new Error('Pi 卸载方法签名未适配');
      const trusted = fn.body.body.filter((statement) => statement.type === 'ExpressionStatement')
        .flatMap((statement) => statement.expression.type === 'SequenceExpression' ? statement.expression.expressions : [statement.expression])
        .filter((call) => call.type === 'CallExpression' && call.callee.type === 'MemberExpression'
          && call.callee.object.type === 'ThisExpression' && !call.callee.computed
          && call.callee.property.name === 'assertProjectTrustedForScope'
          && call.arguments.length === 1 && call.arguments[0].type === 'Identifier');
      if (trusted.length !== 1) throw new Error('Pi 卸载信任检查未适配');
      const call = trusted[0];
      sites.push({ at: call.end, source: fn.params[0].name, scope: call.arguments[0].name });
    }
  });
  if (sites.length !== 1) throw new Error('Pi 卸载入口缺失或不唯一，拒绝修改');
  const site = sites[0];
  const call = `, /* pi-zh-cn: native uninstall recovery */ await (async () => {
    const installed = this.getInstalledPath(${site.source}, ${site.scope});
    if (!installed) return;
    const fs = await import("node:fs");
    const actual = fs.realpathSync(installed);
    const packageRoot = ${JSON.stringify(context.packageRoot)};
    const entry = (await import("node:path")).join(packageRoot, "extensions/index.ts");
    if (actual !== packageRoot && !(fs.existsSync(entry) && actual === fs.realpathSync(entry))) return;
    await (await import(${JSON.stringify(hookURL)})).restoreInstallation(${JSON.stringify(context.root)}, ${JSON.stringify(context.dir)});
  })()`;
  const patched = source.slice(0, site.at) + call + source.slice(site.at);
  parseJS(patched);
  return patched;
}
