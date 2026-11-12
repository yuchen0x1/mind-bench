import { describe, expect, it } from 'vitest';
import { aggregateVerdicts, buildJudgePrompt, parseVerdict, rubricFor } from '../src/judge.mjs';

const task = {
  title: '连续折扣',
  prompt_zh: '商品先涨价20%，再打八折，最终价格如何变化？',
  reference_answer: '1.2×0.8=0.96，下降4%。',
  scoring_dimensions: [
    { name: '正确性', weight: 3 },
    { name: '推理质量', weight: 1 },
  ],
};

const valid = {
  dimensions: [
    { name: '正确性', score: 100, reason: '结论为下降 4%，正确。' },
    { name: '推理质量', score: 80, reason: '给出了 1.2×0.8 的计算。' },
  ],
  verdict: 'pass',
  confidence: 0.9,
  notes: '与参考答案一致。',
};

describe('AI judge prompt construction', () => {
  it('hides the candidate model identity and fixes the rubric', () => {
    const prompt = buildJudgePrompt({
      task,
      response: '最终下降4%。',
      anonymizedLabel: '候选A',
      modelName: 'secret-model-name',
      provider: 'Secret Provider',
    });
    expect(prompt).toContain('候选A');
    expect(prompt).not.toContain('secret-model-name');
    expect(prompt).not.toContain('Secret Provider');
    expect(prompt).toContain('正确性（权重 3）');
    expect(prompt).toContain('不要因为回答更长、更礼貌');
    expect(prompt).toContain('只输出一个 JSON 对象');
  });

  it('falls back to default dimensions when a task has no rubric', () => {
    expect(rubricFor({ scoring_dimensions: [] }).map((item) => item.name)).toEqual([
      '正确性',
      '推理质量',
      '约束遵循',
    ]);
  });
});

describe('AI judge output validation', () => {
  it('accepts strict JSON and recomputes the weighted total server-side', () => {
    const parsed = parseVerdict(JSON.stringify({ ...valid, overall: 0 }), task);
    expect(parsed.ok).toBe(true);
    expect(parsed.verdict.overall).toBe(95);
    expect(parsed.verdict.dimensions[0].weight).toBe(3);
  });

  it('accepts JSON wrapped in a code fence but still validates it', () => {
    const parsed = parseVerdict('```json\n' + JSON.stringify(valid) + '\n```', task);
    expect(parsed.ok).toBe(true);
  });

  it('rejects free text, missing dimensions, invented dimensions and out-of-range scores', () => {
    expect(parseVerdict('这个回答很好，我给 90 分。', task).ok).toBe(false);
    expect(
      parseVerdict(JSON.stringify({ ...valid, dimensions: [valid.dimensions[0]] }), task).errors.join(),
    ).toContain('缺少维度评分');
    expect(
      parseVerdict(
        JSON.stringify({
          ...valid,
          dimensions: [...valid.dimensions, { name: '创造力', score: 90, reason: 'x' }],
        }),
        task,
      ).errors.join(),
    ).toContain('rubric 之外');
    expect(
      parseVerdict(
        JSON.stringify({
          ...valid,
          dimensions: [
            { name: '正确性', score: 120, reason: 'x' },
            valid.dimensions[1],
          ],
        }),
        task,
      ).ok,
    ).toBe(false);
  });

  it('rejects mock verdicts so simulated data cannot create a score', () => {
    const parsed = parseVerdict(JSON.stringify({ ...valid, mock: true }), task);
    expect(parsed.ok).toBe(false);
    expect(parsed.errors[0]).toContain('模拟');
  });
});

describe('multi-judge aggregation', () => {
  it('averages independent judges and reports disagreement instead of hiding it', () => {
    const a = parseVerdict(JSON.stringify(valid), task).verdict;
    const b = parseVerdict(
      JSON.stringify({
        dimensions: [
          { name: '正确性', score: 60, reason: '结论正确但缺少换算。' },
          { name: '推理质量', score: 40, reason: '推理跳步。' },
        ],
        verdict: 'partial',
        confidence: 0.6,
      }),
      task,
    ).verdict;
    const aggregate = aggregateVerdicts([a, b]);
    expect(aggregate.overall).toBe(75);
    expect(aggregate.spread).toBe(40);
    expect(aggregate.agreement).toBe(0.6);
    expect(aggregate.verdict).toBe('partial');
    expect(aggregate.judgeCount).toBe(2);
    expect(aggregate.dimensions.every((dimension) => dimension.judges === 2)).toBe(true);
  });

  it('returns null when no judge produced a valid verdict', () => {
    expect(aggregateVerdicts([null, undefined])).toBeNull();
  });
});
