import { describe, expect, it } from 'vitest';
import { scoreAnswer, scoreToMindBenchScore } from '../src/scoring.mjs';

describe('objective scoring', () => {
  it('normalizes exact answers without accepting partial matches', () => {
    expect(scoreAnswer({ method: 'exact', target: '  A   B ' }, '', 'a b').score).toBe(100);
    expect(scoreAnswer({ method: 'exact', target: 'blue' }, '', 'blue sky').score).toBe(0);
  });

  it('scores one of multiple allowed answers', () => {
    expect(scoreAnswer({ method: 'one_of', targets: ['1/2', '0.5'] }, '', '0.5').passed).toBe(true);
    expect(scoreAnswer({ method: 'one_of', targets: ['1/2', '0.5'] }, '', '50%').passed).toBe(false);
  });

  it('applies keyword coverage deterministically', () => {
    const result = scoreAnswer({ method: 'all_keywords', keywords: ['counterexample', 'invalid'] }, '', 'The argument is invalid.');
    expect(result.score).toBe(50);
    expect(result.passed).toBe(false);
  });

  it('checks numeric targets and tolerance', () => {
    expect(scoreAnswer({ method: 'numeric', targets: [0.5], tolerance: 0.01 }, '', 'Answer: 0.501').passed).toBe(true);
    expect(scoreAnswer({ method: 'numeric', targets: [8] }, '', 'There is no number.').score).toBe(0);
  });

  it('validates JSON syntax, exact values and keys', () => {
    expect(scoreAnswer({ method: 'json', requiredKeys: ['ok', 'count'], expectedValues: { ok: true, count: 3 } }, '', '{"ok":true,"count":3}').passed).toBe(true);
    expect(scoreAnswer({ method: 'json', requiredKeys: ['ok'], allowExtraKeys: false }, '', '{"ok":true,"extra":1}').passed).toBe(false);
    expect(scoreAnswer({ method: 'json' }, '', 'not-json').passed).toBe(false);
  });

  it('never coerces manual tasks into objective scores', () => {
    expect(scoreAnswer({ method: 'manual' }, 'reference', 'response').score).toBeNull();
  });

  it('converts configured category scores to the 1000-point scale', () => {
    expect(scoreToMindBenchScore({ logic: 80, math: 40 }, { logic: 3, math: 1 })).toBe(700);
    expect(scoreToMindBenchScore({ logic: 90 }, { logic: 0 })).toBeNull();
  });
});
