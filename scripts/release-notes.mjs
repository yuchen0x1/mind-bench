import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const history = readFileSync(join(root, 'docs/releases/release-notes.md'), 'utf8');
const block = history.split(/^## /m).slice(1).find((part) => part.startsWith(`${version} `));
if (!block) throw new Error(`Missing user-facing release notes for ${version}`);
process.stdout.write(`## ${block.trim()}\n`);
