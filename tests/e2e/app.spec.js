import { expect, test } from '@playwright/test';

test('dashboard loads from the local API and navigates to the task library', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('15 个能力维度')).toBeVisible();
  await page.screenshot({ path: 'screenshots/dashboard.png', fullPage: true });
  await page.getByRole('button', { name: /题库探索/ }).first().click();
  await expect(page.getByRole('heading', { name: '提示词测试中心' })).toBeVisible();
  await expect(page.getByText('发现模型的能力边界')).toBeVisible();
  await page.screenshot({ path: 'screenshots/task-library.png', fullPage: true });
});

test('task detail supports prompt copy, reference-answer reveal and local navigation', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => {} } });
  });
  await page.goto('/#tasks');
  await page.getByRole('button', { name: '球拍与球' }).click();
  await expect(page.getByRole('heading', { name: '球拍与球' })).toBeVisible();
  await page.getByRole('button', { name: /复制完整提示词/ }).click();
  await expect(page.getByRole('button', { name: /已复制/ })).toBeVisible();
  await page.getByRole('button', { name: /查看标准答案与评分依据/ }).click();
  await expect(page.getByText('球0.5元，球拍10.5元。')).toBeVisible();
  await page.screenshot({ path: 'screenshots/task-detail.png', fullPage: true });
});

test('mock provider stays explicitly labeled, saves a labeled report and never enters the leaderboard', async ({ page }) => {
  await page.goto('/#providers');
  await page.getByRole('button', { name: '添加供应商' }).first().click();
  await page.getByLabel('供应商名称').fill('E2E Mock');
  await page.getByLabel('供应商类型').selectOption('mock');
  await page.getByRole('button', { name: '加密保存' }).click();
  await page.getByRole('button', { name: '添加模型', exact: true }).first().click();
  await page.getByLabel('模型显示名称').fill('E2E Simulated Model');
  await page.getByLabel(/模型 ID/).fill('mock-e2e');
  await page.getByRole('button', { name: '添加模型', exact: true }).last().click();
  await expect(page.getByText('模拟模式 · 不计入排名')).toBeVisible();
  await page.screenshot({ path: 'screenshots/providers.png', fullPage: true });

  await page.getByRole('button', { name: '题库探索' }).first().click();
  await page.getByRole('button', { name: '球拍与球' }).click();
  await page.getByRole('button', { name: /发送测试/ }).click();
  await expect(page.getByText('测试完成', { exact: false })).toBeVisible({ timeout: 15000 });

  await page.getByRole('button', { name: '测试历史' }).click();
  await page.getByText('球拍与球').first().click();
  await expect(page.getByText('模拟输出 · 不是真实成绩').first()).toBeVisible();
  await page.screenshot({ path: 'screenshots/report-mock-labelled.png', fullPage: true });

  await page.getByRole('button', { name: '模型排行榜' }).click();
  await expect(page.getByText('排行榜尚未开放排名')).toBeVisible();
  await expect(page.getByText(/目前没有模型达到至少 \d+ 条/)).toBeVisible();
  await page.screenshot({ path: 'screenshots/leaderboard-empty.png', fullPage: true });
});

test('prompt workshop creates an editable copy with version history', async ({ page }) => {
  await page.goto('/#tasks');
  await page.getByRole('button', { name: '球拍与球' }).click();
  await page.getByRole('button', { name: /编辑副本/ }).click();
  await expect(page.getByRole('heading', { name: '提示词工作台' })).toBeVisible();
  const title = page.getByLabel('题目名称');
  await expect(title).toHaveValue(/球拍与球/);
  await title.fill('球拍与球（E2E 副本）');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText(/已保存新版本/)).toBeVisible();
  const preview = page.locator('.lab-preview');
  await expect(preview).toBeVisible();
  await preview.getByRole('button', { name: /新建变体/ }).click();
  await page.getByPlaceholder('变体提示词…').fill('球拍与球共 11 元，球拍比球贵 10 元。只输出球的价钱。');
  await page.getByRole('button', { name: '保存', exact: true }).last().click();
  await expect(page.getByText(/变体已保存/)).toBeVisible();
  await expect(preview.getByText('球拍与球（E2E 副本） · 变体')).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'screenshots/prompt-workshop.png', fullPage: true });
});

test('settings persist category weights used by the leaderboard', async ({ page }) => {
  await page.goto('/#settings');
  await expect(page.getByRole('heading', { name: '系统设置' })).toBeVisible();
  await page.getByLabel('逻辑推理 权重').fill('3');
  await page.getByRole('button', { name: '保存权重' }).click();
  await expect(page.getByText('评分权重已保存，排行榜会按新权重重算。')).toBeVisible();
  await page.screenshot({ path: 'screenshots/settings.png', fullPage: true });
});

test('research desk and mobile layout stay usable', async ({ page }) => {
  await page.goto('/#research');
  await expect(page.getByRole('heading', { name: '研究资料' })).toBeVisible();
  await page.screenshot({ path: 'screenshots/research.png', fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#dashboard');
  await expect(page.getByRole('heading', { name: '评测工作台' })).toBeVisible();
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'screenshots/mobile-dashboard.png', fullPage: true });
  await page.getByRole('button', { name: '打开导航' }).click();
  await page.waitForTimeout(500);
  await expect(page.getByRole('button', { name: /模型排行榜/ })).toBeVisible();
  await page.screenshot({ path: 'screenshots/mobile-nav.png' });
});
