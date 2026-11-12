import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const testDataDir = mkdtempSync(join(tmpdir(), 'mind-bench-playwright-'));

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:3000', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run start',
    url: 'http://127.0.0.1:3000/api/health',
    reuseExistingServer: false,
    env: { ...process.env, MIND_BENCH_TEST_MODE: '1', MIND_BENCH_DATA_DIR: testDataDir },
    timeout: 30000,
  },
});
