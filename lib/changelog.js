import { hash } from './storage.js';

const PROTECTED = /```[^\n]*\n[\s\S]*?```|~~~[^\n]*\n[\s\S]*?~~~|`+[^`\n]*`+|^##\s+\[?\d+\.\d+\.\d+[^\n]*|@@PI_EXPR_\d+@@|\x1b\[[0-9;?]*[A-Za-z]|https?:\/\/[^\s<>\])]+|(?<=\]\()[^\s)]+|\b[A-Z][A-Z0-9_]{2,}\b|--[a-z][\w-]*|(?<!\w)\/[a-z][\w-]*(?:\/[\w.-]+)*|@[\w-]+/gm;
export function protectedValues(text) { return text.match(PROTECTED) ?? []; }
export function validateTranslation(source, translated) {
  if (typeof translated !== 'string' || !translated.trim()) throw new Error('译文不能为空');
  if (translated.split('\n')[0] !== source.split('\n')[0]) throw new Error('公告版本标题或日期被修改');
  const tokens = (text) => protectedValues(text).sort();
  if (JSON.stringify(tokens(source)) !== JSON.stringify(tokens(translated))) throw new Error('译文修改了代码、链接、命令或技术标记');
  if ((translated.match(/^## /gm) ?? []).length !== (source.match(/^## /gm) ?? []).length) throw new Error('公告版本结构被修改');
}
export function changelogEntries(source) {
  const headers = [...source.matchAll(/^##\s+\[?(\d+\.\d+\.\d+)\]?[^\n]*/gm)];
  return headers.map((match, i) => ({ version: match[1], start: match.index,
    end: headers[i + 1]?.index ?? source.length,
    source: source.slice(match.index, headers[i + 1]?.index ?? source.length) }));
}
const headings = { Changelog: '更新公告', 'New Features': '新功能', Added: '新增', Changed: '变更', Fixed: '修复', Removed: '移除', Deprecated: '弃用', 'Breaking Changes': '不兼容变更', Security: '安全' };
function translateHeadings(text) {
  // Skip fenced code entirely; headings in examples are executable/document data.
  return text.split(/(```[^\n]*\n[\s\S]*?```|~~~[^\n]*\n[\s\S]*?~~~)/g).map((part, i) => i % 2 ? part
    : part.replace(/^(#{1,3}) ([A-Za-z ]+)$/gm, (all, prefix, heading) => headings[heading] ? `${prefix} ${headings[heading]}` : all)).join('');
}
export function renderChangelog(source, translations) {
  let result = source;
  for (const entry of changelogEntries(source).reverse()) {
    const translated = translations[hash(entry.source)];
    if (typeof translated !== 'string') continue;
    validateTranslation(entry.source, translated);
    result = result.slice(0, entry.start) + translated + result.slice(entry.end);
  }
  return translateHeadings(result);
}
