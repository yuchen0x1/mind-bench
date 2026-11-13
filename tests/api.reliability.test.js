import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { server } from '../src/server.mjs';

const realFetch = globalThis.fetch;
let baseUrl;
beforeAll(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
afterEach(() => vi.unstubAllGlobals());
afterAll(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});
const api = async (path, body, method = 'POST') => {
  const response = await realFetch(`${baseUrl}${path}`, body === undefined ? undefined : {
    method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  return { status: response.status, data: await response.json() };
};
const createModel = async () => {
  const provider = await api('/api/providers', { name: 'Reliability stub', kind: 'openai', baseUrl: 'https://reliability.invalid/v1', apiKey: 'fixture-key' });
  return api('/api/models', { providerId: provider.data.provider.id, name: 'Target', modelId: 'target', maxRetries: 0 });
};

describe('run reliability', () => {
  it('preserves an explicit zero retry count when creating a model', async () => {
    const created = await createModel();
    expect(created.status).toBe(201);
    expect(created.data.model.max_retries).toBe(0);
  });

  it('cancels queued jobs without sending more provider requests', async () => {
    const created = await createModel();
    const calls = [];
    vi.stubGlobal('fetch', vi.fn((url, init) => {
      calls.push(url);
      return new Promise((_resolve, reject) => {
        const abort = () => reject(new DOMException('Aborted', 'AbortError'));
        if (init.signal.aborted) abort();
        else init.signal.addEventListener('abort', abort, { once: true });
      });
    }));
    const started = await api('/api/test-sessions', { mode: 'category', categoryId: 'math', questionCount: 12, modelIds: [created.data.model.id], deferred: true });
    expect(started.status).toBe(202);
    const inFlight = calls.length;
    expect(inFlight).toBeGreaterThan(0);
    expect(inFlight).toBeLessThan(12);
    expect((await api(`/api/sessions/${started.data.sessionId}/cancel`, {})).status).toBe(200);
    let report;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      report = await api(`/api/sessions/${started.data.sessionId}`);
      if (report.data.session.status !== 'running') break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    expect(report.data.session.status).toBe('cancelled');
    expect(report.data.runs).toHaveLength(12);
    expect(report.data.runs.every((run) => run.status === 'cancelled' && run.score === null)).toBe(true);
    expect(calls).toHaveLength(inFlight);
  });

  it('freezes the actual prompt, reference and rubric used by later judging', async () => {
    const target = await createModel();
    const judge = await createModel();
    const copy = await api('/api/tasks/math-01/copy', { title: 'Frozen task' });
    const taskId = copy.data.task.id;
    const original = copy.data.task;
    const override = '原始实验提示词：请计算连续折扣。';
    let judgePrompt;
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
      const prompt = JSON.parse(init.body).messages[0].content;
      const judging = prompt.includes('独立评分裁判');
      if (judging) judgePrompt = prompt;
      const content = judging ? JSON.stringify({ dimensions: [
        { name: '任务完成度', score: 90, reason: '完成' },
        { name: '推理与约束遵循', score: 80, reason: '遵循' },
      ], verdict: 'pass', confidence: 0.9 }) : '下降4%。';
      return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
    }));
    const started = await api('/api/test-runs', { taskId, modelIds: [target.data.model.id], promptOverride: override });
    const manifest = (await api(`/api/sessions/${started.data.sessionId}/manifest`)).data.manifest;
    expect(manifest.tasks[0]).toMatchObject({ promptZh: original.prompt_zh, referenceAnswer: original.reference_answer });
    expect(manifest.session.settings.promptOverride).toBe(override);
    const { integrity, ...payload } = manifest;
    expect(integrity.value).toBe(createHash('sha256').update(JSON.stringify(payload)).digest('hex'));
    expect(JSON.stringify(manifest)).not.toContain('fixture-key');
    await api(`/api/tasks/${taskId}`, { promptZh: '修改后的题目', referenceAnswer: '新答案', scoringDimensions: [{ name: '新版维度', weight: 1 }] }, 'PUT');
    const judged = await api(`/api/runs/${started.data.results[0].runId}/judge`, { judgeModelIds: [judge.data.model.id] });
    expect(judged.status).toBe(200);
    expect(judgePrompt).toContain(override);
    expect(judgePrompt).toContain(original.reference_answer);
    expect(judgePrompt).not.toContain('修改后的题目');
    expect(judgePrompt).not.toContain('新版维度');
  });
});
