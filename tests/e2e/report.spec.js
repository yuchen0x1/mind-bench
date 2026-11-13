import { createServer } from 'node:http';
import { expect, test } from '@playwright/test';

// Local HTTP fixture exercises the real API, provider adapter and report UI.
async function startRun(request, batch = false) {
  const pending = new Set();
  const upstream = createServer((_req, res) => {
    pending.add(res);
    res.on('close', () => pending.delete(res));
  });
  await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve));
  try {
    const provider = await (await request.post('/api/providers', { data: {
      name: 'Report HTTP fixture', kind: 'openai-compatible', baseUrl: `http://127.0.0.1:${upstream.address().port}/v1`,
    } })).json();
    const model = await (await request.post('/api/models', { data: {
      providerId: provider.provider.id, name: 'Report fixture model', modelId: 'fixture-report', timeoutMs: 20000, maxRetries: 0,
    } })).json();
    const response = await request.post(batch ? '/api/test-sessions' : '/api/test-runs', { data: {
      name: batch ? '可停止的报告' : '自动刷新的报告', mode: 'category', categoryId: 'math', questionCount: 8,
      taskId: 'math-01', modelIds: [model.model.id], deferred: true,
    } });
    expect(response.status()).toBe(202);
    const { sessionId } = await response.json();
    return {
      sessionId,
      complete() {
        for (const res of pending) {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ choices: [{ message: { content: '报告自动刷新验证：最终价格下降4%，为原价的96%。' } }], usage: {} }));
        }
      },
      async close() {
        upstream.closeAllConnections();
        await new Promise((resolve) => upstream.close(resolve));
      },
    };
  } catch (error) {
    upstream.closeAllConnections();
    await new Promise((resolve) => upstream.close(resolve));
    throw error;
  }
}

test('an open report refreshes itself when the real session finishes', async ({ page, request }, testInfo) => {
  const run = await startRun(request);
  try {
    await page.goto(`/#report/${run.sessionId}`);
    await expect(page.getByRole('heading', { name: '自动刷新的报告' })).toBeVisible();
    await expect(page.locator('.report-progress')).toContainText('报告自动刷新中');
    await expect(page.getByRole('button', { name: '停止测试', exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('report-running.png'), fullPage: true });
    run.complete();
    await expect(page.locator('.report-progress')).toHaveCount(0, { timeout: 10000 });
    await expect(page.getByText('报告自动刷新验证：最终价格下降4%，为原价的96%。', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '刷新报告', exact: true })).toBeEnabled();
    await page.screenshot({ path: testInfo.outputPath('report-completed.png'), fullPage: true });
  } finally { await run.close(); }
});

test('a report can cancel a batch and stops polling after cancellation', async ({ page, request }) => {
  const run = await startRun(request, true);
  try {
    await page.goto(`/#report/${run.sessionId}`);
    await page.getByRole('button', { name: '停止测试', exact: true }).click();
    await expect(page.locator('.report-progress')).toHaveCount(0, { timeout: 10000 });
    await expect(page.getByRole('button', { name: '停止测试', exact: true })).toHaveCount(0);
    const report = await (await request.get(`/api/sessions/${run.sessionId}`)).json();
    expect(report.session.status).toBe('cancelled');
    expect(report.runs).toHaveLength(8);
    expect(report.runs.every((item) => item.status === 'cancelled')).toBe(true);
    let polls = 0;
    page.on('request', (req) => { if (new URL(req.url()).pathname === `/api/sessions/${run.sessionId}`) polls += 1; });
    await page.waitForTimeout(1800);
    expect(polls).toBe(0);
  } finally { await run.close(); }
});
