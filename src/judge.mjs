/**
 * MIND BENCH — AI 裁判评分引擎
 *
 * 设计约束（对应 docs/SCORING_GUIDE.md）：
 * 1. 被测模型身份对裁判隐藏，只暴露“候选A”。
 * 2. 被测模型不得给自己评分（由调用方校验 judgeModel.id !== run.model_id）。
 * 3. rubric 固定来自题目配置，不接受裁判自行发明维度。
 * 4. 只接受严格 JSON，逐维度分数 + 理由，任何不合格输出视为无效而非零分。
 * 5. 总分由服务端按 rubric 权重重算，不直接采信模型自报总分。
 * 6. AI 裁判属于主观评分，写入 evaluator_type='ai_judge'，不冒充客观正确率。
 */

export const DEFAULT_DIMENSIONS = [
  { name: "正确性", weight: 3, description: "结论是否与参考答案或可验证事实一致" },
  { name: "推理质量", weight: 2, description: "推理链是否完整、无跳步、无自相矛盾" },
  { name: "约束遵循", weight: 1, description: "是否满足题目的格式、字数、范围等显式要求" },
];

const MAX_RESPONSE_CHARS = 12000;
const MAX_REASON_CHARS = 240;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : null);

export function rubricFor(task) {
  const configured = Array.isArray(task?.scoring_dimensions) ? task.scoring_dimensions : [];
  const dimensions = configured
    .map((item) => ({
      name: String(item?.name ?? "").trim().slice(0, 60),
      weight: Math.max(0, Number(item?.weight ?? 1) || 0),
      description: String(item?.description ?? "").trim().slice(0, 200),
    }))
    .filter((item) => item.name);
  if (!dimensions.length) return DEFAULT_DIMENSIONS;
  if (!dimensions.some((item) => item.weight > 0)) dimensions.forEach((item) => (item.weight = 1));
  return dimensions;
}

export function buildJudgePrompt({ task, response, anonymizedLabel = "候选A" }) {
  const rubric = rubricFor(task);
  const dimensions = rubric
    .map((item, index) => `${index + 1}. ${item.name}（权重 ${item.weight}）${item.description ? ` — ${item.description}` : ""}`)
    .join("\n");
  const reference = String(task?.reference_answer ?? "").trim() || "（本题没有唯一参考答案，请依据题目要求与评分维度判断。）";
  const candidate = String(response ?? "").slice(0, MAX_RESPONSE_CHARS);
  return [
    "你是 MIND BENCH 的独立评分裁判。你只依据题目、参考答案和评分量表打分。",
    "你不知道候选回答来自哪个模型，也不应推测；不要因为回答更长、更礼貌、更多免责声明而加分。",
    "",
    "【题目】",
    String(task?.prompt_zh ?? "").slice(0, 8000),
    "",
    "【参考答案 / 评分要点】",
    reference.slice(0, 4000),
    "",
    "【评分维度与权重】",
    dimensions,
    "",
    `【${anonymizedLabel} · 未经修改的原始回答】`,
    "<<<CANDIDATE",
    candidate,
    "CANDIDATE>>>",
    "",
    "【评分规则】",
    "- 逐维度给出 0—100 的整数分，并写不超过 60 字的中文理由，理由必须引用回答中的具体内容或明确指出缺失。",
    "- 若题目存在唯一正确答案，先独立求解再对照候选回答；结论错误时“正确性”不得高于 40。",
    "- 空泛回避、拒绝作答、只复述题目：正确性与推理质量均不得高于 30。",
    "- 结论正确但推理有跳步或自相矛盾：正确性可以高，推理质量必须扣分。",
    "- verdict 只能是 pass（实质完成且正确）、partial（部分完成或有明显缺陷）、fail（错误或未完成）。",
    "- 只输出一个 JSON 对象，不要 Markdown 代码块，不要任何解释性前后缀。",
    "",
    `JSON 结构：{"dimensions":[{"name":"${rubric[0].name}","score":0,"reason":""}],"verdict":"pass|partial|fail","confidence":0.0,"notes":""}`,
    "dimensions 必须恰好覆盖上面列出的每个维度名称，且不新增维度。confidence 为 0—1 的小数。",
  ].join("\n");
}

function extractJson(text) {
  const raw = String(text ?? "").trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : raw;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * 严格解析并校验裁判输出。失败返回 { ok:false, errors:[...] }，
 * 调用方必须记录无效结果，而不是把它当作 0 分。
 */
export function parseVerdict(text, task, { allowMock = false } = {}) {
  const errors = [];
  const parsed = extractJson(text);
  if (!parsed) return { ok: false, errors: ["裁判输出不是可解析的 JSON。"] };
  if (parsed.mock === true && !allowMock) return { ok: false, errors: ["模拟裁判输出被拒绝：模拟数据不得产生评分。"] };
  if (!Array.isArray(parsed.dimensions) || parsed.dimensions.length === 0) errors.push("缺少 dimensions 数组。");

  const rubric = rubricFor(task);
  const byName = new Map(rubric.map((item) => [item.name.toLowerCase(), item]));
  const scored = new Map();
  for (const dimension of Array.isArray(parsed.dimensions) ? parsed.dimensions : []) {
    const name = String(dimension?.name ?? "").trim();
    const key = name.toLowerCase();
    if (!byName.has(key)) {
      errors.push(`裁判返回了 rubric 之外的维度：${name || "(空)"}`);
      continue;
    }
    const score = num(dimension?.score);
    if (score === null || score < 0 || score > 100) {
      errors.push(`维度「${name}」分数无效。`);
      continue;
    }
    scored.set(key, {
      name: byName.get(key).name,
      weight: byName.get(key).weight,
      score: Math.round(clamp(score, 0, 100)),
      reason: String(dimension?.reason ?? "").trim().slice(0, MAX_REASON_CHARS),
    });
  }
  for (const item of rubric) {
    if (!scored.has(item.name.toLowerCase())) errors.push(`缺少维度评分：${item.name}`);
  }

  const verdict = ["pass", "partial", "fail"].includes(String(parsed.verdict)) ? String(parsed.verdict) : null;
  if (!verdict) errors.push("verdict 必须是 pass、partial 或 fail。");
  const confidence = num(parsed.confidence);
  if (confidence === null || confidence < 0 || confidence > 1) errors.push("confidence 必须是 0—1 的小数。");

  if (errors.length) return { ok: false, errors };

  const dimensions = rubric.map((item) => scored.get(item.name.toLowerCase()));
  const weightSum = dimensions.reduce((sum, item) => sum + (item.weight || 0), 0) || dimensions.length;
  const overall = Math.round(
    dimensions.reduce((sum, item) => sum + item.score * (item.weight || 1), 0) / weightSum,
  );
  return {
    ok: true,
    verdict: {
      dimensions,
      overall: clamp(overall, 0, 100),
      verdict,
      confidence: Math.round(confidence * 100) / 100,
      notes: String(parsed.notes ?? "").trim().slice(0, 1200),
    },
  };
}

/** 多裁判聚合：均分 + 分歧区间 + 维度均分。分歧不隐藏、不取整抹平。 */
export function aggregateVerdicts(verdicts) {
  const list = verdicts.filter(Boolean);
  if (!list.length) return null;
  const overall = list.reduce((sum, item) => sum + item.overall, 0) / list.length;
  const scores = list.map((item) => item.overall);
  const spread = Math.max(...scores) - Math.min(...scores);
  const names = [];
  for (const verdict of list) for (const dimension of verdict.dimensions) if (!names.includes(dimension.name)) names.push(dimension.name);
  const dimensions = names.map((name) => {
    const values = list.flatMap((verdict) => verdict.dimensions.filter((d) => d.name === name));
    return {
      name,
      weight: values[0]?.weight ?? 1,
      score: Math.round(values.reduce((sum, d) => sum + d.score, 0) / Math.max(1, values.length)),
      reason: values.map((d) => d.reason).filter(Boolean).slice(0, 3).join(" / ").slice(0, MAX_REASON_CHARS * 2),
      judges: values.length,
    };
  });
  const passVotes = list.filter((item) => item.verdict === "pass").length;
  const failVotes = list.filter((item) => item.verdict === "fail").length;
  return {
    overall: Math.round(overall),
    spread: Math.round(spread),
    agreement: Math.round((1 - spread / 100) * 100) / 100,
    verdict: passVotes > list.length / 2 ? "pass" : failVotes > list.length / 2 ? "fail" : "partial",
    dimensions,
    judgeCount: list.length,
  };
}

export function verdictRationale(aggregate, notes) {
  const head = `AI 裁判 · ${aggregate.judgeCount} 位独立裁判 · 分歧 ${aggregate.spread} 分（一致度 ${Math.round(aggregate.agreement * 100)}%）`;
  const detail = aggregate.dimensions
    .map((item) => `${item.name} ${item.score}${item.reason ? `（${item.reason}）` : ""}`)
    .join("；");
  return [head, detail, notes].filter(Boolean).join(" · ").slice(0, 4000);
}
