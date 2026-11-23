import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '../src/server.mjs';

let baseUrl;
let providerId;
let targetModelId;
let judgeModelId;
let judgeMode = 'valid';
const realFetch = globalThis.fetch;

const reply = (payload) => ({ ok: true, status: 200, json: async () => payload, text: async () => JSON.stringify(payload) });

beforeAll(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
afterAll(async () => {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

const api = async (path, options) => {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: response.status, data };
};
const post = (body) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const put = (body) => ({ method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

const VALID_VERDICT = {
  dimensions: [
    { name: '任务完成度', score: 90, reason: '给出下降 4% 并展示计算。' },
    { name: '推理与约束遵循', score: 80, reason: '步骤完整但未解释标准化过程。' },
  ],
  verdict: 'pass',
  confidence: 0.82,
  notes: '结论与参考答案一致。',
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url, init) => {
    const body = JSON.parse(init?.body ?? '{}');
    const prompt = body.messages?.at(-1)?.content ?? '';
    if (String(url).includes('stub.local')) {
      if (prompt.includes('MIND BENCH 的独立评分裁判')) {
        if (judgeMode === 'invalid') return reply({ choices: [{ message: { content: '我觉得这个回答还不错。' } }], usage: { prompt_tokens: 30, completion_tokens: 8 } });
        if (judgeMode === 'fabricated') return reply({ choices: [{ message: { content: JSON.stringify({ dimensions: [{ name: '创造力', score: 99, reason: '很好' }], verdict: 'pass', confidence: 0.9 }) } }], usage: { prompt_tokens: 30, completion_tokens: 40 } });
        return reply({ choices: [{ message: { content: JSON.stringify(VALID_VERDICT) } }], usage: { prompt_tokens: 800, completion_tokens: 120 } });
      }
      return reply({ choices: [{ message: { content: '1.2×0.8=0.96，即96%，最终价格下降4%。' } }], usage: { prompt_tokens: 40, completion_tokens: 24 } });
    }
    return realFetch(url, init);
  }));
});

describe('task authoring workflow', () => {
  beforeAll(async () => {
    const provider = await api('/api/providers', post({ name: 'Stub Provider', kind: 'openai', baseUrl: 'https://stub.local/v1', apiKey: 'sk-stub' }));
    providerId = provider.data.provider.id;
    const target = await api('/api/models', post({ providerId, name: 'Stub Target', modelId: 'target-1', maxTokens: 400, isDefault: true }));
    targetModelId = target.data.model.id;
    const judge = await api('/api/models', post({ providerId, name: 'Stub Judge', modelId: 'judge-1', maxTokens: 800 }));
    judgeModelId = judge.data.model.id;
  });

  it('copies a built-in task into an editable task with immutable version history', async () => {
    const copied = await api('/api/tasks/math-01/copy', post({ title: '连续折扣（我的副本）' }));
    expect(copied.status).toBe(201);
    const id = copied.data.task.id;
    expect(copied.data.task.created_by).toBe('local-owner');
    expect(copied.data.task.derived_from).toBe('math-01');

    const edited = await api(`/api/tasks/${id}`, put({ promptZh: '商品先涨价 25%，再打八折，最终相对原价变化多少？', referenceAnswer: '0', changeNote: '改写为 25% 版本' }));
    expect(edited.status).toBe(200);
    expect(edited.data.task.version).toBe('1.0.1');
    expect(edited.data.task.prompt_zh).toContain('25%');

    const versions = await api(`/api/tasks/${id}/versions`);
    expect(versions.data).toHaveLength(2);
    expect(versions.data.some((version) => version.snapshot.promptZh)).toBe(true);

    const detail = await api(`/api/tasks/${id}`);
    expect(detail.data.derivedFrom.id).toBe('math-01');
    const custom = await api('/api/custom-tasks');
    expect(custom.data.tasks.some((task) => task.id === id && task.run_count === 0)).toBe(true);
  });

  it('stores prompt variants separately from the original task', async () => {
    const created = await api('/api/tasks/logic-01/variants', post({ name: '换人称版本', prompt: '甲说乙说谎，乙说两人中恰有一人说真话。' }));
    expect(created.status).toBe(201);
    const detail = await api('/api/tasks/logic-01');
    expect(detail.data.task.prompt_zh).not.toContain('换人称');
    expect(detail.data.variants.some((variant) => variant.id === created.data.variant.id)).toBe(true);
    const removed = await api(`/api/variants/${created.data.variant.id}`, { method: 'DELETE' });
    expect(removed.data.ok).toBe(true);
  });

  it('refuses to delete built-in tasks and requires a license for dataset import', async () => {
    const denied = await api('/api/tasks/math-01', { method: 'DELETE' });
    expect(denied.status).toBe(403);

    const noLicense = await api('/api/tasks/import-dataset', post({ content: '{"question":"1+1?","answer":"2"}', sourceName: 'Unknown' }));
    expect(noLicense.status).toBe(400);

    const imported = await api('/api/tasks/import-dataset', post({
      content: '{"question":"2+3?","answer":"5","category":"math"}\n{"question":"3+4?","answer":"7","category":"math"}',
      sourceName: 'Tiny public set',
      license: 'CC0-1.0',
      sourceType: 'external',
    }));
    expect(imported.status).toBe(201);
    expect(imported.data.imported).toBe(2);
    expect(imported.data.detected).toBe('jsonl');
    const search = await api('/api/tasks?category=math&q=2%2B3');
    const detail = await api(`/api/tasks/${search.data.tasks[0].id}`);
    expect(detail.data.task.verification_status).toBe('imported');
    expect(detail.data.task.source_license).toBe('CC0-1.0');
  });

  it('keeps pasted external answers out of real-model statistics and supports deferred runs', async () => {
    const external = await api('/api/test-runs', post({ taskId: 'math-01', modelIds: [targetModelId], manualText: '1.2×0.8=0.96，下降4%。' }));
    expect(external.status).toBe(201);
    expect(external.data.results[0].isExternal).toBe(true);
    const run = await api(`/api/runs/${external.data.results[0].runId}`);
    expect(run.data.isExternal).toBe(true);
    const board = await api('/api/leaderboard');
    expect(board.data.provisional.some((item) => item.model_id === targetModelId)).toBe(false);

    const deferred = await api('/api/test-runs', post({ taskId: 'math-01', modelIds: [targetModelId], deferred: true }));
    expect(deferred.status).toBe(202);
    expect(deferred.data.status).toBe('running');
    let session;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      session = await api(`/api/sessions/${deferred.data.sessionId}`);
      if (['completed', 'failed', 'partial'].includes(session.data.session.status)) break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    expect(session.data.session.status).toBe('completed');
    expect(session.data.session.manifest.manifestVersion).toBe('1.1.0');
    expect(session.data.session.manifest.tasks[0]).toMatchObject({ id: 'math-01', version: '1.0.0' });
    expect(session.data.session.manifest.models[0]).toMatchObject({ modelId: 'target-1', providerKind: 'openai' });
    expect(session.data.session.manifest.scoring.weightSnapshot.math).toBeDefined();
    expect(session.data.session.manifest.integrity.value).toMatch(/^[a-f0-9]{64}$/);
    const manifest = await api('/api/sessions/' + deferred.data.sessionId + '/manifest');
    expect(manifest.status).toBe(200);
    expect(manifest.data.manifest.integrity.algorithm).toBe('sha256');
    const after = await api('/api/leaderboard');
    const row = after.data.provisional.find((item) => item.model_id === targetModelId);
    expect(row.scored_count).toBe(1);
  });
});

describe('AI judge pipeline', () => {
  let runId;

  it('excludes mock providers from the judge pool and blocks self-judging', async () => {
    const mockProvider = await api('/api/providers', post({ name: 'Mock Judge Provider', kind: 'mock' }));
    const mockModel = await api('/api/models', post({ providerId: mockProvider.data.provider.id, name: 'Mock Judge', modelId: 'mock-1' }));
    const judges = await api('/api/judges');
    expect(judges.data.judges.every((judge) => judge.provider_kind !== 'mock')).toBe(true);

    const run = await api('/api/test-runs', post({ taskId: 'math-01', modelIds: [targetModelId] }));
    runId = run.data.sessionId ? run.data.results[0].runId : null;
    expect(run.data.results[0].isMock).toBe(false);
    expect(run.data.results[0].score).toBe(100);

    const mockAttempt = await api(`/api/runs/${runId}/judge`, post({ judgeModelIds: [mockModel.data.model.id] }));
    expect(mockAttempt.status).toBe(400);
    const detail = await api(`/api/runs/${runId}`);
    const targetModel = detail.data.model_id;
    const selfAttempt = await api(`/api/runs/${runId}/judge`, post({ judgeModelIds: [targetModel] }));
    expect(selfAttempt.status).toBe(400);
  });

  it('validates judge JSON, recomputes the weighted total and records provenance', async () => {
    judgeMode = 'valid';
    const judged = await api(`/api/runs/${runId}/judge`, post({ judgeModelIds: [judgeModelId] }));
    expect(judged.status).toBe(200);
    expect(judged.data.aggregate.overall).toBe(85);
    expect(judged.data.applied.applied).toBe(true);
    const verdict = judged.data.verdicts[0];
    expect(verdict.valid).toBe(true);
    expect(verdict.judge_model_identifier).toContain('judge-1');

    const run = await api(`/api/runs/${runId}`);
    expect(run.data.evaluator_type).toBe('ai_judge');
    expect(run.data.score).toBe(85);
    expect(run.data.judge_model).toContain('judge-1');
    expect(run.data.dimensions).toHaveLength(2);
  });

  it('rejects free text and invented dimensions instead of scoring zero', async () => {
    judgeMode = 'invalid';
    const invalid = await api(`/api/runs/${runId}/judge`, post({ judgeModelIds: [judgeModelId] }));
    expect(invalid.status).toBe(422);
    expect(invalid.data.error).toContain('Schema');

    judgeMode = 'fabricated';
    const fabricated = await api(`/api/runs/${runId}/judge`, post({ judgeModelIds: [judgeModelId] }));
    expect(fabricated.status).toBe(422);
    const run = await api(`/api/runs/${runId}`);
    expect(run.data.score).toBe(85);
  });

  it('never overwrites a human review without an explicit force flag', async () => {
    const human = await api(`/api/runs/${runId}/evaluation`, put({ score: 70, rationale: '人工复核：评分过宽' }));
    expect(human.data.ok).toBe(true);
    judgeMode = 'valid';
    const judged = await api(`/api/runs/${runId}/judge`, post({ judgeModelIds: [judgeModelId] }));
    expect(judged.status).toBe(200);
    expect(judged.data.applied.applied).toBe(false);
    const run = await api(`/api/runs/${runId}`);
    expect(run.data.evaluator_type).toBe('human');
    expect(run.data.score).toBe(70);
  });
});

describe('leaderboard aggregation', () => {
  it('exposes weights, coverage and per-category scores while keeping sample thresholds honest', async () => {
    await api('/api/settings/score_weights', put({ value: { logic: 3, math: 1 } }));
    const board = await api('/api/leaderboard');
    expect(board.data.name).toBe('MIND BENCH SCORE');
    expect(board.data.weights.logic).toBe(3);
    expect(board.data.threshold).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(board.data.provisional)).toBe(true);
    const row = board.data.provisional.find((item) => item.model_id === targetModelId);
    expect(row).toBeTruthy();
    expect(row.category_scores.math).toBeGreaterThan(0);
    expect(row.rank).toBeNull();
    expect(row.reason).toContain('至少需要');

    const exportCsv = await fetch(`${baseUrl}/api/leaderboard/export?format=csv`);
    expect(await exportCsv.text()).toContain('mind_bench_score');
    const exportJson = await api('/api/leaderboard/export?format=json');
    expect(exportJson.data.leaderboard).toBeDefined();
  });

  it('serves a model profile with stats, category scores and recent runs', async () => {
    const profile = await api(`/api/models/${targetModelId}`);
    expect(profile.status).toBe(200);
    expect(profile.data.model.model_id).toBe('target-1');
    expect(profile.data.stats.completed).toBeGreaterThan(0);
    expect(profile.data.categoryScores.length).toBeGreaterThan(0);
    expect(profile.data.recent.length).toBeGreaterThan(0);
    expect(JSON.stringify(profile.data)).not.toContain('sk-stub');
  });
});

describe('session replay and diagnostics', () => {
  let mockModelId;
  beforeAll(async () => {
    const provider = await api('/api/providers', post({ name: 'Replay Mock', kind: 'mock' }));
    const model = await api('/api/models', post({ providerId: provider.data.provider.id, name: 'Replay Mock Model', modelId: 'replay-mock' }));
    mockModelId = model.data.model.id;
  });

  it('replays a finished session with the same tasks and models', async () => {
    const original = await api('/api/test-sessions', post({ mode: 'category', categoryId: 'math', questionCount: 3, modelIds: [mockModelId], name: 'Replay source' }));
    expect(original.status).toBe(201);
    const replayed = await api(`/api/sessions/${original.data.sessionId}/replay`, post({}));
    expect(replayed.status).toBe(201);
    expect(replayed.data.replayedFrom).toBe(original.data.sessionId);
    expect(replayed.data.results).toHaveLength(3);
    const report = await api(`/api/sessions/${replayed.data.sessionId}`);
    expect(report.data.session.name).toContain('复跑');
    expect(report.data.runs.every((run) => run.isMock)).toBe(true);
    expect(report.data.session.manifest.session.settings.replayedFrom).toBe(original.data.sessionId);
  });

  it('rejects replaying a session that is still running', async () => {
    const pending = new Set();
    const { createServer } = await import('node:http');
    const upstream = createServer((_req, res) => { pending.add(res); });
    await new Promise((done) => upstream.listen(0, '127.0.0.1', done));
    try {
      const provider = await api('/api/providers', post({ name: 'Slow Replay', kind: 'openai-compatible', baseUrl: `http://127.0.0.1:${upstream.address().port}/v1` }));
      const model = await api('/api/models', post({ providerId: provider.data.provider.id, name: 'Slow model', modelId: 'slow-replay', timeoutMs: 30000, maxRetries: 0 }));
      const started = await api('/api/test-runs', post({ taskId: 'math-01', modelIds: [model.data.model.id], deferred: true, name: 'Running source' }));
      expect(started.status).toBe(202);
      const response = await api(`/api/sessions/${started.data.sessionId}/replay`, post({}));
      expect(response.status).toBe(409);
      expect(response.data.error).toContain('仍在运行');
      await api(`/api/sessions/${started.data.sessionId}/cancel`, post({}));
      for (const res of pending) { res.writeHead(499, { 'content-type': 'application/json' }); res.end('{}'); }
      await new Promise((done) => setTimeout(done, 100));
    } finally {
      upstream.closeAllConnections();
      await new Promise((done) => upstream.close(done));
    }
  });

  it('rejects replaying an external-answer session without inventing a model call', async () => {
    const external = await api('/api/test-runs', post({ taskId: 'math-01', modelIds: [mockModelId], manualText: '0.5', name: 'External source' }));
    expect(external.status).toBe(201);
    const response = await api(`/api/sessions/${external.data.sessionId}/replay`, post({}));
    expect(response.status).toBe(400);
    expect(response.data.error).toContain('外部回答');
  });

  it('summarizes latency and failure groups without counting mock runs', async () => {
    const session = await api('/api/test-runs', post({ taskId: 'math-01', modelIds: [mockModelId], name: 'Diagnostics' }));
    const diagnostics = await api(`/api/sessions/${session.data.sessionId}/diagnostics`);
    expect(diagnostics.status).toBe(200);
    expect(diagnostics.data.totals.mock).toBe(1);
    expect(diagnostics.data.latency.count).toBe(0);
    expect(diagnostics.data.latency.p95).toBeNull();
    expect(diagnostics.data.failureRate).toBeNull();
  });
});
