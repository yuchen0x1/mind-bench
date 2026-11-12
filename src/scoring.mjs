const norm = (value) => String(value ?? '').normalize('NFKC').toLocaleLowerCase().replace(/[\s\u3000]+/g, ' ').trim();

export function scoreAnswer(rule, expected, response) {
  const value = String(response ?? '');
  const normalized = norm(value);
  const config = typeof rule === 'string' ? JSON.parse(rule) : (rule ?? {});
  const method = config.method ?? 'manual';
  if (method === 'manual' || !normalized) return { score: null, passed: null, rationale: '此题采用人工评分；尚未计入客观成绩。' };
  if (method === 'exact') {
    const target = config.target ?? expected;
    const passed = normalized === norm(target);
    return { score: passed ? 100 : 0, passed, rationale: passed ? '与题目配置的目标答案标准化后完全一致。' : '与目标答案不完全一致。' };
  }
  if (method === 'contains') {
    const targets = config.targets ?? [config.target ?? expected];
    const found = targets.filter((target) => normalized.includes(norm(target)));
    const score = targets.length ? Math.round(found.length / targets.length * 100) : null;
    return { score, passed: score === 100, rationale: `命中 ${found.length}/${targets.length} 个允许目标文本。` };
  }
  if (method === 'one_of') {
    const targets = (config.targets ?? []).map(norm).filter(Boolean);
    const passed = targets.some((target) => normalized === target);
    return { score: passed ? 100 : 0, passed, rationale: `与 ${targets.length} 个允许答案之一进行标准化精确比较。` };
  }
  if (method === 'all_keywords' || method === 'any_keywords') {
    const keywords = (config.keywords ?? String(expected).split('|')).map(norm).filter(Boolean);
    if (!keywords.length) return { score: null, passed: null, rationale: '缺少有效的评分关键词。' };
    const found = keywords.filter((keyword) => normalized.includes(keyword));
    const ratio = found.length / keywords.length;
    const passed = method === 'all_keywords' ? ratio === 1 : found.length > 0;
    return { score: Math.round(ratio * 100), passed, rationale: `命中 ${found.length}/${keywords.length} 个评分关键词。`, dimensions: keywords.map((keyword) => ({ name: keyword, score: normalized.includes(keyword) ? 100 : 0 })) };
  }
  if (method === 'numeric') {
    const targets = (config.targets ?? [expected]).map(Number).filter(Number.isFinite);
    const numbers = value.match(/[-+]?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    if (!targets.length) return { score: null, passed: null, rationale: '缺少数值参考答案。' };
    const found = targets.filter((target) => numbers.some((actual) => Math.abs(actual - target) <= (config.tolerance ?? 1e-9)));
    const score = Math.round(100 * found.length / targets.length);
    return { score, passed: score === 100, rationale: `回答中识别到 ${found.length}/${targets.length} 个目标数值。` };
  }
  if (method === 'regex') {
    try {
      const passed = new RegExp(config.pattern, config.flags ?? 'i').test(value);
      return { score: passed ? 100 : 0, passed, rationale: '按题目配置的正则表达式评分。' };
    } catch {
      return { score: null, passed: null, rationale: '正则评分规则无效。' };
    }
  }
  if (method === 'json') {
    try {
      const parsed = JSON.parse(value);
      const keysValid = config.requiredKeys ? config.requiredKeys.every((key) => Object.hasOwn(parsed, key)) : true;
      const exactValid = config.exactValue === undefined || JSON.stringify(parsed) === JSON.stringify(config.exactValue);
      const valueValid = config.expectedValues ? Object.entries(config.expectedValues).every(([key, expectedValue]) => parsed[key] === expectedValue) : true;
      const extraValid = !config.requiredKeys || !config.allowExtraKeys ? Object.keys(parsed).length === (config.requiredKeys?.length ?? Object.keys(parsed).length) : true;
      const valid = keysValid && exactValid && valueValid && extraValid;
      return { score: valid ? 100 : 0, passed: valid, rationale: valid ? 'JSON 结构与配置要求一致。' : 'JSON 无效、字段值不匹配或包含不允许的字段。' };
    } catch {
      return { score: 0, passed: false, rationale: '回答不是有效 JSON。' };
    }
  }
  if (method === 'word_limit') {
    const count = value.trim().split(/\s+/u).filter(Boolean).length;
    const passed = count <= config.max;
    return { score: passed ? 100 : Math.max(0, Math.round(100 * config.max / count)), passed, rationale: `按空白分隔统计 ${count} 词，上限 ${config.max} 词。` };
  }
  return { score: null, passed: null, rationale: `不支持的评分方式：${method}` };
}

export function scoreToMindBenchScore(categoryScores, weights = {}) {
  const scored = Object.entries(categoryScores).filter(([, value]) => Number.isFinite(value));
  if (!scored.length) return null;
  let numerator = 0;
  let denominator = 0;
  for (const [category, score] of scored) {
    const weight = Number(weights[category] ?? 1);
    if (!Number.isFinite(weight) || weight <= 0) continue;
    numerator += Math.max(0, Math.min(100, score)) * weight;
    denominator += weight;
  }
  return denominator ? Math.round(10 * numerator / denominator) : null;
}
