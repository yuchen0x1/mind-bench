import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:net';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const archive = resolve(process.argv[2] || join(root, `.tmp/releases/mind-bench-${pkg.version}.tar.gz`));
const work = mkdtempSync(join(tmpdir(), 'mind-bench-release-check-'));
if (dirname(work) !== resolve(tmpdir()) || !basename(work).startsWith('mind-bench-release-check-')) throw new Error('Unexpected verification path.');
const app = join(work, `mind-bench-${pkg.version}`);
let child;
try {
  const expected = readFileSync(join(dirname(archive), 'SHA256SUMS.txt'), 'utf8').split(/\r?\n/)
    .find((line) => line.endsWith(`  ${basename(archive)}`))?.split('  ')[0];
  const digest = createHash('sha256').update(readFileSync(archive)).digest('hex');
  if (digest !== expected) throw new Error('Archive SHA-256 mismatch.');
  execFileSync('tar', ['-xzf', archive, '-C', work]);
  const manifest = JSON.parse(readFileSync(join(app, 'release-manifest.json'), 'utf8'));
  for (const [file, hash] of Object.entries(manifest.files)) {
    if (createHash('sha256').update(readFileSync(join(app, file))).digest('hex') !== hash) throw new Error(`File digest mismatch: ${file}`);
  }
  // Use npm's JS entry point so paths with spaces work on Windows without a shell.
  const npmCli = process.env.npm_execpath;
  if (!npmCli) throw new Error('Run this check through npm run verify:release.');
  const installArgs = [npmCli, 'ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'];
  if (process.env.MIND_BENCH_RELEASE_OFFLINE === '1') installArgs.push('--offline');
  execFileSync(process.execPath, installArgs, { cwd: app, stdio: 'inherit' });
  const probe = createServer();
  await new Promise((done) => probe.listen(0, '127.0.0.1', done));
  const port = probe.address().port;
  await new Promise((done) => probe.close(done));
  const env = { ...process.env, HOST: '127.0.0.1', PORT: String(port), MIND_BENCH_TEST_MODE: '1', MIND_BENCH_DATA_DIR: join(work, 'data') };
  delete env.MIND_BENCH_SECRET;
  child = spawn(process.execPath, [join(app, 'src/server.mjs')], { cwd: app, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  child.on('error', (error) => { output += error.message; });
  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Packaged server exited: ${output}`);
    try { ready = (await fetch(`${base}/api/health`)).ok; } catch {}
    if (ready) break;
    await new Promise((done) => setTimeout(done, 100));
  }
  if (!ready) throw new Error(`Packaged server did not start: ${output}`);
  const version = await (await fetch(`${base}/api/version`)).json();
  if (version.version !== pkg.version) throw new Error('Packaged version mismatch.');
  const page = await fetch(base);
  const html = await page.text();
  if (!page.ok || !html.includes('/assets/')) throw new Error('Packaged UI missing.');
  for (const [, asset] of html.matchAll(/(?:src|href)="(\/assets\/[^"\s]+)"/g)) {
    if (!(await fetch(base + asset)).ok) throw new Error(`Missing UI asset: ${asset}`);
  }
  const dashboard = await (await fetch(`${base}/api/dashboard`)).json();
  if (dashboard.stats.taskCount < 200 || dashboard.stats.modelCount !== 0) throw new Error('Unexpected initial data.');
  console.log(`PASS standalone release ${pkg.version}: SHA-256, ${Object.keys(manifest.files).length} file hashes, clean production install, UI assets, API and empty user data.`);
} finally {
  if (child && child.exitCode === null) {
    const closed = new Promise((done) => child.once('close', done));
    child.kill();
    await closed;
  }
  rmSync(work, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
