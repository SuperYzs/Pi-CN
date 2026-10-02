import { parse } from 'acorn';

const options = { ecmaVersion: 'latest', sourceType: 'module', allowHashBang: true };
export const parseJS = (source) => parse(source, options);

function walk(node, visit, ancestors = []) {
  if (!node || typeof node.type !== 'string') return;
  visit(node, ancestors);
  const next = [...ancestors, node];
  for (const [key, value] of Object.entries(node)) {
    if (key === 'start' || key === 'end') continue;
    if (Array.isArray(value)) {
      for (const child of value) walk(child, visit, next);
    } else if (value && typeof value === 'object') walk(value, visit, next);
  }
}

// Never translate keys, imports, switch values, comparison operands, regexes,
// computed members or tagged templates. Changing these can change program logic.
function protectedPosition(node, ancestors) {
  const parent = ancestors.at(-1);
  if (!parent) return false;
  if (parent.type === 'Property') {
    if (parent.key === node) return true;
    const key = parent.key.name ?? parent.key.value;
    if (!['label', 'title', 'description', 'text', 'message', 'placeholder', 'subtitle', 'emptyMessage'].includes(key)) return true;
  }
  if (ancestors.some((a) => a.type === 'Property' && ['values', 'currentValue', 'id', 'name', 'value'].includes(a.key.name ?? a.key.value))) return true;
  if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration', 'ImportExpression',
    'TaggedTemplateExpression', 'SwitchCase', 'BinaryExpression', 'MemberExpression'].includes(parent.type)) return true;
  if (ancestors.some((a) => a.type === 'TaggedTemplateExpression')) return true;
  if (parent.type === 'CallExpression' && parent.callee.type === 'MemberExpression'
      && ['includes', 'startsWith', 'endsWith', 'indexOf', 'lastIndexOf', 'match', 'search', 'split', 'replace', 'replaceAll', 'test'].includes(parent.callee.property.name)) return true;
  return false;
}

export function isProse(text) {
  if (typeof text !== 'string' || !/[A-Za-z]/.test(text) || text.length > 30000) return false;
  if (/^[\s\w./:@+*=-]+$/.test(text) && !text.trim().includes(' ') && !/^[A-Z][a-z]+(?:-[a-z]+)*[:.]?$/.test(text.trim())) return false;
  if (/^(?:https?:|file:|\.{0,2}\/|@earendil-works\/)/.test(text.trim()) || /^#[a-f\d]{3,8}$/i.test(text.trim())) return false;
  if (/^\s*(?:import |export |const |function |<\/?[a-z]+\b|\{\s*"|\[\s*")/.test(text)) return false;
  if (['auth check', 'auth print-api-key', 'auth print-bearer-token'].includes(text)) return false;
  const visible = text.replace(/@@PI_EXPR_\d+@@/g, '').replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '');
  // Pure interpolation, terminal escape sequences, paths and symbol formatting
  // are not human text even though the placeholder itself contains English.
  if (/[\x00\x1b\x07]/.test(visible)) return false;
  return /[A-Za-z]{2,}/.test(visible) && !/^[\sA-Z\d\W]+$/.test(visible);
}

export function ownerNames(source) {
  const names = new Set();
  for (const entry of parseJS(source).body) {
    const node = entry.declaration ?? entry;
    if (['ClassDeclaration', 'FunctionDeclaration'].includes(node.type) && node.id) names.add(node.id.name);
    if (node.type === 'VariableDeclaration') {
      for (const variable of node.declarations) {
        if (variable.id.type === 'Identifier' && ['ClassExpression', 'FunctionExpression', 'ArrowFunctionExpression', 'ArrayExpression', 'ObjectExpression'].includes(variable.init?.type)) names.add(variable.id.name);
      }
    }
  }
  return names;
}

export function stringSites(source, owners) {
  const sites = [];
  walk(parseJS(source), (node, ancestors) => {
    if (protectedPosition(node, ancestors)) return;
    if (owners && !ancestors.some((a) => {
      const name = ['ClassDeclaration', 'ClassExpression', 'FunctionDeclaration', 'FunctionExpression'].includes(a.type)
        ? a.id?.name : a.type === 'VariableDeclarator' && a.id.type === 'Identifier' ? a.id.name : undefined;
      return name && (owners.has(name) || owners.has(name.replace(/^_/, '').replace(/\d+$/, '')));
    })) return;
    if (node.type === 'Literal' && typeof node.value === 'string') {
      sites.push({ start: node.start, end: node.end, text: node.value, kind: 'literal' });
    } else if (node.type === 'TemplateLiteral' && node.quasis.every((q) => q.value.cooked !== null)) {
      const expressions = node.expressions.map((e) => source.slice(e.start, e.end));
      const text = node.quasis.map((q, i) => q.value.cooked + (i < expressions.length ? `@@PI_EXPR_${i}@@` : '')).join('');
      sites.push({ start: node.start, end: node.end, text, kind: 'template', expressions,
        expressionRanges: node.expressions.map((e) => ({ start: e.start, end: e.end })) });
    }
  });
  return sites;
}

const escapeTemplate = (text) => text.replaceAll('\\', '\\\\').replaceAll('`', '\\`').replaceAll('${', '\\${');
export function encodeSite(site, translated) {
  if (site.kind === 'literal') return JSON.stringify(translated);
  const markers = translated.match(/@@PI_EXPR_\d+@@/g) ?? [];
  const expected = site.expressions.map((_, i) => `@@PI_EXPR_${i}@@`);
  // Keep expression evaluation order, not just their count.
  if (JSON.stringify(markers) !== JSON.stringify(expected)) throw new Error('模板表达式标记被修改或重排');
  const parts = translated.split(/@@PI_EXPR_\d+@@/);
  return '`' + parts.map((text, i) => escapeTemplate(text) + (i < site.expressions.length ? '${' + site.expressions[i] + '}' : '')).join('') + '`';
}

export function patchJS(source, dictionary, allowed) {
  const replacements = [];
  for (const site of stringSites(source)) {
    if (allowed && !allowed.has(site.text)) continue;
    const translation = dictionary[site.text];
    if (typeof translation !== 'string' || translation === site.text) continue;
    encodeSite(site, translation); // Validate expression markers before any replacement.
    replacements.push({ ...site, translation });
  }
  replacements.sort((a, b) => a.start - b.start || b.end - a.end);
  // Resolve nested display literals inside expressions (e.g. chalk.bold("Usage:"))
  // independently. Preserve all other executable code and evaluation order.
  function renderRange(start, end) {
    const outer = [];
    for (const site of replacements) {
      if (site.start < start || site.end > end || outer.at(-1)?.end > site.start) continue;
      outer.push(site);
    }
    let result = source.slice(start, end);
    for (const site of outer.reverse()) {
      const expressions = site.expressionRanges?.map((range) => renderRange(range.start, range.end));
      const replacement = encodeSite(expressions ? { ...site, expressions } : site, site.translation);
      result = result.slice(0, site.start - start) + replacement + result.slice(site.end - start);
    }
    return result;
  }
  const result = renderRange(0, source.length);
  parseJS(result);
  return { source: result, count: replacements.length };
}
