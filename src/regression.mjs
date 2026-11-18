import { isDeepStrictEqual } from 'node:util';
import { createHash } from 'node:crypto';

const keyOf = (run) => `${run.task_id}\u0000${run.model_id}`;
const average = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
const validManifest = (manifest) => {
  if (!manifest?.integrity || manifest.integrity.algorithm !== 'sha256') return false;
  const { integrity, ...payload } = manifest;
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex') === integrity.value;
};
const comparableTask = (a, b) => a && b && isDeepStrictEqual(
  [a.version, a.promptZh, a.promptEn, a.referenceAnswer, a.scoringRule, a.scoringDimensions],
  [b.version, b.promptZh, b.promptEn, b.referenceAnswer, b.scoringRule, b.scoringDimensions],
);
const comparableModel = (a, b) => a && b && isDeepStrictEqual(
  [a.providerId, a.providerKind, a.modelId, a.modelVersion, a.temperature, a.maxTokens],
  [b.providerId, b.providerKind, b.modelId, b.modelVersion, b.temperature, b.maxTokens],
);

export function compareSessions(baseline, candidate, { maxScoreDrop = 5 } = {}) {
  const threshold = Number(maxScoreDrop);
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
    throw new RangeError('maxScoreDrop 必须为 0 到 100 的数字。');
  }
  const baseManifest = baseline.manifest;
  const nextManifest = candidate.manifest;
  const globalReasons = [];
  if (!validManifest(baseManifest) || !validManifest(nextManifest)) globalReasons.push('缺少可验证的运行清单或摘要不匹配');
  if (baseManifest?.manifestVersion !== nextManifest?.manifestVersion) globalReasons.push('运行清单协议版本不同');
  if (!isDeepStrictEqual(baseManifest?.scoring, nextManifest?.scoring)) globalReasons.push('评分协议或权重不同');
  if (baseManifest?.session?.settings?.promptOverride !== nextManifest?.session?.settings?.promptOverride) globalReasons.push('提示词覆盖配置不同');
  if (baseManifest?.execution?.flags?.external || nextManifest?.execution?.flags?.external) globalReasons.push('外部回答不能进入质量门禁');
  const baseTasks = new Map((baseManifest?.tasks ?? []).map((task) => [task.id, task]));
  const nextTasks = new Map((nextManifest?.tasks ?? []).map((task) => [task.id, task]));
  const baseModels = new Map((baseManifest?.models ?? []).map((model) => [model.id, model]));
  const nextModels = new Map((nextManifest?.models ?? []).map((model) => [model.id, model]));
  const group = (runs) => {
    const map = new Map();
    for (const run of runs) {
      const key = keyOf(run);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(run);
    }
    return map;
  };
  const baseRuns = group(baseline.runs);
  const nextRuns = group(candidate.runs);
  const keys = new Set([...baseRuns.keys(), ...nextRuns.keys()]);
  const rows = [];
  for (const key of keys) {
    const before = baseRuns.get(key) ?? [];
    const after = nextRuns.get(key) ?? [];
    const sample = before[0] ?? after[0];
    const reasons = [...globalReasons];
    if (!before.length || !after.length) reasons.push('仅一侧包含该题目与模型');
    if (before.length !== after.length) reasons.push('重复运行次数不同');
    if (!comparableTask(baseTasks.get(sample.task_id), nextTasks.get(sample.task_id))) reasons.push('题目或评分规则快照不同');
    if (!comparableModel(baseModels.get(sample.model_id), nextModels.get(sample.model_id))) reasons.push('模型身份或生成参数快照不同');
    const valid = (runs) => runs.length > 0 && runs.every((run) => run.status === 'completed' && !run.is_mock && !run.is_external && run.score !== null && Number.isFinite(Number(run.score)));
    if (!valid(before) || !valid(after)) reasons.push('包含失败、Mock、外部回答或未评分运行');
    const baselineScore = reasons.length ? null : average(before.map((run) => Number(run.score)));
    const candidateScore = reasons.length ? null : average(after.map((run) => Number(run.score)));
    const delta = baselineScore === null ? null : candidateScore - baselineScore;
    rows.push({ taskId: sample.task_id, modelId: sample.model_id, baselineRuns: before.length, candidateRuns: after.length,
      baselineScore, candidateScore, delta, status: reasons.length ? 'excluded' : delta < -threshold ? 'fail' : 'pass', reasons });
  }
  rows.sort((a, b) => a.taskId.localeCompare(b.taskId) || a.modelId.localeCompare(b.modelId));
  const comparable = rows.filter((row) => row.status !== 'excluded');
  const excluded = rows.length - comparable.length;
  const status = !comparable.length ? 'blocked' : comparable.some((row) => row.status === 'fail') ? 'fail' : excluded ? 'warn' : 'pass';
  return { status, threshold: { maxScoreDrop: threshold }, comparableCount: comparable.length, excludedCount: excluded,
    averageDelta: comparable.length ? average(comparable.map((row) => row.delta)) : null, rows };
}
