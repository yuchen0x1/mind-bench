import { decryptSecret, now } from './db.mjs';

export class ProviderError extends Error {
  constructor(message, status = 502) { super(message); this.name = 'ProviderError'; this.status = status; }
}
const mockResponse = (prompt, task) => `【模拟响应｜不是真实模型输出】\n收到测试提示词（${String(prompt).length} 字符）。\n\n由于这是 Mock 模式，我不会伪装成真实模型回答。请在“模型管理”中配置供应商 API Key 后重新测试。\n\n题目：${task?.title ?? '自定义测试'}`;

const abortableDelay = (ms, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) return reject(new ProviderError('测试已取消。', 499));
  const timer = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => {
    clearTimeout(timer);
    reject(new ProviderError('测试已取消。', 499));
  }, { once: true });
});

/** 按模型配置重试网络错误和 5xx；4xx/解析错误不会盲目重试。 */
async function fetchWithRetry(url, init, { retries = 0, signal } = {}) {
  const maxRetries = Math.max(0, Math.min(5, Number(retries) || 0));
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const response = await fetch(url, init);
      if (response.status >= 500 && attempt < maxRetries) {
        try { await response.body?.cancel(); } catch {}
        await abortableDelay(Math.min(2000, 250 * 2 ** attempt), signal);
        continue;
      }
      return response;
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      if (signal?.aborted || error?.name === 'AbortError' || error?.name === 'TimeoutError') throw error;
      lastError = error;
      if (attempt >= maxRetries) throw error;
      await abortableDelay(Math.min(2000, 250 * 2 ** attempt), signal);
    }
  }
  throw lastError ?? new Error('模型请求失败。');
}

export async function invokeModel(model, prompt, task, signal) {
  const provider = { kind: model.provider_kind, base_url: model.base_url, name: model.provider_name };
  if (provider.kind === 'mock') return { text: mockResponse(prompt, task), inputTokens: 0, outputTokens: 0, requestId: '', isMock: true, latencyMs: 8 };
  const key = decryptSecret(model.api_key_cipher);
  if (!key && provider.kind !== 'ollama' && !model.base_url.includes('127.0.0.1') && !model.base_url.includes('localhost')) throw new ProviderError('该供应商尚未配置 API Key。', 400);
  const started = performance.now();
  const timeout = AbortSignal.timeout(Math.min(180000, Math.max(1000, Number(model.timeout_ms) || 60000)));
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  try {
    let response;
    let extract;
    if (provider.kind === 'anthropic') {
      const base = provider.base_url || 'https://api.anthropic.com';
      response = await fetchWithRetry(`${base.replace(/\/$/, '')}/v1/messages`, {
        method: 'POST', signal: requestSignal,
        headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: model.model_id, max_tokens: model.max_tokens, temperature: model.temperature, messages: [{ role: 'user', content: prompt }] }),
      }, { retries: model.max_retries, signal: requestSignal });
      extract = (data) => ({ text: (data.content ?? []).filter((part) => part.type === 'text').map((part) => part.text).join('\n'), inputTokens: data.usage?.input_tokens ?? 0, outputTokens: data.usage?.output_tokens ?? 0, requestId: data.id ?? '' });
    } else if (provider.kind === 'gemini') {
      const base = provider.base_url || 'https://generativelanguage.googleapis.com';
      response = await fetchWithRetry(`${base.replace(/\/$/, '')}/v1beta/models/${encodeURIComponent(model.model_id)}:generateContent?key=${encodeURIComponent(key)}`, {
        method: 'POST', signal: requestSignal,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: model.temperature, maxOutputTokens: model.max_tokens } }),
      }, { retries: model.max_retries, signal: requestSignal });
      extract = (data) => ({ text: (data.candidates?.[0]?.content?.parts ?? []).map((part) => part.text ?? '').join('\n'), inputTokens: data.usageMetadata?.promptTokenCount ?? 0, outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0, requestId: '' });
    } else {
      const base = (provider.base_url || (provider.kind === 'ollama' ? 'http://127.0.0.1:11434/v1' : 'https://api.openai.com/v1')).replace(/\/$/, '');
      response = await fetchWithRetry(`${base}/chat/completions`, {
        method: 'POST', signal: requestSignal,
        headers: { 'content-type': 'application/json', ...(key ? { authorization: `Bearer ${key}` } : {}) },
        body: JSON.stringify({ model: model.model_id, temperature: model.temperature, max_tokens: model.max_tokens, messages: [{ role: 'user', content: prompt }] }),
      }, { retries: model.max_retries, signal: requestSignal });
      extract = (data) => ({ text: data.choices?.[0]?.message?.content ?? '', inputTokens: data.usage?.prompt_tokens ?? 0, outputTokens: data.usage?.completion_tokens ?? 0, requestId: data.id ?? '' });
    }
    if (!response.ok) {
      const text = (await response.text()).slice(0, 1200);
      throw new ProviderError(`供应商返回 HTTP ${response.status}：${text}`, response.status >= 500 ? 502 : 400);
    }
    const data = await response.json();
    const result = extract(data);
    if (!result.text) throw new ProviderError('供应商响应中没有可显示的文本内容。');
    return { ...result, isMock: false, latencyMs: Math.max(0, Math.round(performance.now() - started)) };
  } catch (error) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') throw new ProviderError(error.name === 'TimeoutError' ? '模型请求超时。' : '测试已取消。', error.name === 'TimeoutError' ? 504 : 499);
    if (error instanceof ProviderError) throw error;
    throw new ProviderError(`模型请求失败：${error.message}`);
  }
}

export async function checkProviderConnection(model) {
  const sample = 'Return exactly the word OK.';
  return invokeModel({ ...model, timeout_ms: Math.min(model.timeout_ms || 15000, 20000), max_tokens: 8 }, sample, { title: '连接检测' }, undefined);
}

const KIND_DEFAULT_BASE = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com',
  gemini: 'https://generativelanguage.googleapis.com',
  deepseek: 'https://api.deepseek.com/v1',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4',
  moonshot: 'https://api.moonshot.cn/v1',
  minimax: 'https://api.minimax.chat/v1',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  ollama: 'http://127.0.0.1:11434',
  lmstudio: 'http://127.0.0.1:1234/v1',
};

/**
 * 通过供应商官方接口获取模型列表。只读取公开的模型清单，不推断能力。
 * 不同供应商路径不同，因此按候选路径依次尝试，返回第一个成功结果。
 */
export async function listProviderModels(provider) {
  const kind = provider.kind;
  if (kind === 'mock') return { models: [], endpoint: 'mock', note: 'Mock 供应商没有真实模型清单。' };
  const key = decryptSecret(provider.api_key_cipher);
  const base = String(provider.base_url || KIND_DEFAULT_BASE[kind] || '').replace(/\/+$/, '');
  if (!base) throw new ProviderError('该供应商未配置 Base URL，无法获取模型列表。', 400);
  const signal = AbortSignal.timeout(20000);
  const headers = { accept: 'application/json' };
  const candidates = [];
  if (kind === 'gemini') {
    candidates.push({ url: `${base}/v1beta/models?key=${encodeURIComponent(key)}`, headers, pick: (data) => (data.models ?? []).map((item) => ({ id: String(item.name ?? '').replace(/^models\//, ''), name: item.displayName ?? '', ownedBy: 'Google' })) });
  } else if (kind === 'anthropic') {
    const auth = { ...headers, 'x-api-key': key, 'anthropic-version': '2023-06-01' };
    candidates.push({ url: `${base}/v1/models`, headers: auth, pick: (data) => (data.data ?? []).map((item) => ({ id: item.id, name: item.display_name ?? '', ownedBy: 'Anthropic', created: item.created_at ?? null })) });
  } else if (kind === 'ollama') {
    const root = base.replace(/\/v1$/, '');
    candidates.push({ url: `${root}/api/tags`, headers, pick: (data) => (data.models ?? []).map((item) => ({ id: item.name, name: item.name, ownedBy: 'Ollama', size: item.size ?? null })) });
    candidates.push({ url: `${root}/v1/models`, headers, pick: (data) => (data.data ?? []).map((item) => ({ id: item.id, ownedBy: 'Ollama' })) });
  } else {
    const auth = key ? { ...headers, authorization: `Bearer ${key}` } : headers;
    candidates.push({ url: `${base}/models`, headers: auth });
    if (!/\/v\d+(beta)?$/.test(base)) candidates.push({ url: `${base}/v1/models`, headers: auth });
  }
  const errors = [];
  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate.url, { headers: candidate.headers, signal });
      if (!response.ok) { errors.push(`${candidate.url} → HTTP ${response.status}`); continue; }
      const data = await response.json();
      const models = (candidate.pick ? candidate.pick(data) : (data.data ?? data.models ?? []).map((item) => ({ id: item.id ?? item.name, name: item.name ?? item.id, ownedBy: item.owned_by ?? item.ownedBy ?? '', created: item.created ?? null })))
        .filter((item) => item.id)
        .slice(0, 400);
      return { models, endpoint: candidate.url.replace(/key=[^&]+/, 'key=***'), note: models.length ? '' : '供应商返回了空模型列表。' };
    } catch (error) {
      errors.push(`${candidate.url} → ${error.name === 'TimeoutError' ? '超时' : error.message}`);
    }
  }
  throw new ProviderError(`无法获取模型列表：${errors.join('；')}`, 502);
}
