import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const testDataDir = mkdtempSync(join(tmpdir(), 'mind-bench-playwright-'));
const testPort = Number(process.env.MIND_BENCH_E2E_PORT || 3101);
const baseURL = `http://127.0.0.1:${testPort}`;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  retries: 0,
  reporter: [['list']],
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run start',
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    env: { ...process.env, PORT: String(testPort), HOST: '127.0.0.1', MIND_BENCH_SECRET: '', MIND_BENCH_TEST_MODE: '1', MIND_BENCH_DATA_DIR: testDataDir },
    timeout: 30000,
  },
});
