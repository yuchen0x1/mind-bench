import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeAll, vi } from 'vitest';

process.env.MIND_BENCH_TEST_MODE = '1';
process.env.MIND_BENCH_DATA_DIR = mkdtempSync(join(tmpdir(), 'mind-bench-vitest-'));

beforeAll(() => {
  vi.stubEnv('TZ', 'UTC');
});

afterEach(() => {
  vi.restoreAllMocks();
});
