import { hash } from './storage.js';

const FENCES = /```[^\n]*\n[\s\S]*?```|~~~[^\n]*\n[\s\S]*?~~~/g;
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
  const fences = [...source.matchAll(FENCES)].map(({ index, 0: text }) => [index, index + text.length]);
  const headers = [...source.matchAll(/^##\s+\[?(\d+\.\d+\.\d+)\]?[^\n]*/gm)]
    .filter(({ index }) => !fences.some(([start, end]) => index >= start && index < end));
  return headers.map((match, i) => ({ version: match[1], start: match.index,
    end: headers[i + 1]?.index ?? source.length,
    source: source.slice(match.index, headers[i + 1]?.index ?? source.length) }));
}
const headings = { Changelog: '更新公告', 'New Features': '新功能', Added: '新增', Changed: '变更', Fixed: '修复', Removed: '移除', Deprecated: '弃用', 'Breaking Changes': '不兼容变更', Security: '安全' };
const canonicalHeadings = { ...Object.fromEntries(Object.entries(headings).map(([en, cn]) => [cn, en])),
  '更新日志': 'Changelog', '新特性': 'New Features', '修正': 'Fixed', Fixes: 'Fixed', Changes: 'Changed' };
function outsideFences(text, transform) {
  const parts = [];
  let cursor = 0;
  for (const match of text.matchAll(FENCES)) {
    parts.push(transform(text.slice(cursor, match.index)), match[0]);
    cursor = match.index + match[0].length;
  }
  parts.push(transform(text.slice(cursor)));
  return parts.join('');
}
export function normalizeChangelog(text) {
  return outsideFences(text.replaceAll('\r\n', '\n'), (part) => part.replace(/^(#{1,3}) ([^\n]+)$/gm,
    (all, prefix, heading) => canonicalHeadings[heading] ? `${prefix} ${canonicalHeadings[heading]}` : all)).trimEnd();
}
function translateHeadings(text) {
  return outsideFences(text, (part) => part.replace(/^(#{1,3}) ([A-Za-z ]+)$/gm,
    (all, prefix, heading) => headings[heading] ? `${prefix} ${headings[heading]}` : all));
}
function translationFor(entry, translations) {
  return translations[hash(entry.source)] ?? translations[hash(normalizeChangelog(entry.source))];
}
export function changelogCoverage(source, translations) {
  const entries = changelogEntries(source);
  const missing = entries.filter((entry) => typeof translationFor(entry, translations) !== 'string').map(({ version }) => version);
  return { total: entries.length, translated: entries.length - missing.length, missing };
}
export function renderChangelog(source, translations) {
  let result = source;
  for (const entry of changelogEntries(source).reverse()) {
    const translated = translationFor(entry, translations);
    if (typeof translated !== 'string') continue;
    // Only harmless heading localization / line endings / terminal whitespace
    // may differ. Changed prose or executable examples must remain a cache miss.
    validateTranslation(normalizeChangelog(entry.source), normalizeChangelog(translated));
    const newline = entry.source.includes('\r\n') ? '\r\n' : '\n';
    const suffix = entry.source.match(/\s*$/)[0];
    const adapted = translated.replaceAll('\r\n', '\n').trimEnd().replaceAll('\n', newline) + suffix;
    result = result.slice(0, entry.start) + adapted + result.slice(entry.end);
  }
  return translateHeadings(result);
}
