import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const build = JSON.parse(readFileSync(join(root, 'dist/build-info.json'), 'utf8'));
if (build.version !== pkg.version) throw new Error('Build version differs from package.json. Run npm run build first.');
const output = resolve(process.argv[2] || join(root, '.tmp/releases'));
mkdirSync(output, { recursive: true });
const stage = mkdtempSync(join(tmpdir(), 'mind-bench-package-'));
if (dirname(stage) !== resolve(tmpdir()) || !basename(stage).startsWith('mind-bench-package-')) throw new Error('Unexpected staging path.');
const name = `mind-bench-${pkg.version}`;
const appDir = join(stage, name);
const archive = join(output, `${name}.tar.gz`);
const included = ['dist', 'src', 'public', 'docs', 'screenshots', 'scripts', 'tests', 'package.json', 'package-lock.json', 'index.html', 'vite.config.js', 'playwright.config.js', 'README.md', 'CHANGELOG.md', 'CONTRIBUTING.md', 'LICENSE', 'THIRD_PARTY_LICENSES.md', 'SECURITY.md', 'Dockerfile', 'compose.yaml', '.dockerignore', '.gitignore'];
const hashes = {};
const hash = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
function inspect(path) {
  const stat = lstatSync(path);
  if (stat.isSymbolicLink()) throw new Error(`Symlinks are not allowed in releases: ${path}`);
  if (stat.isDirectory()) { for (const item of readdirSync(path)) inspect(join(path, item)); return; }
  const file = relative(appDir, path).replaceAll('\\', '/');
  if (/(^|\/)(?:data|node_modules|\.git|\.env(?:\..*)?|\.key)(?:\/|$)|\.sqlite(?:-\w+)?$/i.test(file)) throw new Error(`Private data in release: ${file}`);
  hashes[file] = hash(path);
}
try {
  mkdirSync(appDir);
  for (const item of included) {
    const source = join(root, item);
    if (!existsSync(source)) throw new Error(`Missing release file: ${item}`);
    cpSync(source, join(appDir, item), { recursive: true });
  }
  inspect(appDir);
  writeFileSync(join(appDir, 'release-manifest.json'), JSON.stringify({ name: pkg.name, version: pkg.version, build, files: hashes }, null, 2) + '\n');
  execFileSync('tar', ['-czf', archive, '-C', stage, name], { stdio: 'inherit' });
  writeFileSync(join(output, 'SHA256SUMS.txt'), `${hash(archive)}  ${basename(archive)}\n`);
  console.log(`Packaged ${basename(archive)} (${Object.keys(hashes).length} files, no user data).`);
} finally { rmSync(stage, { recursive: true, force: true }); }
