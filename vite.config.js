import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';

const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const buildId = process.env.BUILD_ID || process.env.GITHUB_SHA?.slice(0, 12) || 'local';
const buildTimestamp = process.env.BUILD_TIMESTAMP || new Date().toISOString();
const buildInfoPlugin = () => ({
  name: 'mind-bench-build-info',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'build-info.json',
      source: JSON.stringify({ name: 'MIND BENCH', version: packageJson.version, buildId, buildTimestamp, channel: process.env.BUILD_CHANNEL || 'stable' }, null, 2),
    });
  },
});

export default defineConfig({
  plugins: [react(), buildInfoPlugin()],
  define: {
    __MIND_BENCH_VERSION__: JSON.stringify(packageJson.version),
    __MIND_BENCH_BUILD_ID__: JSON.stringify(buildId),
  },
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  build: { chunkSizeWarningLimit: 900 },
  test: { environment: 'node', include: ['tests/**/*.test.js'], setupFiles: ['tests/setup.js'], testTimeout: 20000, hookTimeout: 20000 },
});
