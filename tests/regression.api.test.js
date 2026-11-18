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
const request = async (path, body) => {
  const response = await fetch(`${baseUrl}${path}`, body === undefined ? {} : {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  return { status: response.status, data: await response.json() };
};

describe('session comparison API', () => {
  it('returns an explicit blocked gate for two real persisted Mock sessions', async () => {
    const provider = await request('/api/providers', { name: 'Regression mock', kind: 'mock' });
    const model = await request('/api/models', { providerId: provider.data.provider.id, name: 'Regression model', modelId: 'regression-mock' });
    const first = await request('/api/test-runs', { taskId: 'math-01', modelIds: [model.data.model.id] });
    const second = await request('/api/test-runs', { taskId: 'math-01', modelIds: [model.data.model.id] });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    const compared = await request(`/api/sessions/${second.data.sessionId}/compare?baseline=${first.data.sessionId}`);
    expect(compared.status).toBe(200);
    expect(compared.data).toMatchObject({ status: 'blocked', comparableCount: 0, excludedCount: 1 });
    expect(compared.data.rows[0].reasons).toContain('包含失败、Mock、外部回答或未评分运行');
    expect((await request(`/api/sessions/${second.data.sessionId}/compare?baseline=${first.data.sessionId}&maxScoreDrop=-1`)).status).toBe(400);
  });
});
