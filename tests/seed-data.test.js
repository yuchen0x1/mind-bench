import { describe, expect, it } from 'vitest';
import { categories, buildSeedTasks } from '../src/seed-data.mjs';

describe('benchmark seed quality gates', () => {
  const tasks = buildSeedTasks();

  it('contains the required 15 categories and at least 200 distinct task ids', () => {
    expect(categories).toHaveLength(15);
    expect(tasks.length).toBeGreaterThanOrEqual(200);
    expect(new Set(tasks.map((task) => task.id)).size).toBe(tasks.length);
  });

  it('provides at least 10 tasks in each category', () => {
    for (const [categoryId] of categories) {
      expect(tasks.filter((task) => task.categoryId === categoryId).length).toBeGreaterThanOrEqual(10);
    }
  });

  it('labels seed items as original drafts instead of third-party benchmarks', () => {
    expect(tasks.every((task) => task.sourceId === 'source-original-v1')).toBe(true);
    expect(tasks.every((task) => task.notes.includes('非外部权威基准'))).toBe(true);
  });

  it('keeps subjective tasks on the manual scoring path', () => {
    const manual = tasks.filter((task) => task.scoringRule.method === 'manual');
    expect(manual.length).toBeGreaterThan(10);
    expect(manual.every((task) => task.verificationStatus === 'draft')).toBe(true);
  });
});
