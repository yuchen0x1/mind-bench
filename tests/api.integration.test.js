import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { server } from '../src/server.mjs';

let baseUrl;
beforeAll(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
afterAll(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});
const api = async (path, options) => {
  const response = await fetch(`${baseUrl}${path}`, options);
  return { status: response.status, data: await response.json() };
};
const post = (body) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

describe('HTTP and SQLite integration', () => {
  let providerId;
  let modelId;

  it('serves health, dashboard, category and filtered task queries', async () => {
    expect((await api('/api/health')).data.ok).toBe(true);
    expect((await api('/api/categories')).data).toHaveLength(15);
    const filtered = await api('/api/tasks?category=logic&q=条件');
    expect(filtered.data.tasks.length).toBeGreaterThan(0);
    expect(filtered.data.total).toBeGreaterThan(0);
    expect((await api('/api/dashboard')).data.stats.taskCount).toBeGreaterThanOrEqual(200);
  });

  it('never returns provider secrets to the client', async () => {
    const created = await api('/api/providers', post({ name: 'Integration Mock', kind: 'mock', apiKey: 'not-a-real-key' }));
    expect(created.status).toBe(201);
    providerId = created.data.provider.id;
    expect(created.data.provider).not.toHaveProperty('apiKey');
    const listed = await api('/api/providers');
    expect(JSON.stringify(listed.data)).not.toContain('not-a-real-key');
    const model = await api('/api/models', post({ providerId, name: 'Integration Test Model', modelId: 'mock-v1', isDefault: true }));
    expect(model.status).toBe(201);
    modelId = model.data.model.id;
    expect(model.data.model).not.toHaveProperty('api_key_cipher');
  });

  it('runs and persists a visibly mocked test without grading it into the leaderboard', async () => {
    const started = await api('/api/test-runs', post({ taskId: 'math-01', modelIds: [modelId] }));
    expect(started.status).toBe(201);
    const result = started.data.results[0];
    expect(result.isMock).toBe(true);
    expect(result.score).toBeNull();
    expect(result.rawText).toContain('模拟响应');
    const session = await api(`/api/sessions/${started.data.sessionId}`);
    expect(session.data.runs[0].isMock).toBe(true);
    expect(session.data.runs[0].raw_text).toContain('不是真实模型输出');
    const board = await api('/api/leaderboard');
    expect(board.data.leaderboard).toHaveLength(0);
  });

  it('rejects malformed tasks and never deletes a model referenced by history', async () => {
    const malformed = await api('/api/tasks/import', post({ tasks: [{ title: 'invalid' }] }));
    expect(malformed.data.imported).toBe(0);
    expect(malformed.data.errors).toHaveLength(1);
    const remove = await api(`/api/models/${modelId}`, { method: 'DELETE' });
    expect(remove.status).toBe(409);
  });

  it('exports the saved report in CSV and JSON', async () => {
    const sessions = await api('/api/sessions?limit=1');
    const sessionId = sessions.data[0].id;
    const exported = await fetch(`${baseUrl}/api/report/${sessionId}/export?format=csv`);
    expect(exported.status).toBe(200);
    expect(await exported.text()).toContain('task_title');
    expect((await api(`/api/report/${sessionId}/export`)).data.runs).toHaveLength(1);
  });
});
