import { describe, expect, it, vi } from 'vitest';
import { checkProviderConnection, invokeModel } from '../src/providers.mjs';

describe('model adapter safeguards', () => {
  it('marks Mock results and never claims that they are real model output', async () => {
    const result = await invokeModel({ provider_kind: 'mock', provider_name: 'Mock', model_id: 'mock-1' }, 'test prompt', { title: 'Test task' });
    expect(result.isMock).toBe(true);
    expect(result.text).toContain('不是真实模型输出');
    expect(result.inputTokens).toBe(0);
  });

  it('does not call remote services from a malformed provider configuration', async () => {
    await expect(invokeModel({ provider_kind: 'openai', provider_name: 'OpenAI', base_url: 'https://example.invalid/v1', api_key_cipher: '' }, 'prompt', {})).rejects.toThrow('尚未配置 API Key');
  });

  it('checks Mock availability without treating it as a real connection', async () => {
    const result = await checkProviderConnection({ provider_kind: 'mock', provider_name: 'Mock', model_id: 'mock-1' });
    expect(result.isMock).toBe(true);
    expect(result.text).toContain('模拟响应');
  });

  it('honors the configured retry count for transient network failures', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('temporary network failure'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: 'OK' } }], usage: {} }),
        text: async () => '',
      });
    vi.stubGlobal('fetch', fetchMock);
    const result = await invokeModel({
      provider_kind: 'ollama',
      provider_name: 'Ollama',
      base_url: 'http://127.0.0.1:11434/v1',
      model_id: 'local-test',
      max_retries: 1,
      timeout_ms: 5000,
    }, 'prompt', {});
    expect(result.text).toBe('OK');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
