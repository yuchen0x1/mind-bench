const FAILURE_RULES = [
  { code: 'cancelled', label: '已取消', pattern: /取消|cancel|aborted|\b499\b/i },
  { code: 'timeout', label: '请求超时', pattern: /超时|timeout|timed out|\b504\b/i },
  { code: 'config', label: '配置问题', pattern: /尚未配置|未配置|地址无效|URL|不存在或已停用|不支持的供应商|评分规则|缺少有效/i },
  { code: 'auth', label: '鉴权失败', pattern: /\b401\b|\b403\b|unauthorized|invalid api key|invalid_api_key|permission denied|鉴权|密钥无效/i },
  { code: 'rate_limit', label: '限流或被拒', pattern: /\b429\b|rate limit|too many requests|quota|额度/i },
  { code: 'empty', label: '空响应', pattern: /没有可显示的文本|empty response|no content/i },
  { code: 'network', label: '网络不可达', pattern: /fetch failed|ENOTFOUND|ECONNREFUSED|ECONNRESET|EAI_AGAIN|EPIPE|socket|network/i },
  { code: 'upstream', label: '上游服务错误', pattern: /\b5\d\d\b|bad gateway|service unavailable|server error|overloaded/i },
];

/** Group a provider/runtime error message into a stable, user-facing category. */
export function classifyFailure(message) {
  const text = String(message ?? '').trim();
  if (!text) return { code: 'unknown', label: '未知原因', retryable: false };
  const rule = FAILURE_RULES.find((candidate) => candidate.pattern.test(text));
  if (!rule) return { code: 'unknown', label: '未知原因', retryable: false };
  return {
    code: rule.code,
    label: rule.label,
    retryable: ['timeout', 'rate_limit', 'network', 'upstream'].includes(rule.code),
  };
}

export function percentile(values, ratio) {
  const sorted = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const clamped = Math.min(1, Math.max(0, Number(ratio) || 0));
  const rank = Math.max(1, Math.ceil(clamped * sorted.length));
  return sorted[rank - 1];
}

const round = (value) => (value === null ? null : Math.round(value));

/**
 * Summarize one session's real runs. Mock and external answers are counted
 * separately and never contribute to latency or failure statistics.
 */
export function summarizeDiagnostics(runs = []) {
  const statusCounts = { completed: 0, failed: 0, cancelled: 0, running: 0 };
  const real = [];
  let mockCount = 0;
  let externalCount = 0;
  for (const run of runs) {
    const status = String(run.status ?? '');
    if (Object.hasOwn(statusCounts, status)) statusCounts[status] += 1;
    if (run.is_mock) mockCount += 1;
    if (run.is_external) externalCount += 1;
    if (!run.is_mock && !run.is_external && status !== 'running') real.push(run);
  }
  const completedWithLatency = real.filter(
    (run) => run.status === 'completed' && Number.isFinite(Number(run.latency_ms)) && Number(run.latency_ms) > 0,
  );
  const latencies = completedWithLatency.map((run) => Number(run.latency_ms));
  const latencyAverage = latencies.length ? latencies.reduce((sum, value) => sum + value, 0) / latencies.length : null;
  const failed = real.filter((run) => run.status === 'failed');
  const groups = new Map();
  for (const run of failed) {
    const category = classifyFailure(run.error);
    const current = groups.get(category.code) ?? {
      code: category.code,
      label: category.label,
      retryable: category.retryable,
      count: 0,
      sample: '',
    };
    current.count += 1;
    if (!current.sample && run.error) current.sample = String(run.error).slice(0, 160);
    groups.set(category.code, current);
  }
  const failures = [...groups.values()].sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
  const total = real.length;
  return {
    totals: {
      ...statusCounts,
      total: runs.length,
      real: total,
      realCompleted: real.filter((run) => run.status === 'completed').length,
      mock: mockCount,
      external: externalCount,
    },
    latency: {
      count: latencies.length,
      average: round(latencyAverage),
      p50: round(percentile(latencies, 0.5)),
      p95: round(percentile(latencies, 0.95)),
      min: latencies.length ? Math.min(...latencies) : null,
      max: latencies.length ? Math.max(...latencies) : null,
    },
    failures,
    failureCount: failed.length,
    retryableCount: failures
      .filter((failure) => failure.retryable)
      .reduce((sum, failure) => sum + failure.count, 0),
    failureRate: total ? Math.round((failed.length / total) * 100) : null,
  };
}
