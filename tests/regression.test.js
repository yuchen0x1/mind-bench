import { describe, expect, it } from 'vitest';
import { compareSessions } from '../src/regression.mjs';
import { createHash } from 'node:crypto';

const task = { id: 'task-1', version: '1', promptZh: 'Question', promptEn: '', referenceAnswer: 'Answer', scoringRule: { method: 'exact' }, scoringDimensions: [] };
const model = { id: 'model-1', providerId: 'provider-1', providerKind: 'openai', modelId: 'model-v1', modelVersion: '1', temperature: 0, maxTokens: 100 };
const seal = (payload) => ({ ...payload, integrity: { algorithm: 'sha256', value: createHash('sha256').update(JSON.stringify(payload)).digest('hex') } });
const manifest = () => seal({ manifestVersion: '1.1.0', tasks: [structuredClone(task)], models: [structuredClone(model)], scoring: { objectiveScorer: '1', weightSnapshot: {} }, session: { settings: {} }, execution: { flags: { external: false } } });
const run = (score, extra = {}) => ({ task_id: task.id, model_id: model.id, status: 'completed', is_mock: 0, is_external: 0, score, ...extra });
const session = (scores, m = manifest()) => ({ manifest: m, runs: scores.map((score) => run(score)) });

describe('manifest regression gate', () => {
  it('averages matching repeat runs and fails on a score drop beyond threshold', () => {
    const result = compareSessions(session([90, 80]), session([70, 60]), { maxScoreDrop: 5 });
    expect(result.status).toBe('fail');
    expect(result.rows[0]).toMatchObject({ baselineScore: 85, candidateScore: 65, delta: -20, status: 'fail' });
  });

  it('blocks rather than passing when only mock or unscored runs exist', () => {
    const baseline = session([90]);
    const candidate = session([null]);
    candidate.runs[0].is_mock = 1;
    expect(compareSessions(baseline, candidate)).toMatchObject({ status: 'blocked', comparableCount: 0, excludedCount: 1 });
  });

  it('excludes changed task snapshots, changed model versions and unequal repeats', () => {
    const changedTask = manifest(); changedTask.tasks[0].referenceAnswer = 'Changed';
    expect(compareSessions(session([90]), session([80], changedTask)).rows[0].reasons).toContain('题目或评分规则快照不同');
    expect(compareSessions(session([90]), session([80], changedTask)).rows[0].reasons).toContain('缺少可验证的运行清单或摘要不匹配');
    const changedModel = manifest(); changedModel.models[0].modelVersion = '2';
    expect(compareSessions(session([90]), session([80], changedModel)).rows[0].reasons).toContain('模型身份或生成参数快照不同');
    expect(compareSessions(session([90, 90]), session([80])).rows[0].reasons).toContain('重复运行次数不同');
  });

  it('warns when comparable rows coexist with excluded coverage and rejects invalid thresholds', () => {
    const base = session([90]);
    base.runs.push(run(70, { task_id: 'task-2' }));
    const result = compareSessions(base, session([91]));
    expect(result).toMatchObject({ status: 'warn', comparableCount: 1, excludedCount: 1 });
    expect(() => compareSessions(base, session([91]), { maxScoreDrop: -1 })).toThrow(RangeError);
  });
});
