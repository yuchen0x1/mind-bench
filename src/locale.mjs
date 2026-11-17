export const LOCALES = ['zh-CN', 'en-US'];
export function resolveLocale(setting, candidates = []) {
  if (setting === 'zh-CN' || setting === 'en-US') return setting;
  for (const candidate of (candidates.length ? candidates : ['zh-CN'])) {
    const value = String(candidate).toLowerCase();
    if (value === 'en' || value.startsWith('en-')) return 'en-US';
    if (value === 'zh' || value.startsWith('zh-')) return 'zh-CN';
  }
  return 'zh-CN';
}
export function readLocaleSetting(storage = globalThis.localStorage) {
  try {
    const value = storage?.getItem('mind-bench:locale');
    return value === 'zh-CN' || value === 'en-US' ? value : 'auto';
  } catch { return 'auto'; }
}
export function writeLocaleSetting(value, storage = globalThis.localStorage) {
  const setting = value === 'zh-CN' || value === 'en-US' ? value : 'auto';
  try { storage?.setItem('mind-bench:locale', setting); } catch { /* private mode */ }
  return setting;
}
