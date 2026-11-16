import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { server } from '../src/server.mjs';
import { scoreAnswer } from '../src/scoring.mjs';
import { seededShuffle } from '../src/reproducibility.mjs';
import { validateProviderUrl } from '../src/providers.mjs';

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
  return { status: response.status, headers: response.headers, data: await response.json() };
};
const post = (body) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

describe('second-pass evolution regressions', () => {
  it('keeps randomized challenge ordering reproducible from a seed', () => {
    const items = Array.from({ length: 20 }, (_, index) => index);
    expect(seededShuffle(items, 'alpha')).toEqual(seededShuffle(items, 'alpha'));
    expect(seededShuffle(items, 'alpha')).not.toEqual(seededShuffle(items, 'beta'));
    expect(seededShuffle(items, 'alpha')).toHaveLength(items.length);
  });

  it('handles fallback scoring configuration and rejects invalid numeric limits', () => {
    expect(scoreAnswer({ method: 'one_of' }, '0.5', '0.5').score).toBe(100);
    expect(scoreAnswer({ method: 'numeric', targets: [1], tolerance: -1 }, '', '1').score).toBeNull();
    expect(scoreAnswer({ method: 'word_limit', max: 0 }, '', 'one').score).toBeNull();
  });

  it('validates provider URLs before they can reach an upstream service', () => {
    expect(validateProviderUrl('https://api.example.com/v1').ok).toBe(true);
    expect(validateProviderUrl('file:///tmp/secret').ok).toBe(false);
    expect(validateProviderUrl('http://169.254.169.254/latest/meta-data').ok).toBe(false);
  });

  it('returns a request id and protects CSV exports from formula execution', async () => {
    const health = await api('/api/health');
    expect(health.status).toBe(200);
    expect(health.headers.get('x-request-id')).toMatch(/^[A-Za-z0-9._:-]+$/);

    const imported = await api('/api/tasks/import', post({ tasks: [{
      title: '=HYPERLINK("https://evil.invalid")', categoryId: 'logic', promptZh: 'CSV safety fixture', objective: 'fixture',
    }] }));
    expect(imported.status).toBe(201);
    const exported = await fetch(`${baseUrl}/api/tasks/export?format=csv`);
    const csv = await exported.text();
    expect(csv).toContain("'=HYPERLINK");
  });

  it('records the seed in a deferred randomized session manifest', async () => {
    const provider = await api('/api/providers', post({ name: 'Evolution Mock', kind: 'mock' }));
    const model = await api('/api/models', post({ providerId: provider.data.provider.id, name: 'Evolution Mock Model', modelId: 'evolution-mock' }));
    const started = await api('/api/test-sessions', post({ mode: 'random', questionCount: 4, seed: 'fixed-seed', modelIds: [model.data.model.id], deferred: true }));
    expect(started.status).toBe(202);
    expect(started.data.seed).toBe('fixed-seed');
    const manifest = await api(`/api/sessions/${started.data.sessionId}/manifest`);
    expect(manifest.data.manifest.session.settings.seed).toBe('fixed-seed');
  });
});
