import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const base = process.env.MIND_BENCH_SCREENSHOT_URL || 'http://127.0.0.1:3000';
if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(base).hostname)) throw new Error('Documentation screenshots must use a local app.');
const dashboard = await (await fetch(`${base}/api/dashboard`)).json();
const providers = await (await fetch(`${base}/api/providers`)).json();
if (dashboard.stats.sessions || providers.providers.length || providers.models.length) throw new Error('This instance has user data. Use a clean isolated instance to avoid publishing private records.');
mkdirSync(join(root, 'screenshots'), { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
try {
  for (const [route, title, file] of [
    ['dashboard', '评测工作台', 'dashboard.png'],
    ['tasks', '提示词测试中心', 'task-library.png'],
    ['task/traps-01', '球拍与球', 'task-detail.png'],
    ['challenges', '测试中心', 'challenges.png'],
    ['providers', '模型管理', 'providers.png'],
    ['leaderboard', '模型排行榜', 'leaderboard-empty.png'],
    ['settings', '系统设置', 'settings.png'],
    ['research', '研究资料', 'research.png'],
  ]) {
    await page.goto(`${base}/#${route}`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('heading', { name: title, exact: true }).waitFor();
    await page.waitForFunction(() => { const content = document.querySelector('.page-content'); return content && getComputedStyle(content).opacity === '1'; });
    await page.screenshot({ path: join(root, 'screenshots', file), fullPage: true });
    console.log(`Captured ${file} from ${base}/#${route}`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/#dashboard`);
  await page.waitForLoadState('networkidle');
  await page.getByRole('heading', { name: '评测工作台', exact: true }).waitFor();
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.page-content')).opacity === '1');
  await page.screenshot({ path: join(root, 'screenshots/mobile-dashboard.png'), fullPage: true });
  await page.getByRole('button', { name: '打开导航' }).click();
  await page.getByRole('button', { name: '模型排行榜', exact: true }).waitFor();
  await page.screenshot({ path: join(root, 'screenshots/mobile-nav.png') });
  if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
} finally { await browser.close(); }
