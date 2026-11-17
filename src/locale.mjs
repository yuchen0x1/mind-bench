import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

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
export function readLocaleSetting(storage) {
  try {
    storage ??= globalThis.localStorage;
    const value = storage?.getItem('mind-bench:locale');
    return value === 'zh-CN' || value === 'en-US' ? value : 'auto';
  } catch { return 'auto'; }
}
export function writeLocaleSetting(value, storage) {
  const setting = value === 'zh-CN' || value === 'en-US' ? value : 'auto';
  try { (storage ??= globalThis.localStorage)?.setItem('mind-bench:locale', setting); } catch { /* private mode */ }
  return setting;
}

const MESSAGES = {
  'zh-CN': {
    'nav.workspace': '工作台', 'nav.dashboard': '总览', 'nav.tasks': '题库探索', 'nav.challenges': '测试中心',
    'nav.compare': '模型对比', 'nav.promptlab': '提示词工作台', 'nav.insights': '洞察', 'nav.leaderboard': '模型排行榜',
    'nav.history': '测试历史', 'nav.analytics': '数据分析', 'nav.system': '系统', 'nav.providers': '模型管理',
    'nav.import': '题库导入', 'nav.research': '研究资料', 'nav.categories': '能力分类', 'nav.main': '主导航',
    'brand.workspace': '评测工作台', 'brand.local': '本地私有空间', 'brand.online': '本地运行 · 数据不出设备',
    'brand.researcher': '个人研究者', 'top.open': '打开导航', 'top.close': '关闭导航', 'top.theme': '切换主题',
    'footer.method': '研究方法', 'footer.traceable': '仅展示可追溯的真实评测 · 不测量人类 IQ',
    'run.running': '正在运行模型测试', 'run.saved': '任务已保存 · 最多并发 {count}', 'run.stop': '停止生成', 'run.history': '查看历史',
    'notice.enableModel': '请先在模型管理中启用至少一个模型。', 'notice.queued': '测试已加入运行队列，可在右下角查看进度。',
    'notice.cancelled': '已发送停止请求。', 'settings.title': '系统设置', 'settings.subtitle': '个人本地实例 · SQLite 持久化 · API 服务绑定 127.0.0.1。',
    'settings.language': '语言 / Language', 'settings.languageCurrent': '自动模式按浏览器或系统语言选择界面，当前：{locale}',
    'settings.auto': '自动 / Auto', 'settings.theme': '界面主题', 'settings.dark': '深色实验室', 'settings.light': '浅色工作台',
    'settings.toggleTheme': '切换主题', 'settings.concurrency': '并发', 'settings.version': '当前版本', 'settings.update': '更新状态',
    'settings.check': '检查更新', 'settings.checking': '检查中', 'settings.noCheck': '尚未检查', 'settings.stable': '稳定通道',
    'update.title': '发现新的 MIND BENCH 部署', 'update.refresh': '立即刷新', 'update.dismiss': '稍后提醒',
  },
  'en-US': {
    'nav.workspace': 'Workspace', 'nav.dashboard': 'Overview', 'nav.tasks': 'Task library', 'nav.challenges': 'Test center',
    'nav.compare': 'Model comparison', 'nav.promptlab': 'Prompt lab', 'nav.insights': 'Insights', 'nav.leaderboard': 'Leaderboard',
    'nav.history': 'Test history', 'nav.analytics': 'Analytics', 'nav.system': 'System', 'nav.providers': 'Model management',
    'nav.import': 'Import tasks', 'nav.research': 'Research', 'nav.categories': 'Capabilities', 'nav.main': 'Main navigation',
    'brand.workspace': 'Evaluation workspace', 'brand.local': 'Private local space', 'brand.online': 'Local run · data stays on device',
    'brand.researcher': 'Independent researcher', 'top.open': 'Open navigation', 'top.close': 'Close navigation', 'top.theme': 'Toggle theme',
    'footer.method': 'Research method', 'footer.traceable': 'Traceable real evaluations only · not an IQ test',
    'run.running': 'Running model test', 'run.saved': 'Task saved · up to {count} concurrent', 'run.stop': 'Stop generation', 'run.history': 'View history',
    'notice.enableModel': 'Enable at least one model in Model management first.', 'notice.queued': 'Test queued. Track progress in the lower-right corner.',
    'notice.cancelled': 'Stop request sent.', 'settings.title': 'System settings', 'settings.subtitle': 'Local instance · SQLite persistence · API bound to 127.0.0.1.',
    'settings.language': 'Language / 语言', 'settings.languageCurrent': 'Auto follows browser or system language. Current: {locale}',
    'settings.auto': 'Auto / 自动', 'settings.theme': 'Interface theme', 'settings.dark': 'Dark lab', 'settings.light': 'Light workspace',
    'settings.toggleTheme': 'Toggle theme', 'settings.concurrency': 'concurrent', 'settings.version': 'Current version', 'settings.update': 'Update status',
    'settings.check': 'Check for updates', 'settings.checking': 'Checking', 'settings.noCheck': 'Not checked yet', 'settings.stable': 'Stable channel',
    'update.title': 'New MIND BENCH deployment found', 'update.refresh': 'Refresh now', 'update.dismiss': 'Remind me later',
  },
};

const LocaleContext = createContext(null);
function browserCandidates() {
  if (typeof navigator === 'undefined') return [];
  return Array.isArray(navigator.languages) && navigator.languages.length
    ? navigator.languages
    : navigator.language ? [navigator.language] : [];
}

export function LocaleProvider({ children }) {
  const [setting, setSetting] = useState(() => readLocaleSetting());
  const [locale, setLocale] = useState(() => resolveLocale(setting, browserCandidates()));
  const applySetting = useCallback((next) => {
    const normalized = next === 'zh-CN' || next === 'en-US' ? next : 'auto';
    const effective = resolveLocale(normalized, browserCandidates());
    setSetting(normalized);
    setLocale(effective);
    writeLocaleSetting(normalized);
    if (typeof document !== 'undefined') document.documentElement.lang = effective;
  }, []);
  useEffect(() => {
    applySetting(setting);
  }, []);
  const setLocaleSetting = useCallback((next) => {
    applySetting(next);
    return next === 'zh-CN' || next === 'en-US' ? next : 'auto';
  }, [applySetting]);
  const t = useCallback((key, fallback = key, params = {}) => {
    let value = MESSAGES[locale]?.[key] ?? MESSAGES['zh-CN']?.[key] ?? fallback;
    Object.entries(params).forEach(([name, replacement]) => { value = value.replace(`{${name}}`, String(replacement)); });
    return value;
  }, [locale]);
  const value = useMemo(() => ({ setting, locale, t, setLocaleSetting }), [locale, setting, setLocaleSetting, t]);
  return React.createElement(LocaleContext.Provider, { value }, children);
}

export function useI18n() {
  return useContext(LocaleContext) || {
    setting: 'auto', locale: 'zh-CN', t: (key, fallback = key) => fallback, setLocaleSetting: () => 'auto',
  };
}
