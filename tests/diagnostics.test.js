import { describe, expect, it } from 'vitest';
import { classifyFailure, percentile, summarizeDiagnostics } from '../src/diagnostics.mjs';

describe('failure classification', () => {
  it('maps common provider failures to stable, actionable categories', () => {
    expect(classifyFailure('供应商返回 HTTP 401：invalid api key')).toMatchObject({ code: 'auth', retryable: false });
    expect(classifyFailure('供应商返回 HTTP 429：rate limit exceeded')).toMatchObject({ code: 'rate_limit', retryable: true });
    expect(classifyFailure('模型请求超时。')).toMatchObject({ code: 'timeout', retryable: true });
    expect(classifyFailure('fetch failed')).toMatchObject({ code: 'network', retryable: true });
    expect(classifyFailure('供应商响应中没有可显示的文本内容。')).toMatchObject({ code: 'empty', retryable: false });
    expect(classifyFailure('该供应商尚未配置 API Key。')).toMatchObject({ code: 'config', retryable: false });
    expect(classifyFailure('测试已取消。')).toMatchObject({ code: 'cancelled', retryable: false });
    expect(classifyFailure('')).toMatchObject({ code: 'unknown', retryable: false });
  });
});

describe('percentiles', () => {
  it('returns null for empty input and nearest-rank values otherwise', () => {
    expect(percentile([], 0.95)).toBeNull();
    expect(percentile([100], 0.95)).toBe(100);
    expect(percentile([10, 20, 30, 40], 0.5)).toBe(20);
    expect(percentile([10, 20, 30, 40], 0.95)).toBe(40);
    expect(percentile([5, 1, 3], 0)).toBe(1);
    expect(percentile([5, 1, 3], 5)).toBe(5);
  });
});

describe('session diagnostics', () => {
  it('separates mock and external runs from real latency and failure statistics', () => {
    const summary = summarizeDiagnostics([
      { status: 'completed', is_mock: 0, is_external: 0, latency_ms: 100 },
      { status: 'completed', is_mock: 0, is_external: 0, latency_ms: 300 },
      { status: 'failed', is_mock: 0, is_external: 0, latency_ms: 0, error: '模型请求超时。' },
      { status: 'failed', is_mock: 0, is_external: 0, latency_ms: 0, error: '供应商返回 HTTP 429：rate limit exceeded' },
      { status: 'cancelled', is_mock: 0, is_external: 0, latency_ms: 0, error: '测试已取消。' },
      { status: 'completed', is_mock: 1, is_external: 0, latency_ms: 5 },
      { status: 'completed', is_mock: 0, is_external: 1, latency_ms: 0 },
    ]);
    expect(summary.totals).toMatchObject({ total: 7, real: 5, realCompleted: 2, mock: 1, external: 1, completed: 4, failed: 2, cancelled: 1 });
    expect(summary.latency).toMatchObject({ count: 2, average: 200, p50: 100, p95: 300, min: 100, max: 300 });
    expect(summary.failureCount).toBe(2);
    expect(summary.failureRate).toBe(40);
    expect(summary.retryableCount).toBe(2);
    expect(summary.failures.map((failure) => failure.code)).toEqual(['rate_limit', 'timeout']);
  });

  it('reports nulls instead of fabricated numbers when no real run exists', () => {
    const summary = summarizeDiagnostics([
      { status: 'completed', is_mock: 1, is_external: 0, latency_ms: 12 },
      { status: 'running', is_mock: 0, is_external: 0, latency_ms: 0 },
    ]);
    expect(summary.latency).toEqual({ count: 0, average: null, p50: null, p95: null, min: null, max: null });
    expect(summary.failureRate).toBeNull();
    expect(summary.failures).toEqual([]);
  });
});
