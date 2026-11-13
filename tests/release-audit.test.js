import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { server } from '../src/server.mjs';
import { scoreAnswer } from '../src/scoring.mjs';
import { request as httpRequest } from 'node:http';

let base;
const nativeFetch = globalThis.fetch;
beforeAll(async () => {
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  base = `http://127.0.0.1:${server.address().port}`;
});
afterEach(() => vi.unstubAllGlobals());
afterAll(async () => { await new Promise((done) => server.close(done)); });
const api = async (path, body, method = 'POST', headers = {}) => {
  const res = await nativeFetch(base + path, body === undefined ? { headers } : { method, headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  return { status: res.status, data: await res.json() };
};
async function model(kind = 'mock') {
  const p = await api('/api/providers', { name: 'Audit fixture', kind, apiKey: kind === 'mock' ? '' : 'fixture-key' });
  return (await api('/api/models', { providerId: p.data.provider.id, name: 'Audit model', modelId: 'audit-model', modelVersion: 'old', maxRetries: 0 })).data.model;
}

it('blocks cross-site writes and DNS-rebinding hosts while allowing same-origin API calls', async () => {
  expect((await api('/api/tasks/math-01/favorite', {}, 'POST', { origin: 'https://example.invalid' })).status).toBe(403);
  expect((await api('/api/health', undefined, 'GET', { 'sec-fetch-site': 'cross-site' })).status).toBe(403);
  const reboundStatus = await new Promise((done, reject) => {
    const request = httpRequest(new URL('/api/health', base), { headers: { host: 'rebinding.invalid' } }, (res) => { res.resume(); res.on('end', () => done(res.statusCode)); });
    request.on('error', reject);
    request.end();
  });
  expect(reboundStatus).toBe(403);
  expect((await api('/api/tasks/math-01/favorite', {}, 'POST', { origin: base })).status).toBe(200);
});

it('rejects invalid settings without corrupting the saved values', async () => {
  const before = (await api('/api/settings')).data.settings;
  for (const value of [null, [], '', { math: -1 }, { madeUpCategory: 1 }, { math: '3' }]) expect((await api('/api/settings/score_weights', { value }, 'PUT')).status).toBe(400);
  for (const value of [0, -1, 501, 1.5, '10', null]) expect((await api('/api/settings/minimum_leaderboard_runs', { value }, 'PUT')).status).toBe(400);
  expect((await api('/api/settings')).data.settings).toEqual(before);
});

it('keeps category task counts stable after repeated runs', async () => {
  const m = await model();
  const before = (await api('/api/categories')).data.find((row) => row.id === 'math');
  for (let repeat = 0; repeat < 3; repeat += 1) await api('/api/test-runs', { taskId: 'math-01', modelIds: [m.id] });
  const after = (await api('/api/categories')).data.find((row) => row.id === 'math');
  for (const key of ['task_count', 'easy_count', 'medium_count', 'hard_count', 'expert_count']) expect(after[key]).toBe(before[key]);
  expect((await api('/api/dashboard')).data.categories.find((row) => row.id === 'math').task_count).toBe(before.task_count);
});

it('reports invalid import rows individually instead of failing the entire import', async () => {
  const json = await api('/api/tasks/import', { tasks: [null, 'text', [], { title: 'Missing fields' }] });
  expect(json.status).toBe(201);
  expect(json.data.errors).toHaveLength(4);
  const jsonl = await api('/api/tasks/import-dataset', { content: 'null\n"text"\n[]', format: 'jsonl', license: 'CC0-1.0' });
  expect(jsonl.status).toBe(201);
  expect(jsonl.data.errors).toHaveLength(3);
});

it('preserves responses from a task with a malformed grading rule', async () => {
  const m = await model('deepseek');
  const t = (await api('/api/tasks/math-01/copy', {})).data.task;
  await api(`/api/tasks/${t.id}`, { scoringRule: { method: 'all_keywords', keywords: 42 } }, 'PUT');
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    expect(url).toBe('https://api.deepseek.com/v1/chat/completions');
    return new Response(JSON.stringify({ choices: [{ message: { content: 'Original response is preserved.' } }] }));
  }));
  const run = await api('/api/test-runs', { taskId: t.id, modelIds: [m.id] });
  expect(run.status).toBe(201);
  expect(run.data.results[0]).toMatchObject({ status: 'completed', score: null, rawText: 'Original response is preserved.' });
  expect((await api(`/api/sessions/${run.data.sessionId}`)).data.session.status).toBe('completed');
});

it('uses recorded model versions and excludes categories with zero weight', async () => {
  const m = await model('deepseek');
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: '下降4%，为原价的96%。' } }] }))));
  await api('/api/test-runs', { taskId: 'math-01', modelIds: [m.id] });
  await api(`/api/models/${m.id}`, { modelVersion: 'new' }, 'PUT');
  const old = (await api('/api/leaderboard?version=old')).data;
  expect(old.provisional.some((row) => row.model_id === m.id)).toBe(true);
  expect(old.versions).toContain('old');
  expect((await api('/api/leaderboard?version=new')).data.provisional).toHaveLength(0);
  await api('/api/settings/score_weights', { value: { math: 0 } }, 'PUT');
  const excluded = (await api('/api/leaderboard')).data;
  expect([...excluded.leaderboard, ...excluded.provisional].some((row) => row.model_id === m.id)).toBe(false);
});

it('does not throw or invent scores for invalid scoring configurations', () => {
  expect(scoreAnswer('{bad json', '', 'response').score).toBeNull();
  expect(scoreAnswer({ method: 'all_keywords', keywords: 42 }, '', 'response').score).toBeNull();
  expect(scoreAnswer({ method: 'exact', target: 'OK' }, '', '  ')).toMatchObject({ score: 0, passed: false });
});
