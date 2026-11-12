import { DatabaseSync } from 'node:sqlite';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { categories, buildSeedTasks } from './seed-data.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const defaultDataDir = resolve(root, 'data');
const dataDir = resolve(process.env.MIND_BENCH_DATA_DIR || defaultDataDir);
if (process.env.MIND_BENCH_TEST_MODE === '1' && dataDir === defaultDataDir) {
  throw new Error('测试模式必须使用独立的 MIND_BENCH_DATA_DIR。');
}
mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(resolve(dataDir, 'mind-bench.sqlite'));
db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
db.exec(readFileSync(resolve(root, 'src/schema.sql'), 'utf8'));

/** 轻量迁移：仅添加缺失列，不改写既有数据。 */
function ensureColumn(table, column, definition) {
  const exists = db.prepare(`PRAGMA table_info(${table})`).all().some((row) => row.name === column);
  if (!exists) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
ensureColumn('benchmark_tasks', 'derived_from', "TEXT NOT NULL DEFAULT ''");
ensureColumn('custom_prompts', 'notes', "TEXT NOT NULL DEFAULT ''");
ensureColumn('test_runs', 'is_external', "INTEGER NOT NULL DEFAULT 0");
ensureColumn('test_sessions', 'run_manifest', "TEXT NOT NULL DEFAULT '{}'");

const now = () => new Date().toISOString();
export const uuid = () => randomUUID();
const keyPath = resolve(dataDir, '.key');
let masterKey;
if (process.env.MIND_BENCH_SECRET) {
  masterKey = scryptSync(process.env.MIND_BENCH_SECRET, 'mind-bench-provider-key-v1', 32);
} else {
  try {
    if (!existsSync(keyPath)) writeFileSync(keyPath, randomBytes(32), { mode: 0o600, flag: 'wx' });
    masterKey = readFileSync(keyPath);
    if (masterKey.length !== 32) throw new Error('Invalid local key length');
    try { chmodSync(keyPath, 0o600); } catch {}
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    masterKey = readFileSync(keyPath);
  }
}

export function encryptSecret(secret) {
  if (!secret) return '';
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', masterKey, iv);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return [iv.toString('base64'), cipher.getAuthTag().toString('base64'), ciphertext.toString('base64')].join('.');
}
export function decryptSecret(payload) {
  if (!payload) return '';
  const [iv, tag, ciphertext] = payload.split('.').map((part) => Buffer.from(part, 'base64'));
  const decipher = createDecipheriv('aes-256-gcm', masterKey, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

function transaction(callback) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = callback();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

const categoryInsert = db.prepare('INSERT OR IGNORE INTO benchmark_categories (id,name,name_en,description,icon,sort_order) VALUES (?,?,?,?,?,?)');
const sourceInsert = db.prepare('INSERT OR IGNORE INTO benchmark_sources (id,name,url,license,source_type,notes) VALUES (?,?,?,?,?,?)');
const taskInsert = db.prepare(`INSERT OR IGNORE INTO benchmark_tasks
  (id,title,category_id,subcategory,difficulty,prompt_zh,prompt_en,source_id,objective,reference_answer,scoring_rule,scoring_dimensions,common_errors,notes,version,verification_status,is_public,created_at,updated_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
const versionInsert = db.prepare('INSERT OR IGNORE INTO benchmark_task_versions (id,task_id,version,snapshot,change_note,created_at) VALUES (?,?,?,?,?,?)');
const seed = db.prepare(`INSERT OR IGNORE INTO system_settings (key,value,updated_at) VALUES ('score_weights',?,?)`);
const seedOwner = db.prepare(`INSERT OR IGNORE INTO users (id,email,display_name,role,created_at) VALUES ('local-owner',NULL,'Local owner','owner',?)`);
transaction(() => {
  for (const [id, name, en, desc, icon] of categories) categoryInsert.run(id, name, en, desc, icon, categories.findIndex((item) => item[0] === id));
  sourceInsert.run('source-original-v1', 'MIND BENCH 原创题库（初始草案）', '', 'CC0-1.0', 'original', '项目原创编写；不是外部权威基准。初稿尚待逐题人工复核。');
  seedOwner.run(now());
  for (const task of buildSeedTasks()) {
    const timestamp = now();
    const snapshot = JSON.stringify(task);
    taskInsert.run(task.id, task.title, task.categoryId, task.subcategory, task.difficulty, task.promptZh, task.promptEn, task.sourceId, task.objective, task.referenceAnswer, JSON.stringify(task.scoringRule), JSON.stringify(task.scoringDimensions), JSON.stringify(task.commonErrors), task.notes, task.version, task.verificationStatus, task.isPublic ? 1 : 0, timestamp, timestamp);
    versionInsert.run(uuid(), task.id, task.version, snapshot, '初始导入', timestamp);
  }
  seed.run(JSON.stringify(Object.fromEntries(categories.map(([id]) => [id, 1]))), now());
});

export { db, now };

export function getTask(id) {
  return db.prepare(`SELECT t.*, c.name AS category_name, c.name_en AS category_name_en, s.name AS source_name, s.url AS source_url, s.license AS source_license, s.source_type AS source_type
    FROM benchmark_tasks t JOIN benchmark_categories c ON c.id=t.category_id JOIN benchmark_sources s ON s.id=t.source_id WHERE t.id=?`).get(id);
}
export function listTasks({ category, difficulty, search, source, limit = 500, offset = 0 } = {}) {
  const where = ['t.is_public=1']; const params = [];
  if (category) { where.push('t.category_id=?'); params.push(category); }
  if (difficulty) { where.push('t.difficulty=?'); params.push(difficulty); }
  if (source) { where.push('t.source_id=?'); params.push(source); }
  if (search) { where.push('(t.title LIKE ? OR t.prompt_zh LIKE ? OR t.subcategory LIKE ?)'); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  params.push(Math.min(1000, Math.max(1, Number(limit) || 500)), Math.max(0, Number(offset) || 0));
  return db.prepare(`SELECT t.*, c.name AS category_name, c.name_en AS category_name_en, s.name AS source_name, s.license AS source_license, s.source_type AS source_type FROM benchmark_tasks t JOIN benchmark_categories c ON c.id=t.category_id JOIN benchmark_sources s ON s.id=t.source_id WHERE ${where.join(' AND ')} ORDER BY c.sort_order,t.id LIMIT ? OFFSET ?`).all(...params);
}
export function listModels() {
  return db.prepare(`SELECT m.*, p.name AS provider_name, p.kind AS provider_kind, p.base_url AS base_url, p.enabled AS provider_enabled,
    CASE WHEN p.api_key_cipher='' THEN 0 ELSE 1 END AS has_api_key
    FROM models m JOIN providers p ON p.id=m.provider_id ORDER BY m.is_default DESC,p.name,m.name`).all();
}
export function safeJson(text, fallback) { try { return JSON.parse(text); } catch { return fallback; } }
export function audit(action, entityType, entityId = '', details = {}) {
  db.prepare('INSERT INTO audit_logs (id,action,entity_type,entity_id,details,created_at) VALUES (?,?,?,?,?,?)').run(uuid(), action, entityType, String(entityId), JSON.stringify(details), now());
}
