import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const REPOSITORY = 'https://github.com/SuperYzs/Pi-CN';
export const PACKAGE_SOURCE = 'git:github.com/SuperYzs/Pi-CN';
export const CATALOG_FILE = fileURLToPath(new URL('../locales/releases.json', import.meta.url));
export function loadCatalog(file = CATALOG_FILE) {
  const catalog = JSON.parse(readFileSync(file, 'utf8'));
  if (catalog.schema !== 1 || !catalog.versions || typeof catalog.versions !== 'object') throw new Error('离线译文清单无效');
  for (const [version, release] of Object.entries(catalog.versions)) {
    if (!/^\d+\.\d+\.\d+$/.test(version) || !release.ui || !release.changelog) throw new Error(`离线译文版本数据无效：${version}`);
    for (const [alias, target] of Object.entries(release.changelogAliases ?? {})) {
      if (!/^[a-f0-9]{64}$/.test(alias) || !/^[a-f0-9]{64}$/.test(target) || typeof release.changelog[target] !== 'string') throw new Error(`公告匹配索引无效：${version}`);
    }
  }
  return catalog;
}
export function bundledChangelog(catalog) {
  const translations = Object.assign({}, ...Object.values(catalog.versions).map((release) => release.changelog));
  for (const release of Object.values(catalog.versions)) {
    for (const [alias, target] of Object.entries(release.changelogAliases ?? {})) translations[alias] = release.changelog[target];
  }
  return translations;
}
export function requireVersion(catalog, version) {
  if (!catalog.versions[version]) throw new Error(`Pi ${version} 尚未适配。请先更新插件：pi update ${PACKAGE_SOURCE}。`);
  return catalog.versions[version];
}
