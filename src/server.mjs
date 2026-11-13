import express from 'express';
import { createServer } from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { db, encryptSecret, getTask, listModels, listTasks, now, safeJson, uuid, audit } from './db.mjs';
import { scoreAnswer, scoreToMindBenchScore } from './scoring.mjs';
import { checkProviderConnection, invokeModel, listProviderModels } from './providers.mjs';
import { aggregateVerdicts, buildJudgePrompt, parseVerdict, rubricFor, verdictRationale } from './judge.mjs';

const app = express();
app.disable('x-powered-by');
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(projectRoot, 'dist');
const packageJson = JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf8'));
const buildInfoPath = resolve(dist, 'build-info.json');
const buildInfo = existsSync(buildInfoPath)
  ? JSON.parse(readFileSync(buildInfoPath, 'utf8'))
  : {
      name: 'MIND BENCH',
      version: process.env.APP_VERSION || packageJson.version,
      buildId: process.env.BUILD_ID || process.env.GITHUB_SHA?.slice(0, 12) || 'local',
      buildTimestamp: process.env.BUILD_TIMESTAMP || null,
      channel: process.env.BUILD_CHANNEL || 'stable',
    };
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
// A local service must not accept browser requests from arbitrary websites.
app.use('/api', (req, res, next) => {
  const loopbackOnly = !process.env.HOST || ['127.0.0.1', 'localhost', '::1'].includes(process.env.HOST);
  if (loopbackOnly && !['127.0.0.1', 'localhost', '::1', '[::1]'].includes(req.hostname)) {
    return res.status(403).json({ error: '仅允许通过本机地址访问 API。' });
  }
  const origin = req.get('origin');
  if (req.get('sec-fetch-site') === 'cross-site' || (origin && origin !== `${req.protocol}://${req.get('host')}`)) {
    return res.status(403).json({ error: '拒绝跨站请求，请从本机应用页面操作。' });
  }
  next();
});
app.use(express.json({ limit: '8mb', strict: true }));
app.use((req, res, next) => {
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('referrer-policy', 'no-referrer');
  res.setHeader('x-frame-options', 'DENY');
  res.setHeader('content-security-policy', "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
  next();
});
const rateBuckets = new Map();
app.use('/api', (req, res, next) => {
  const key = req.ip ?? req.socket.remoteAddress ?? 'local';
  const time = Date.now();
  let bucket = rateBuckets.get(key);
  if (!bucket || bucket.start < time - 60_000) { bucket = { start: time, count: 0 }; rateBuckets.set(key, bucket); }
  bucket.count++;
  if (bucket.count > 240) return res.status(429).json({ error: '请求过于频繁，请稍后重试。' });
  next();
});

const safeModel = (row) => {
  if (!row) return row;
  const { api_key_cipher, ...rest } = row;
  return { ...rest, has_api_key: Boolean(row.has_api_key ?? api_key_cipher) };
};
const parseTask = (row) => row && ({ ...row, scoring_rule: safeJson(row.scoring_rule, {}), scoring_dimensions: safeJson(row.scoring_dimensions, []), common_errors: safeJson(row.common_errors, []), is_public: Boolean(row.is_public) });
const modelById = db.prepare(`SELECT m.*, p.name AS provider_name, p.kind AS provider_kind, p.base_url, p.api_key_cipher, p.enabled AS provider_enabled FROM models m JOIN providers p ON p.id=m.provider_id WHERE m.id=?`);
const writeAudit = (action, type, id, fields = {}) => audit(action, type, id, fields);
const required = (body, fields) => fields.filter((field) => !String(body[field] ?? '').trim());
const concurrencyLimit = Math.max(1, Math.min(8, Number(process.env.MIND_BENCH_CONCURRENCY) || 4));
const activeSessions = new Map();
const asyncPool = async (items, limit, worker) => {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      await worker(items[index]);
    }
  });
  await Promise.all(workers);
};

app.get('/api/health', (_req, res) => res.json({ ok: true, name: 'MIND BENCH', now: now(), database: 'sqlite', concurrencyLimit }));
app.get('/api/version', (_req, res) => {
  res.setHeader('cache-control', 'no-store, max-age=0');
  res.json({ ...buildInfo, checkedAt: now(), releaseUrl: process.env.APP_RELEASE_URL || null });
});
app.get('/api/dashboard', (_req, res) => {
  const taskCount = db.prepare('SELECT COUNT(*) AS n FROM benchmark_tasks WHERE is_public=1').get().n;
  const categoryCount = db.prepare('SELECT COUNT(*) AS n FROM benchmark_categories').get().n;
  const modelCount = db.prepare('SELECT COUNT(*) AS n FROM models WHERE enabled=1').get().n;
  const realRuns = db.prepare("SELECT COUNT(*) AS n FROM test_runs WHERE is_mock=0 AND is_external=0 AND status='completed'").get().n;
  const sessions = db.prepare('SELECT COUNT(*) AS n FROM test_sessions').get().n;
  const completed = db.prepare("SELECT COUNT(*) AS n FROM test_runs WHERE status='completed' AND is_mock=0 AND is_external=0").get().n;
  const average = db.prepare("SELECT AVG(e.score) AS score FROM evaluation_results e JOIN test_runs r ON r.id=e.run_id WHERE r.status='completed' AND r.is_mock=0 AND r.is_external=0 AND e.score IS NOT NULL").get().score;
  const recent = db.prepare(`SELECT r.id,r.status,r.is_mock,r.is_external,r.started_at,r.task_id,t.title AS task_title,m.name AS model_name,c.name AS category_name,e.score,p.response_text,p.latency_ms
    FROM test_runs r JOIN benchmark_tasks t ON t.id=r.task_id JOIN benchmark_categories c ON c.id=t.category_id JOIN models m ON m.id=r.model_id
    LEFT JOIN evaluation_results e ON e.run_id=r.id LEFT JOIN (SELECT run_id, raw_text AS response_text, latency_ms FROM model_responses) p ON p.run_id=r.id
    ORDER BY r.started_at DESC LIMIT 12`).all();
  const categories = db.prepare(`SELECT c.id,c.name,c.icon,COUNT(DISTINCT t.id) AS task_count,AVG(e.score) AS average_score
    FROM benchmark_categories c LEFT JOIN benchmark_tasks t ON t.category_id=c.id AND t.is_public=1
    LEFT JOIN test_runs r ON r.task_id=t.id AND r.status='completed' AND r.is_mock=0 AND r.is_external=0 LEFT JOIN evaluation_results e ON e.run_id=r.id
    GROUP BY c.id ORDER BY c.sort_order`).all();
  const trend = db.prepare(`SELECT substr(r.completed_at,1,10) AS day, COUNT(*) AS runs, ROUND(AVG(e.score),1) AS score
    FROM test_runs r JOIN evaluation_results e ON e.run_id=r.id
    WHERE r.is_mock=0 AND r.is_external=0 AND r.status='completed' AND e.score IS NOT NULL AND r.completed_at>=datetime('now','-30 days')
    GROUP BY day ORDER BY day`).all();
  res.json({ stats: { taskCount, categoryCount, modelCount, realRuns, sessions, averageScore: average === null ? null : Math.round(average), completionRate: realRuns ? Math.round(completed / (completed + db.prepare("SELECT COUNT(*) AS n FROM test_runs WHERE status='failed' AND is_mock=0 AND is_external=0").get().n || 1) * 100) : null }, recent, categories, trend, leaderboard: buildLeaderboard({ limit: 5 }).eligible });
});
app.get('/api/categories', (_req, res) => {
  const rows = db.prepare(`SELECT c.id,c.name,c.name_en,c.description,c.icon,c.sort_order,COUNT(DISTINCT t.id) AS task_count,
    COUNT(DISTINCT CASE WHEN t.difficulty='easy' THEN t.id END) AS easy_count,
    COUNT(DISTINCT CASE WHEN t.difficulty='medium' THEN t.id END) AS medium_count,
    COUNT(DISTINCT CASE WHEN t.difficulty='hard' THEN t.id END) AS hard_count,
    COUNT(DISTINCT CASE WHEN t.difficulty='expert' THEN t.id END) AS expert_count,
    AVG(CASE WHEN r.is_mock=0 AND r.is_external=0 THEN e.score END) AS average_score
    FROM benchmark_categories c LEFT JOIN benchmark_tasks t ON t.category_id=c.id AND t.is_public=1
    LEFT JOIN test_runs r ON r.task_id=t.id AND r.status='completed' LEFT JOIN evaluation_results e ON e.run_id=r.id
    GROUP BY c.id ORDER BY c.sort_order`).all();
  res.json(rows);
});
app.get('/api/tasks', (req, res) => {
  const { category, difficulty, q, source, limit, offset } = req.query;
  const tasks = listTasks({ category, difficulty, search: String(q ?? '').slice(0, 160), source, limit, offset }).map(parseTask);
  const where = ['is_public=1']; const countParams=[];
  if(category){where.push('category_id=?');countParams.push(category);}
  if(difficulty){where.push('difficulty=?');countParams.push(difficulty);}
  if(source){where.push('source_id=?');countParams.push(source);}
  if(q){where.push('(title LIKE ? OR prompt_zh LIKE ? OR subcategory LIKE ?)');countParams.push(`%${String(q).slice(0,160)}%`,`%${String(q).slice(0,160)}%`,`%${String(q).slice(0,160)}%`);}
  res.json({ tasks, total: db.prepare(`SELECT COUNT(*) AS n FROM benchmark_tasks WHERE ${where.join(' AND ')}`).get(...countParams).n });
});
app.get('/api/tasks/:id', (req, res) => {
  const task = getTask(req.params.id);
  if (!task || !task.is_public) return res.status(404).json({ error: '找不到这道题。' });
  const versions = db.prepare('SELECT version,change_note,created_at FROM benchmark_task_versions WHERE task_id=? ORDER BY created_at DESC').all(task.id);
  const favorite = Boolean(db.prepare('SELECT 1 FROM favorites WHERE task_id=?').get(task.id));
  const variants = db.prepare('SELECT id,name,prompt,notes,created_at,updated_at FROM custom_prompts WHERE task_id=? ORDER BY created_at DESC').all(task.id);
  const derivedFrom = task.derived_from ? getTask(task.derived_from) : null;
  res.json({ task: parseTask(task), versions, favorite, variants, derivedFrom: derivedFrom ? { id: derivedFrom.id, title: derivedFrom.title, version: derivedFrom.version } : null });
});
app.get('/api/tasks/:id/versions', (req, res) => {
  if (!getTask(req.params.id)) return res.status(404).json({ error: '找不到题目。' });
  const rows = db.prepare('SELECT id,version,change_note,snapshot,created_at FROM benchmark_task_versions WHERE task_id=? ORDER BY created_at DESC').all(req.params.id);
  res.json(rows.map((row) => ({ ...row, snapshot: safeJson(row.snapshot, {}) })));
});
app.post('/api/tasks/:id/variants', (req, res) => {
  const task = getTask(req.params.id);
  if (!task) return res.status(404).json({ error: '找不到题目。' });
  const prompt = String(req.body?.prompt ?? '').trim();
  if (!prompt) return res.status(400).json({ error: '变体提示词不能为空。' });
  const id = uuid(); const timestamp = now();
  db.prepare('INSERT INTO custom_prompts (id,task_id,name,prompt,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').run(id, task.id, String(req.body?.name ?? '未命名变体').slice(0, 120), prompt.slice(0, 20000), String(req.body?.notes ?? '').slice(0, 1000), timestamp, timestamp);
  audit('create', 'variant', id, { taskId: task.id });
  res.status(201).json({ variant: db.prepare('SELECT * FROM custom_prompts WHERE id=?').get(id) });
});
app.delete('/api/variants/:id', (req, res) => {
  const row = db.prepare('SELECT id FROM custom_prompts WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '找不到这个变体。' });
  db.prepare('DELETE FROM custom_prompts WHERE id=?').run(row.id);
  audit('delete', 'variant', row.id);
  res.json({ ok: true });
});
app.post('/api/tasks/:id/copy', (req, res) => {
  const source = getTask(req.params.id);
  if (!source) return res.status(404).json({ error: '找不到要复制的题目。' });
  const id = `custom-${uuid()}`; const timestamp = now();
  const version = '1.0.0';
  const title = String(req.body?.title ?? `${source.title}（副本）`).slice(0, 180);
  db.prepare('INSERT INTO benchmark_sources (id,name,url,license,source_type,notes) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').run('source-user', '用户自建题目', '', '由题目创建者决定', 'user', '用户自行添加或复制的题目，不代表 MIND BENCH 官方基准。');
  db.prepare(`INSERT INTO benchmark_tasks (id,title,category_id,subcategory,difficulty,prompt_zh,prompt_en,source_id,objective,reference_answer,scoring_rule,scoring_dimensions,common_errors,notes,version,verification_status,is_public,created_by,derived_from,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,'local-owner',?,?,?)`).run(id, title, source.category_id, source.subcategory, source.difficulty, source.prompt_zh, source.prompt_en, 'source-user', source.objective, source.reference_answer, source.scoring_rule, source.scoring_dimensions, source.common_errors, `复制自 ${source.id}（v${source.version}）。副本的修改不影响原题。`, version, 'user', source.id, timestamp, timestamp);
  db.prepare('INSERT INTO benchmark_task_versions (id,task_id,version,snapshot,change_note,created_at) VALUES (?,?,?,?,?,?)').run(uuid(), id, version, JSON.stringify({ copiedFrom: source.id }), `复制自 ${source.id}`, timestamp);
  audit('copy', 'task', id, { source: source.id });
  res.status(201).json({ task: parseTask(getTask(id)) });
});
app.delete('/api/tasks/:id', (req, res) => {
  const task = getTask(req.params.id);
  if (!task) return res.status(404).json({ error: '找不到题目。' });
  if (task.created_by !== 'local-owner') return res.status(403).json({ error: '内置题库题目不能删除；可复制为自建副本后修改。' });
  if (db.prepare('SELECT 1 FROM test_runs WHERE task_id=? LIMIT 1').get(task.id)) return res.status(409).json({ error: '该题已有测试记录，为保留可追溯性不能删除；可将题目设为非公开。' });
  db.prepare('DELETE FROM benchmark_tasks WHERE id=?').run(task.id);
  audit('delete', 'task', task.id);
  res.json({ ok: true });
});
app.get('/api/custom-tasks', (_req, res) => {
  const tasks = db.prepare(`SELECT t.id,t.title,t.category_id,c.name AS category_name,t.subcategory,t.difficulty,t.prompt_zh,t.prompt_en,t.reference_answer,t.scoring_rule,t.scoring_dimensions,t.common_errors,t.notes,t.version,t.verification_status,t.is_public,t.derived_from,t.created_at,t.updated_at,
    (SELECT COUNT(*) FROM custom_prompts v WHERE v.task_id=t.id) AS variant_count,
    (SELECT COUNT(*) FROM test_runs r WHERE r.task_id=t.id) AS run_count
    FROM benchmark_tasks t JOIN benchmark_categories c ON c.id=t.category_id
    WHERE t.created_by='local-owner' ORDER BY t.updated_at DESC`).all();
  res.json({ tasks: tasks.map(parseTask) });
});
app.post('/api/tasks', (req, res) => {
  const body = req.body ?? {};
  const missing = required(body, ['title', 'categoryId', 'subcategory', 'difficulty', 'promptZh', 'objective']);
  if (missing.length) return res.status(400).json({ error: `缺少必填字段：${missing.join(', ')}` });
  if (!db.prepare('SELECT 1 FROM benchmark_categories WHERE id=?').get(body.categoryId)) return res.status(400).json({ error: '测试分类不存在。' });
  const id = `custom-${uuid()}`; const timestamp = now();
  const rule = body.scoringRule ?? { method: 'manual' };
  const task = { id, title: String(body.title).slice(0, 180), categoryId: body.categoryId, subcategory: String(body.subcategory).slice(0, 100), difficulty: ['easy','medium','hard','expert'].includes(body.difficulty) ? body.difficulty : 'medium', promptZh: String(body.promptZh).slice(0, 20000), promptEn: String(body.promptEn ?? '').slice(0, 20000), sourceId: 'source-user', objective: String(body.objective).slice(0, 2000), referenceAnswer: String(body.referenceAnswer ?? '').slice(0, 10000), scoringRule: rule, scoringDimensions: body.scoringDimensions ?? [], commonErrors: body.commonErrors ?? [], notes: String(body.notes ?? '用户自行添加。').slice(0, 4000), version: '1.0.0', verificationStatus: 'user', isPublic: body.isPublic !== false };
  db.prepare(`INSERT INTO benchmark_sources (id,name,url,license,source_type,notes) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`).run('source-user', '用户自建题目', '', '由题目创建者决定', 'user', '用户自行添加的题目，不代表 MIND BENCH 官方基准。');
  db.prepare(`INSERT INTO benchmark_tasks (id,title,category_id,subcategory,difficulty,prompt_zh,prompt_en,source_id,objective,reference_answer,scoring_rule,scoring_dimensions,common_errors,notes,version,verification_status,is_public,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, task.title, task.categoryId, task.subcategory, task.difficulty, task.promptZh, task.promptEn, task.sourceId, task.objective, task.referenceAnswer, JSON.stringify(rule), JSON.stringify(task.scoringDimensions), JSON.stringify(task.commonErrors), task.notes, task.version, task.verificationStatus, task.isPublic ? 1 : 0, 'local-owner', timestamp, timestamp);
  db.prepare('INSERT INTO benchmark_task_versions (id,task_id,version,snapshot,change_note,created_at) VALUES (?,?,?,?,?,?)').run(uuid(), id, task.version, JSON.stringify(task), '用户创建', timestamp);
  writeAudit('create', 'task', id); res.status(201).json({ task: parseTask(getTask(id)) });
});
app.put('/api/tasks/:id', (req, res) => {
  const existing = getTask(req.params.id);
  if (!existing || existing.created_by === 'system') return res.status(404).json({ error: '找不到可编辑的自建题目。' });
  const body = req.body ?? {}; const timestamp = now();
  const title = String(body.title ?? existing.title).slice(0,180); const prompt = String(body.promptZh ?? existing.prompt_zh).slice(0,20000);
  const version = `1.0.${(Number(existing.version.split('.').at(-1)) || 0) + 1}`;
  const categoryId = body.categoryId && db.prepare('SELECT 1 FROM benchmark_categories WHERE id=?').get(body.categoryId) ? body.categoryId : existing.category_id;
  const difficulty = ['easy','medium','hard','expert'].includes(body.difficulty) ? body.difficulty : existing.difficulty;
  const dimensions = Array.isArray(body.scoringDimensions) ? body.scoringDimensions : safeJson(existing.scoring_dimensions, []);
  const commonErrors = Array.isArray(body.commonErrors) ? body.commonErrors : safeJson(existing.common_errors, []);
  db.prepare('UPDATE benchmark_tasks SET title=?,category_id=?,subcategory=?,difficulty=?,prompt_zh=?,prompt_en=?,objective=?,reference_answer=?,scoring_rule=?,scoring_dimensions=?,common_errors=?,notes=?,version=?,is_public=?,updated_at=? WHERE id=?').run(
    title, categoryId, String(body.subcategory ?? existing.subcategory).slice(0,100), difficulty, prompt, String(body.promptEn ?? existing.prompt_en).slice(0,20000), String(body.objective ?? existing.objective).slice(0,2000),
    String(body.referenceAnswer ?? existing.reference_answer), JSON.stringify(body.scoringRule ?? safeJson(existing.scoring_rule,{})), JSON.stringify(dimensions), JSON.stringify(commonErrors), String(body.notes ?? existing.notes),
    version, body.isPublic === undefined ? existing.is_public : body.isPublic ? 1 : 0, timestamp, existing.id);
  db.prepare('INSERT INTO benchmark_task_versions (id,task_id,version,snapshot,change_note,created_at) VALUES (?,?,?,?,?,?)').run(uuid(),existing.id,version,JSON.stringify({title,promptZh:prompt,referenceAnswer:body.referenceAnswer ?? existing.reference_answer}),String(body.changeNote ?? '编辑题目副本'),timestamp);
  writeAudit('update','task',existing.id); res.json({ task: parseTask(getTask(existing.id)) });
});
app.post('/api/tasks/import', (req, res) => {
  const records = Array.isArray(req.body) ? req.body : req.body?.tasks;
  if (!Array.isArray(records) || records.length === 0) return res.status(400).json({ error: '请提交非空 JSON 数组或 {"tasks":[...]}。' });
  if (records.length > 1000) return res.status(413).json({ error: '单次导入上限为1000题。' });
  const errors = []; let imported = 0;
  transaction(() => {
    records.forEach((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) { errors.push({ index, error: '每条题目必须是 JSON 对象。' }); return; }
      const categoryId = item.categoryId ?? item.category_id;
      const prompt = item.promptZh ?? item.prompt_zh ?? item.prompt;
      if (!item.title || !categoryId || !prompt || !db.prepare('SELECT 1 FROM benchmark_categories WHERE id=?').get(categoryId)) { errors.push({ index, error: 'title、有效 categoryId 和 promptZh 为必填项。' }); return; }
      const id = String(item.id ?? `import-${uuid()}`).slice(0,120); const timestamp = now();
      const sourceId = `user-source-${String(item.sourceType ?? 'user').slice(0,40)}`;
      db.prepare('INSERT OR IGNORE INTO benchmark_sources (id,name,url,license,source_type,notes) VALUES (?,?,?,?,?,?)').run(sourceId,String(item.sourceName ?? '用户导入'),String(item.sourceUrl ?? ''),String(item.license ?? '未知/待核实'),String(item.sourceType ?? 'user'),String(item.sourceNotes ?? '导入后应核实数据来源与许可证。'));
      try {
        db.prepare(`INSERT INTO benchmark_tasks (id,title,category_id,subcategory,difficulty,prompt_zh,prompt_en,source_id,objective,reference_answer,scoring_rule,scoring_dimensions,common_errors,notes,version,verification_status,is_public,created_by,created_at,updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id,String(item.title).slice(0,180),categoryId,String(item.subcategory ?? '通用').slice(0,100),['easy','medium','hard','expert'].includes(item.difficulty) ? item.difficulty : 'medium',String(prompt).slice(0,20000),String(item.promptEn ?? item.prompt_en ?? '').slice(0,20000),sourceId,String(item.objective ?? ''),String(item.referenceAnswer ?? item.reference_answer ?? ''),JSON.stringify(item.scoringRule ?? item.scoring_rule ?? {method:'manual'}),JSON.stringify(item.scoringDimensions ?? []),JSON.stringify(item.commonErrors ?? []),String(item.notes ?? '导入题目；来源与许可证需核验。'),String(item.version ?? '1.0.0'),String(item.verificationStatus ?? 'user'),item.isPublic === false ? 0 : 1,'local-owner',timestamp,timestamp);
        db.prepare('INSERT INTO benchmark_task_versions (id,task_id,version,snapshot,change_note,created_at) VALUES (?,?,?,?,?,?)').run(uuid(),id,String(item.version ?? '1.0.0'),JSON.stringify(item),'JSON导入',timestamp); imported++;
      } catch (error) { errors.push({ index, error: error.code === 'ERR_SQLITE_ERROR' ? 'ID 重复或违反数据约束。' : error.message }); }
    });
  });
  writeAudit('import','task','',{imported,failed:errors.length}); res.status(201).json({imported,errors});
});
app.post('/api/tasks/import-dataset', (req, res) => {
  const body = req.body ?? {};
  const content = String(body.content ?? '');
  if (!content.trim()) return res.status(400).json({ error: '请提交数据集文本内容（JSONL 或 CSV）。' });
  if (content.length > 6_000_000) return res.status(413).json({ error: '单次数据集文本上限为 6 MB。' });
  const license = String(body.license ?? '').trim();
  if (!license) return res.status(400).json({ error: '必须填写数据集许可证；来源不明的数据不得导入。' });
  const sourceName = String(body.sourceName ?? '外部数据集').slice(0, 120);
  const sourceUrl = String(body.sourceUrl ?? '').slice(0, 500);
  const fallbackCategory = String(body.categoryId ?? 'logic');
  if (!db.prepare('SELECT 1 FROM benchmark_categories WHERE id=?').get(fallbackCategory)) return res.status(400).json({ error: 'categoryId 无效。' });

  const parseCsv = (text) => {
    const rows = []; let row = []; let field = ''; let quoted = false;
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      if (quoted) {
        if (char === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
        else if (char === '"') quoted = false;
        else field += char;
      } else if (char === '"') quoted = true;
      else if (char === ',') { row.push(field); field = ''; }
      else if (char === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (char !== '\r') field += char;
    }
    if (field || row.length) { row.push(field); rows.push(row); }
    const header = (rows.shift() ?? []).map((item) => item.trim().toLowerCase());
    return rows.filter((cells) => cells.some((cell) => cell.trim())).map((cells) => Object.fromEntries(header.map((key, index) => [key, cells[index] ?? ''])));
  };

  let records = [];
  let detected = String(body.format ?? 'auto');
  const lines = content.split(/\r?\n/).filter((line) => line.trim());
  if (detected === 'auto') detected = content.trimStart().startsWith('{') ? 'jsonl' : 'csv';
  if (detected === 'jsonl') {
    for (const [index, line] of lines.entries()) {
      try { records.push(JSON.parse(line)); } catch { records.push({ __error: `第 ${index + 1} 行不是合法 JSON`, __index: index }); }
    }
  } else {
    records = parseCsv(content);
  }
  if (!records.length) return res.status(400).json({ error: '数据集中没有可识别的记录。' });
  if (records.length > 1000) return res.status(413).json({ error: '单次导入上限为 1000 条记录。' });

  const pick = (item, keys) => {
    for (const key of keys) if (item[key] !== undefined && String(item[key]).trim() !== '') return item[key];
    return '';
  };
  const sourceId = `dataset-${uuid()}`;
  db.prepare('INSERT INTO benchmark_sources (id,name,url,license,source_type,notes) VALUES (?,?,?,?,?,?)').run(sourceId, sourceName, sourceUrl, license, 'external', '通过外部数据集导入器载入；使用前请复核上游许可证与题目完整性。');
  const errors = []; let imported = 0; const timestamp = now();
  transaction(() => {
    for (const [index, item] of records.entries()) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) { errors.push({ index, error: '每条题目必须是 JSON 对象。' }); continue; }
      if (item.__error) { errors.push({ index, error: item.__error }); continue; }
      const prompt = pick(item, ['promptZh', 'prompt_zh', 'prompt', 'question', 'problem', 'input']);
      const answer = pick(item, ['referenceAnswer', 'reference_answer', 'answer', 'solution', 'output', 'target']);
      if (!prompt) { errors.push({ index, error: '缺少 question/problem/prompt 字段。' }); continue; }
      const categoryId = String(pick(item, ['categoryId', 'category_id', 'category']) || fallbackCategory);
      if (!db.prepare('SELECT 1 FROM benchmark_categories WHERE id=?').get(categoryId)) { errors.push({ index, error: `分类 "${categoryId}" 不存在。` }); continue; }
      const choices = item.choices ?? item.options;
      const promptText = Array.isArray(choices) ? `${prompt}\n\n${choices.map((choice, i) => `${String.fromCharCode(65 + i)}. ${choice}`).join('\n')}` : String(prompt);
      const id = `ds-${uuid()}`;
      db.prepare(`INSERT INTO benchmark_tasks (id,title,category_id,subcategory,difficulty,prompt_zh,prompt_en,source_id,objective,reference_answer,scoring_rule,scoring_dimensions,common_errors,notes,version,verification_status,is_public,created_by,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,'local-owner',?,?)`).run(
        id, String(pick(item, ['title']) || promptText).slice(0, 120), categoryId, String(pick(item, ['subcategory']) || '外部数据集').slice(0, 100),
        ['easy', 'medium', 'hard', 'expert'].includes(item.difficulty) ? item.difficulty : 'medium', String(promptText).slice(0, 20000), String(item.promptEn ?? '').slice(0, 20000),
        sourceId, String(item.objective ?? `从 ${sourceName} 导入，用于测量对应能力。`).slice(0, 2000), String(answer).slice(0, 10000),
        JSON.stringify(answer ? { method: 'manual', importedFrom: sourceName } : { method: 'manual' }), JSON.stringify([{ name: '任务完成度', weight: 1 }]), JSON.stringify([]),
        `导入自 ${sourceName}${sourceUrl ? `（${sourceUrl}）` : ''}；许可证：${license}。未经过 MIND BENCH 人工验证，评分需人工复核或 AI 裁判。`,
        '1.0.0', 'imported', timestamp, timestamp);
      db.prepare('INSERT INTO benchmark_task_versions (id,task_id,version,snapshot,change_note,created_at) VALUES (?,?,?,?,?,?)').run(uuid(), id, '1.0.0', JSON.stringify({ importedFrom: sourceName, license }), '数据集导入', timestamp);
      imported += 1;
    }
  });
  audit('import_dataset', 'task', sourceId, { imported, failed: errors.length, detected, sourceName, license });
  res.status(201).json({ imported, failed: errors.length, errors: errors.slice(0, 50), detected, sourceId, sourceName, license });
});
app.get('/api/tasks/export', (req, res) => {
  const tasks = listTasks({category:req.query.category,limit:1000}).map((task) => ({id:task.id,title:task.title,categoryId:task.category_id,subcategory:task.subcategory,difficulty:task.difficulty,promptZh:task.prompt_zh,promptEn:task.prompt_en,source:{name:task.source_name,type:task.source_type,license:task.source_license},objective:task.objective,referenceAnswer:task.reference_answer,scoringRule:safeJson(task.scoring_rule,{}),scoringDimensions:safeJson(task.scoring_dimensions,[]),commonErrors:safeJson(task.common_errors,[]),version:task.version,verificationStatus:task.verification_status}));
  if (req.query.format === 'csv') {
    const columns = ['id','title','categoryId','subcategory','difficulty','promptZh','promptEn','objective','referenceAnswer','version','verificationStatus'];
    const quote = (value) => `"${String(value ?? '').replace(/"/g,'""')}"`;
    return res.type('text/csv').send([columns.join(','),...tasks.map((task) => columns.map((key) => quote(task[key])).join(','))].join('\r\n'));
  }
  res.json({exportedAt:now(),tasks});
});
app.post('/api/tasks/:id/favorite', (req,res) => {
  if (!getTask(req.params.id)) return res.status(404).json({error:'找不到题目。'});
  const exists = db.prepare('SELECT 1 FROM favorites WHERE task_id=?').get(req.params.id);
  if (exists) db.prepare('DELETE FROM favorites WHERE task_id=?').run(req.params.id);
  else db.prepare('INSERT INTO favorites (id,task_id,created_at) VALUES (?,?,?)').run(uuid(),req.params.id,now());
  res.json({favorite:!exists});
});
app.get('/api/favorites', (_req,res) => res.json(db.prepare(`SELECT t.id,t.title,t.category_id,c.name AS category_name,t.difficulty,t.prompt_zh FROM favorites f JOIN benchmark_tasks t ON t.id=f.task_id JOIN benchmark_categories c ON c.id=t.category_id ORDER BY f.created_at DESC`).all()));

app.get('/api/providers', (_req,res) => {
  const providers = db.prepare(`SELECT p.id,p.name,p.kind,p.base_url,p.enabled,p.created_at,p.updated_at,CASE WHEN p.api_key_cipher='' THEN 0 ELSE 1 END AS has_api_key FROM providers p ORDER BY p.name`).all();
  res.json({providers,models:listModels().map(safeModel)});
});
app.post('/api/providers', (req,res) => {
  const body=req.body??{};const missing=required(body,['name','kind']);if(missing.length)return res.status(400).json({error:`缺少必填字段：${missing.join(', ')}`});
  const id=uuid();const timestamp=now();const kind=String(body.kind).slice(0,40);const name=String(body.name).slice(0,100);
  db.prepare('INSERT INTO providers (id,name,kind,base_url,api_key_cipher,enabled,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').run(id,name,kind,kind==='mock'?'':String(body.baseUrl??'').slice(0,1000),encryptSecret(String(body.apiKey??'')),body.enabled===false?0:1,timestamp,timestamp);
  writeAudit('create','provider',id,{kind,name});res.status(201).json({provider:{id,name,kind,base_url:body.baseUrl??'',enabled:body.enabled!==false,has_api_key:Boolean(body.apiKey)}});
});
app.put('/api/providers/:id', (req,res) => {
  const old=db.prepare('SELECT * FROM providers WHERE id=?').get(req.params.id);if(!old)return res.status(404).json({error:'找不到供应商。'});
  const body=req.body??{};const key=Object.hasOwn(body,'apiKey')&&body.apiKey?encryptSecret(String(body.apiKey)):old.api_key_cipher;
  db.prepare('UPDATE providers SET name=?,kind=?,base_url=?,api_key_cipher=?,enabled=?,updated_at=? WHERE id=?').run(String(body.name??old.name).slice(0,100),String(body.kind??old.kind).slice(0,40),String(body.baseUrl??old.base_url).slice(0,1000),key,body.enabled===undefined?old.enabled:body.enabled?1:0,now(),old.id);
  writeAudit('update','provider',old.id);res.json({ok:true});
});
app.delete('/api/providers/:id', (req,res) => {
  if(!db.prepare('SELECT 1 FROM providers WHERE id=?').get(req.params.id))return res.status(404).json({error:'找不到供应商。'});
  try{db.prepare('DELETE FROM providers WHERE id=?').run(req.params.id);}catch{return res.status(409).json({error:'供应商有历史测试记录，不能删除；可将其停用。'});}
  writeAudit('delete','provider',req.params.id);res.json({ok:true});
});
const providerKinds=['openai','anthropic','gemini','deepseek','zhipu','moonshot','minimax','qwen','openrouter','ollama','lmstudio','openai-compatible','mock'];
app.get('/api/providers/kinds',(_req,res)=>res.json(providerKinds));
app.get('/api/providers/:id/models', async (req,res) => {
  const provider = db.prepare('SELECT id,name,kind,base_url,api_key_cipher,enabled FROM providers WHERE id=?').get(req.params.id);
  if (!provider) return res.status(404).json({ error: '找不到供应商。' });
  try {
    const result = await listProviderModels(provider);
    res.json({ provider: { id: provider.id, name: provider.name, kind: provider.kind }, ...result });
  } catch (error) {
    res.status(error.status ?? 502).json({ error: error.message });
  }
});
app.post('/api/models', (req,res) => {
  const body=req.body??{};const missing=required(body,['providerId','name','modelId']);if(missing.length)return res.status(400).json({error:`缺少必填字段：${missing.join(', ')}`});
  if(!db.prepare('SELECT 1 FROM providers WHERE id=?').get(body.providerId))return res.status(400).json({error:'供应商不存在。'});
  const id=uuid();const timestamp=now();const isDefault=Boolean(body.isDefault);
  transaction(()=>{if(isDefault)db.prepare('UPDATE models SET is_default=0').run();db.prepare(`INSERT INTO models (id,provider_id,name,model_id,model_version,enabled,is_default,temperature,max_tokens,timeout_ms,max_retries,input_cost_per_million,output_cost_per_million,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id,body.providerId,String(body.name).slice(0,100),String(body.modelId).slice(0,200),String(body.modelVersion??'').slice(0,100),body.enabled===false?0:1,isDefault?1:0,Math.max(0,Math.min(2,Number(body.temperature)||0)),Math.max(1,Math.min(32768,Number(body.maxTokens)||1024)),Math.max(1000,Math.min(180000,Number(body.timeoutMs)||60000)),Math.max(0,Math.min(5,Math.trunc(Number(body.maxRetries??1))||0)),Math.max(0,Number(body.inputCostPerMillion)||0),Math.max(0,Number(body.outputCostPerMillion)||0),timestamp,timestamp);});
  writeAudit('create','model',id);res.status(201).json({model:safeModel(modelById.get(id))});
});
app.get('/api/models/:id', (req, res) => {
  const model = modelById.get(req.params.id);
  if (!model) return res.status(404).json({ error: '找不到模型。' });
  const stats = db.prepare(`SELECT COUNT(*) AS runs,
      SUM(CASE WHEN r.status='completed' AND r.is_mock=0 AND r.is_external=0 THEN 1 ELSE 0 END) AS completed,
      SUM(CASE WHEN r.status='failed' THEN 1 ELSE 0 END) AS failed,
      SUM(CASE WHEN r.is_mock=1 THEN 1 ELSE 0 END) AS mock,
      AVG(CASE WHEN r.is_mock=0 AND r.is_external=0 THEN e.score END) AS average_score,
      AVG(CASE WHEN r.is_mock=0 AND r.is_external=0 THEN x.latency_ms END) AS average_latency,
      SUM(x.input_tokens) AS input_tokens, SUM(x.output_tokens) AS output_tokens, SUM(x.cost) AS total_cost,
      MAX(r.completed_at) AS last_tested
    FROM test_runs r LEFT JOIN evaluation_results e ON e.run_id=r.id LEFT JOIN model_responses x ON x.run_id=r.id WHERE r.model_id=?`).get(model.id);
  const categoryScores = db.prepare(`SELECT c.id,c.name,COUNT(r.id) AS runs,AVG(e.score) AS average_score
    FROM benchmark_categories c JOIN benchmark_tasks t ON t.category_id=c.id JOIN test_runs r ON r.task_id=t.id
    LEFT JOIN evaluation_results e ON e.run_id=r.id WHERE r.model_id=? AND r.is_mock=0 AND r.is_external=0 AND r.status='completed' AND e.score IS NOT NULL
    GROUP BY c.id ORDER BY c.sort_order`).all(model.id).map((row) => ({ ...row, average_score: Math.round(row.average_score ?? 0) }));
  const recent = db.prepare(`SELECT r.id,r.status,r.is_mock,r.is_external,r.completed_at,r.task_id,t.title AS task_title,c.name AS category_name,e.score,e.evaluator_type,x.latency_ms,x.error
    FROM test_runs r JOIN benchmark_tasks t ON t.id=r.task_id JOIN benchmark_categories c ON c.id=t.category_id
    LEFT JOIN evaluation_results e ON e.run_id=r.id LEFT JOIN model_responses x ON x.run_id=r.id
    WHERE r.model_id=? ORDER BY r.started_at DESC LIMIT 15`).all(model.id);
  const history = db.prepare(`SELECT r.completed_at,r.task_id,e.score,e.evaluator_type FROM test_runs r JOIN evaluation_results e ON e.run_id=r.id
    WHERE r.model_id=? AND r.is_mock=0 AND r.is_external=0 AND r.status='completed' AND e.score IS NOT NULL ORDER BY r.completed_at DESC LIMIT 60`).all(model.id).reverse();
  const judges = db.prepare(`SELECT COUNT(DISTINCT v.run_id) AS judged_runs, AVG(v.overall) AS judge_average FROM judge_verdicts v JOIN test_runs r ON r.id=v.run_id WHERE r.model_id=? AND v.valid=1`).get(model.id);
  res.json({
    model: safeModel(model),
    provider: { id: model.provider_id, name: model.provider_name, kind: model.provider_kind, base_url: model.base_url, enabled: Boolean(model.provider_enabled) },
    stats: {
      runs: Number(stats.runs ?? 0), completed: Number(stats.completed ?? 0), failed: Number(stats.failed ?? 0), mock: Number(stats.mock ?? 0),
      averageScore: stats.average_score === null ? null : Math.round(stats.average_score),
      averageLatency: stats.average_latency === null ? null : Math.round(stats.average_latency),
      inputTokens: Number(stats.input_tokens ?? 0), outputTokens: Number(stats.output_tokens ?? 0),
      totalCost: Number((stats.total_cost ?? 0).toFixed(6)), lastTested: stats.last_tested,
      successRate: Number(stats.runs) ? Math.round((Number(stats.completed) / Number(stats.runs)) * 100) : null,
      judgedRuns: Number(judges.judged_runs ?? 0), judgeAverage: judges.judge_average === null ? null : Math.round(judges.judge_average),
    },
    categoryScores,
    recent: recent.map((row) => ({ ...row, is_mock: Boolean(row.is_mock), is_external: Boolean(row.is_external), score: row.score === null ? null : Number(row.score) })),
    history,
  });
});
app.put('/api/models/:id', (req,res) => {
  const old=modelById.get(req.params.id);if(!old)return res.status(404).json({error:'找不到模型。'});const b=req.body??{};
  transaction(()=>{if(b.isDefault)db.prepare('UPDATE models SET is_default=0').run();db.prepare('UPDATE models SET name=?,model_id=?,model_version=?,enabled=?,is_default=?,temperature=?,max_tokens=?,timeout_ms=?,max_retries=?,input_cost_per_million=?,output_cost_per_million=?,updated_at=? WHERE id=?').run(String(b.name??old.name).slice(0,100),String(b.modelId??old.model_id).slice(0,200),String(b.modelVersion??old.model_version).slice(0,100),b.enabled===undefined?old.enabled:b.enabled?1:0,b.isDefault===undefined?old.is_default:b.isDefault?1:0,Math.max(0,Math.min(2,Number(b.temperature??old.temperature)||0)),Math.max(1,Math.min(32768,Number(b.maxTokens??old.max_tokens)||1024)),Math.max(1000,Math.min(180000,Number(b.timeoutMs??old.timeout_ms)||60000)),Math.max(0,Math.min(5,Number(b.maxRetries??old.max_retries)||0)),Math.max(0,Number(b.inputCostPerMillion??old.input_cost_per_million)||0),Math.max(0,Number(b.outputCostPerMillion??old.output_cost_per_million)||0),now(),old.id);});res.json({model:safeModel(modelById.get(old.id))});
});
app.delete('/api/models/:id', (req,res) => {
  if(!modelById.get(req.params.id))return res.status(404).json({error:'找不到模型。'});
  try{db.prepare('DELETE FROM models WHERE id=?').run(req.params.id);}catch{return res.status(409).json({error:'该模型已有历史测试记录，不能删除；请停用以保留审计历史。'});}
  writeAudit('delete','model',req.params.id);res.json({ok:true});
});
app.post('/api/models/:id/test-connection', async (req,res) => {
  const model=modelById.get(req.params.id);if(!model)return res.status(404).json({error:'找不到模型。'});
  try{const result=await checkProviderConnection(model);res.json({ok:true,latencyMs:result.latencyMs,model:model.name,isMock:result.isMock,message:result.isMock?'Mock 供应商可用，但不代表真实模型连接。':'供应商真实连接成功。'});}catch(error){res.status(error.status??502).json({ok:false,error:error.message});}
});

const manifestVersion = '1.1.0';
const scoreWeightsSnapshot = () => {
  const row = db.prepare("SELECT value FROM system_settings WHERE key='score_weights'").get();
  return safeJson(row?.value, {});
};
const buildRunManifest = ({ name, mode, settings, tasks, models, external = false }) => {
  const taskSnapshot = tasks.map((task) => ({
    id: task.id,
    title: task.title,
    categoryId: task.category_id,
    categoryName: task.category_name,
    version: task.version ?? '1.0.0',
    verificationStatus: task.verification_status,
    promptZh: task.prompt_zh,
    promptEn: task.prompt_en,
    referenceAnswer: task.reference_answer,
    objective: task.objective,
    scoringRule: safeJson(task.scoring_rule, {}),
    scoringDimensions: safeJson(task.scoring_dimensions, []),
  }));
  const modelSnapshot = models.map((model) => ({
    id: model.id,
    name: model.name,
    providerId: model.provider_id,
    providerName: model.provider_name,
    providerKind: model.provider_kind,
    modelId: model.model_id,
    modelVersion: model.model_version ?? '',
    temperature: Number(model.temperature ?? 0),
    maxTokens: Number(model.max_tokens ?? 1024),
    timeoutMs: Number(model.timeout_ms ?? 60000),
    maxRetries: Number(model.max_retries ?? 0),
    inputCostPerMillion: Number(model.input_cost_per_million ?? 0),
    outputCostPerMillion: Number(model.output_cost_per_million ?? 0),
  }));
  const payload = {
    manifestVersion,
    createdAt: now(),
    application: { name: 'MIND BENCH', version: packageJson.version },
    session: { name, mode, settings },
    tasks: taskSnapshot,
    models: modelSnapshot,
    scoring: {
      weightSnapshot: scoreWeightsSnapshot(),
      objectiveScorer: 'src/scoring.mjs@1.0.0',
      judgeProtocol: 'src/judge.mjs@1.0.0',
      leaderboard: 'MIND BENCH SCORE@1.0.0',
    },
    execution: {
      concurrencyLimit,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      flags: { external: Boolean(external), mockEligible: modelSnapshot.some((model) => model.providerKind === 'mock') },
    },
  };
  const canonical = JSON.stringify(payload);
  return { ...payload, integrity: { algorithm: 'sha256', value: createHash('sha256').update(canonical).digest('hex') } };
};
const beginSession = (name,mode,settings,{tasks=[],models=[],external=false}={}) => {
  const id=uuid();
  const manifest=buildRunManifest({name,mode,settings,tasks,models,external});
  db.prepare('INSERT INTO test_sessions (id,name,mode,status,settings,run_manifest,started_at) VALUES (?,?,?,?,?,?,?)').run(id,name,mode,'running',JSON.stringify(settings),JSON.stringify(manifest),now());
  const controller=new AbortController();activeSessions.set(id,controller);return {id,controller};
};
const runTest = async ({session,task,model,manualText,promptOverride}) => {
  const runId=uuid();const started=now();const taskVersion=task.version??'1.0.0';
  const isExternal = manualText !== undefined;
  db.prepare('INSERT INTO test_runs (id,session_id,task_id,model_id,task_version,model_version,status,is_mock,is_external,started_at) VALUES (?,?,?,?,?,?,?,?,?,?)').run(runId,session.id,task.id,model.id,taskVersion,model.model_version??'','running',0,isExternal?1:0,started);
  try{
    if (session.controller.signal.aborted) throw Object.assign(new Error('测试已取消，未发送模型请求。'), { status: 499 });
    const result=manualText!==undefined?{text:String(manualText).slice(0,50000),inputTokens:0,outputTokens:0,requestId:'',isMock:false,latencyMs:0}:await invokeModel(model,promptOverride??task.prompt_zh,task,session.controller.signal);
    const cost=(result.inputTokens*Number(model.input_cost_per_million||0)+result.outputTokens*Number(model.output_cost_per_million||0))/1_000_000;
    db.prepare('UPDATE test_runs SET status=?,is_mock=?,is_external=?,completed_at=? WHERE id=?').run(session.controller.signal.aborted?'cancelled':'completed',result.isMock?1:0,isExternal?1:0,now(),runId);
    db.prepare('INSERT INTO model_responses (id,run_id,raw_text,latency_ms,input_tokens,output_tokens,cost,provider_request_id) VALUES (?,?,?,?,?,?,?,?)').run(uuid(),runId,result.text,result.latencyMs,result.inputTokens,result.outputTokens,cost,result.requestId);
    const scored=scoreAnswer(task.scoring_rule,task.reference_answer,result.text);
    const scoreResult=result.isMock?{score:null,passed:null,rationale:'Mock 运行不计分，不能进入真实评测统计。'}:scored;
    db.prepare('INSERT INTO evaluation_results (id,run_id,evaluator_type,score,passed,dimensions,rationale,created_at) VALUES (?,?,?,?,?,?,?,?)').run(uuid(),runId,result.isMock?'mock':scoreResult.score===null?'manual':'objective',scoreResult.score,scoreResult.passed===null?null:scoreResult.passed?1:0,JSON.stringify(scoreResult.dimensions??[]),scoreResult.rationale,now());
    return {runId,taskId:task.id,taskTitle:task.title,modelId:model.id,modelName:model.name,providerName:model.provider_name,status:session.controller.signal.aborted?'cancelled':'completed',isMock:result.isMock,isExternal,rawText:result.text,latencyMs:result.latencyMs,inputTokens:result.inputTokens,outputTokens:result.outputTokens,cost,score:scoreResult.score,passed:scoreResult.passed,scoringType:result.isMock?'mock':scoreResult.score===null?'manual':'objective',rationale:scoreResult.rationale};
  }catch(error){
    const status=session.controller.signal.aborted||error.status===499?'cancelled':'failed';db.prepare('UPDATE test_runs SET status=?,completed_at=? WHERE id=?').run(status,now(),runId);
    db.prepare('INSERT INTO model_responses (id,run_id,raw_text,latency_ms,error) VALUES (?,?,?,?,?)').run(uuid(),runId,'',0,String(error.message).slice(0,2000));
    return {runId,taskId:task.id,taskTitle:task.title,modelId:model.id,modelName:model.name,providerName:model.provider_name,status,error:error.message,isMock:false,isExternal};
  }
};
const allowedModels = (ids) => {
  const unique=[...new Set((Array.isArray(ids)?ids:[]).map(String))].slice(0,32);
  const models=unique.map((id)=>modelById.get(id)).filter((model)=>model&&model.enabled&&model.provider_enabled);
  if(models.length!==unique.length)throw Object.assign(new Error('一个或多个模型不存在或已停用。'),{status:400});
  if(models.length===0)throw Object.assign(new Error('请至少选择一个已启用模型。'),{status:400});
  return models;
};
const executeSession = async ({session,entries,models}) => {
  const jobs=[];for(const entry of entries)for(const model of models)jobs.push({entry,model});
  const results=[];await asyncPool(jobs,concurrencyLimit,async({entry,model})=>{results.push(await runTest({session,task:entry.task,model,manualText:entry.manualText,promptOverride:entry.promptOverride}));});
  const failed=results.filter((r)=>r.status==='failed').length;const complete=results.filter((r)=>r.status==='completed').length;
  const status=failed===results.length?'failed':session.controller.signal.aborted?(complete?'partial':'cancelled'):complete===results.length?'completed':'partial';
  db.prepare('UPDATE test_sessions SET status=?,completed_at=? WHERE id=?').run(status,now(),session.id);
  activeSessions.delete(session.id);writeAudit('complete','session',session.id,{runs:results.length,failed});return results;
};
const executeSessionDetached = ({session,entries,models}) => {
  void executeSession({session,entries,models}).catch((error) => {
    activeSessions.delete(session.id);
    db.prepare("UPDATE test_sessions SET status='failed',completed_at=? WHERE id=?").run(now(), session.id);
    writeAudit('failed','session',session.id,{error:String(error.message).slice(0,500)});
  });
};
app.post('/api/test-runs', async (req,res) => {
  try{
    const body=req.body??{};const task=getTask(body.taskId);if(!task)return res.status(404).json({error:'找不到题目。'});
    const models=allowedModels(body.modelIds??(body.modelId?[body.modelId]:[]));
    const manualText=body.manualText===undefined?undefined:String(body.manualText).slice(0,50000);
    const session=beginSession(body.name??task.title,manualText===undefined?'single':'external',{taskIds:[task.id],modelIds:models.map((m)=>m.id),external:manualText!==undefined,promptOverride:body.promptOverride===undefined?null:String(body.promptOverride).slice(0,20000)},{tasks:[task],models,external:manualText!==undefined});
    const entries=[{task,manualText,promptOverride:body.promptOverride===undefined?undefined:String(body.promptOverride).slice(0,20000)}];
    if (body.deferred === true) { executeSessionDetached({session,entries,models}); return res.status(202).json({sessionId:session.id,status:'running',results:[]}); }
    const results=await executeSession({session,entries,models});res.status(201).json({sessionId:session.id,results});
  }catch(error){res.status(error.status??400).json({error:error.message});}
});
app.post('/api/test-sessions', async (req,res) => {
  try{
    const b=req.body??{};const category=b.categoryId?String(b.categoryId):undefined;
    let tasks=listTasks({category,difficulty:b.difficulty,limit:500}).filter((task)=>task.verification_status!=='draft');
    if(Array.isArray(b.taskIds)&&b.taskIds.length)tasks=tasks.filter((task)=>b.taskIds.includes(task.id));
    if(!Array.isArray(b.taskIds)&&b.mode==='category'&&!category)return res.status(400).json({error:'分类挑战必须指定 categoryId。'});
    const count=Math.max(1,Math.min(100,Number(b.questionCount)||tasks.length));
    if(b.mode==='random'||b.mode==='challenge'||b.mode==='stability'||b.mode==='custom')tasks.sort(()=>Math.random()-0.5);
    if(b.mode==='extreme')tasks=tasks.filter((task)=>['hard','expert'].includes(task.difficulty));
    tasks=tasks.slice(0,count).map((row)=>getTask(row.id));if(!tasks.length)return res.status(400).json({error:'筛选条件下没有可运行的题目。'});
    const models=allowedModels(b.modelIds??[]);const repeats=b.mode==='stability'?Math.min(5,Math.max(2,Number(b.repeats)||3)):1;
    const entries=tasks.flatMap((task)=>Array.from({length:repeats},()=>({task})));
    if(entries.length*models.length>300)return res.status(400).json({error:'本轮最多300个模型-题目任务，请减少题目或模型。'});
    const session=beginSession(b.name??`${b.categoryId??'综合'}挑战`,b.mode??'custom',{categoryId:b.categoryId??null,questionCount:tasks.length,repeats,modelIds:models.map((m)=>m.id),taskIds:tasks.map((t)=>t.id),repeats},{tasks,models,external:false});
    if (b.deferred === true) { executeSessionDetached({session,entries,models}); return res.status(202).json({sessionId:session.id,status:'running',results:[]}); }
    const results=await executeSession({session,entries,models});res.status(201).json({sessionId:session.id,results});
  }catch(error){res.status(error.status??400).json({error:error.message});}
});
app.post('/api/sessions/:id/cancel',(req,res)=>{const controller=activeSessions.get(req.params.id);if(!controller)return res.status(404).json({error:'测试任务不存在或已结束。'});controller.abort();res.json({ok:true});});
app.get('/api/sessions',(req,res)=>{
  const limit=Math.min(100,Math.max(1,Number(req.query.limit)||50));const sessions=db.prepare(`SELECT s.*,COUNT(r.id) AS run_count,SUM(CASE WHEN r.status='completed' AND r.is_mock=0 AND r.is_external=0 THEN 1 ELSE 0 END) AS real_completed,SUM(CASE WHEN r.is_mock=1 THEN 1 ELSE 0 END) AS mock_count,SUM(CASE WHEN r.is_external=1 THEN 1 ELSE 0 END) AS external_count,AVG(CASE WHEN r.is_mock=0 AND r.is_external=0 THEN e.score END) AS average_score FROM test_sessions s LEFT JOIN test_runs r ON r.session_id=s.id LEFT JOIN evaluation_results e ON e.run_id=r.id GROUP BY s.id ORDER BY s.started_at DESC LIMIT ?`).all(limit);res.json(sessions.map((s)=>({...s,settings:safeJson(s.settings,{}),manifestVersion:safeJson(s.run_manifest,{}).manifestVersion??null})));
});
app.get('/api/sessions/:id',(req,res)=>{
  const session=db.prepare('SELECT * FROM test_sessions WHERE id=?').get(req.params.id);if(!session)return res.status(404).json({error:'找不到测试记录。'});
  const runs=db.prepare(`SELECT r.id,r.status,r.is_mock,r.is_external,r.started_at,r.completed_at,r.task_id,t.title AS task_title,t.category_id,c.name AS category_name,t.difficulty,t.verification_status,m.id AS model_id,m.name AS model_name,m.model_id AS model_identifier,p.name AS provider_name,p.kind AS provider_kind,x.raw_text,x.latency_ms,x.input_tokens,x.output_tokens,x.cost,x.error,x.provider_request_id,e.evaluator_type,e.score,e.passed,e.dimensions,e.rationale,e.judge_model,e.reviewed FROM test_runs r JOIN benchmark_tasks t ON t.id=r.task_id JOIN benchmark_categories c ON c.id=t.category_id JOIN models m ON m.id=r.model_id JOIN providers p ON p.id=m.provider_id LEFT JOIN model_responses x ON x.run_id=r.id LEFT JOIN evaluation_results e ON e.run_id=r.id WHERE r.session_id=? ORDER BY r.started_at`).all(session.id);
  const verdicts = db.prepare('SELECT * FROM judge_verdicts WHERE run_id IN (SELECT id FROM test_runs WHERE session_id=?) ORDER BY created_at').all(session.id);
  const byRun = new Map();
  for (const verdict of verdicts) {
    if (!byRun.has(verdict.run_id)) byRun.set(verdict.run_id, []);
    byRun.get(verdict.run_id).push({ ...verdict, valid: Boolean(verdict.valid), dimensions: safeJson(verdict.dimensions, []) });
  }
  res.json({session:{...session,settings:safeJson(session.settings,{}),manifest:safeJson(session.run_manifest,{})},runs:runs.map((r)=>({...r,isMock:Boolean(r.is_mock),isExternal:Boolean(r.is_external),score:r.score===null?null:Number(r.score),passed:r.passed===null?null:Boolean(r.passed),dimensions:safeJson(r.dimensions,[]),verdicts:byRun.get(r.id)??[]}))});
});
app.get('/api/sessions/:id/manifest',(req,res)=>{
  const session=db.prepare('SELECT id,name,mode,started_at,completed_at,run_manifest FROM test_sessions WHERE id=?').get(req.params.id);if(!session)return res.status(404).json({error:'找不到测试记录。'});
  res.json({session:{id:session.id,name:session.name,mode:session.mode,started_at:session.started_at,completed_at:session.completed_at},manifest:safeJson(session.run_manifest,{})});
});
app.get('/api/runs/:id',(req,res)=>{
  const run=db.prepare(`SELECT r.*,t.title AS task_title,t.prompt_zh,t.reference_answer,t.category_id,c.name AS category_name,m.name AS model_name,m.model_id AS model_identifier,p.name AS provider_name,x.raw_text,x.latency_ms,x.input_tokens,x.output_tokens,x.cost,x.error,e.evaluator_type,e.score,e.passed,e.dimensions,e.rationale,e.judge_model FROM test_runs r JOIN benchmark_tasks t ON t.id=r.task_id JOIN benchmark_categories c ON c.id=t.category_id JOIN models m ON m.id=r.model_id JOIN providers p ON p.id=m.provider_id LEFT JOIN model_responses x ON x.run_id=r.id LEFT JOIN evaluation_results e ON e.run_id=r.id WHERE r.id=?`).get(req.params.id);if(!run)return res.status(404).json({error:'找不到测试结果。'});res.json({...run,isMock:Boolean(run.is_mock),isExternal:Boolean(run.is_external),score:run.score===null?null:Number(run.score),passed:run.passed===null?null:Boolean(run.passed),dimensions:safeJson(run.dimensions,[])});
});
app.put('/api/runs/:id/evaluation',(req,res)=>{
  const b=req.body??{};const score=Number(b.score);if(!Number.isFinite(score)||score<0||score>100)return res.status(400).json({error:'人工评分必须为0到100之间的数字。'});
  const exists=db.prepare('SELECT id FROM evaluation_results WHERE run_id=?').get(req.params.id);if(!exists)return res.status(404).json({error:'找不到评分记录。'});
  db.prepare('UPDATE evaluation_results SET evaluator_type=?,score=?,passed=?,rationale=?,reviewed=1,created_at=? WHERE run_id=?').run('human',score,score>=Number(b.passThreshold??100)?1:0,String(b.rationale??'人工复核').slice(0,4000),now(),req.params.id);
  writeAudit('review','evaluation',req.params.id,{score});res.json({ok:true,score});
});

app.get('/api/judges', (_req, res) => {
  const rows = db.prepare(`SELECT m.id,m.name,m.model_id,m.model_version,m.temperature,m.max_tokens,m.timeout_ms,m.input_cost_per_million,m.output_cost_per_million,p.name AS provider_name,p.kind AS provider_kind
    FROM models m JOIN providers p ON p.id=m.provider_id WHERE m.enabled=1 AND p.enabled=1 ORDER BY m.is_default DESC,m.name`).all();
  res.json({
    judges: rows.filter((row) => row.provider_kind !== 'mock').map((row) => ({ ...row, real: true })),
    mockJudges: rows.filter((row) => row.provider_kind === 'mock').map((row) => ({ ...row, real: false })),
    note: 'AI 裁判输出属于主观评分，需人工复核；Mock 供应商的裁判输出会被 Schema 校验拒绝，不产生分数。',
  });
});
const judgeRunRow = db.prepare(`SELECT r.*,x.raw_text,x.error FROM test_runs r LEFT JOIN model_responses x ON x.run_id=r.id WHERE r.id=?`);
const verdictList = (runId) => db.prepare('SELECT * FROM judge_verdicts WHERE run_id=? ORDER BY created_at').all(runId).map((row) => ({ ...row, valid: Boolean(row.valid), dimensions: safeJson(row.dimensions, []) }));

const taskForJudging = (run) => {
  const session = db.prepare('SELECT run_manifest FROM test_sessions WHERE id=?').get(run.session_id);
  const manifest = safeJson(session?.run_manifest, {});
  const snapshot = manifest.tasks?.find((task) => task.id === run.task_id);
  // Older manifests did not contain prompt/reference text. Preserve their existing fallback.
  if (!snapshot || !Object.hasOwn(snapshot, 'promptZh') || !Object.hasOwn(snapshot, 'referenceAnswer')) return getTask(run.task_id);
  const override = manifest.session?.settings?.promptOverride;
  return {
    id: snapshot.id,
    title: snapshot.title,
    version: snapshot.version,
    prompt_zh: typeof override === 'string' ? override : snapshot.promptZh,
    reference_answer: snapshot.referenceAnswer,
    scoring_dimensions: JSON.stringify(snapshot.scoringDimensions ?? []),
  };
};

const applyJudgeScore = ({ run, aggregate, judgeLabels, force }) => {
  const existing = db.prepare('SELECT * FROM evaluation_results WHERE run_id=?').get(run.id);
  if (existing?.reviewed && existing.evaluator_type === 'human' && !force) {
    return { applied: false, reason: '该结果已被人工复核，AI 裁判分数未覆盖。' };
  }
  const payload = {
    evaluator: 'ai_judge',
    score: aggregate.overall,
    passed: aggregate.verdict === 'pass' ? 1 : 0,
    dimensions: JSON.stringify(aggregate.dimensions),
    rationale: verdictRationale(aggregate, judgeLabels.length > 1 ? `裁判：${judgeLabels.join(' / ')}` : ''),
    judgeModel: judgeLabels.join(','),
  };
  if (existing) {
    db.prepare("UPDATE evaluation_results SET evaluator_type=?,score=?,passed=?,dimensions=?,rationale=?,judge_model=?,reviewed=0,created_at=? WHERE run_id=?").run(payload.evaluator, payload.score, payload.passed, payload.dimensions, payload.rationale, payload.judgeModel, now(), run.id);
  } else {
    db.prepare('INSERT INTO evaluation_results (id,run_id,evaluator_type,score,passed,dimensions,rationale,judge_model,reviewed,created_at) VALUES (?,?,?,?,?,?,?,?,0,?)').run(uuid(), run.id, payload.evaluator, payload.score, payload.passed, payload.dimensions, payload.rationale, payload.judgeModel, now());
  }
  return { applied: true, reason: '' };
};

async function judgeOneRun({ runId, judgeModelIds, force = false }) {
  const run = judgeRunRow.get(runId);
  if (!run) throw Object.assign(new Error('找不到测试结果。'), { status: 404 });
  if (run.is_mock) throw Object.assign(new Error('模拟运行不能评分，也不会进入真实榜单。'), { status: 400 });
  if (run.status !== 'completed') throw Object.assign(new Error('仅已完成且有回答的运行可以评分。'), { status: 400 });
  if (!String(run.raw_text ?? '').trim()) throw Object.assign(new Error('该运行没有可评分的模型回答。'), { status: 400 });
  const task = taskForJudging(run);
  if (!task) throw Object.assign(new Error('题目已被删除，无法评分。'), { status: 404 });

  const unique = [...new Set((Array.isArray(judgeModelIds) ? judgeModelIds : []).map(String))].slice(0, 3);
  if (!unique.length) throw Object.assign(new Error('请选择至少一个裁判模型。'), { status: 400 });
  if (unique.includes(run.model_id)) throw Object.assign(new Error('被测模型不能给自己评分，请选择其他裁判模型。'), { status: 400 });
  const judges = unique.map((id) => modelById.get(id)).filter((model) => model && model.enabled && model.provider_enabled);
  if (judges.length !== unique.length) throw Object.assign(new Error('一个或多个裁判模型不存在或已停用。'), { status: 400 });
  if (judges.some((model) => model.provider_kind === 'mock')) throw Object.assign(new Error('Mock 供应商不能作为裁判；它无法产生可验证的评分。'), { status: 400 });

  const parsedTask = { ...task, scoring_dimensions: safeJson(task.scoring_dimensions, []) };
  const prompt = buildJudgePrompt({ task: parsedTask, response: run.raw_text });
  const verdicts = [];
  for (const judge of judges) {
    const started = Date.now();
    let raw = '';
    let record = { valid: false, error: '', overall: null, verdict: '', confidence: null, dimensions: [], inputTokens: 0, outputTokens: 0, cost: 0, latency: 0 };
    try {
      const result = await invokeModel({ ...judge, temperature: 0, max_tokens: Math.max(700, Math.min(1600, judge.max_tokens || 900)) }, prompt, { ...parsedTask, title: `裁判：${parsedTask.title}` }, undefined);
      raw = result.text;
      const cost = (result.inputTokens * Number(judge.input_cost_per_million || 0) + result.outputTokens * Number(judge.output_cost_per_million || 0)) / 1_000_000;
      const parsed = parseVerdict(raw, parsedTask, { allowMock: false });
      record = { ...record, valid: parsed.ok, error: parsed.ok ? '' : parsed.errors.join(' '), overall: parsed.ok ? parsed.verdict.overall : null, verdict: parsed.ok ? parsed.verdict.verdict : '', confidence: parsed.ok ? parsed.verdict.confidence : null, dimensions: parsed.ok ? parsed.verdict.dimensions : [], inputTokens: result.inputTokens, outputTokens: result.outputTokens, cost, latency: result.latencyMs };
      verdicts.push(parsed.ok ? parsed.verdict : null);
    } catch (error) {
      record = { ...record, error: String(error.message).slice(0, 800), latency: Date.now() - started };
      verdicts.push(null);
    }
    db.prepare(`INSERT INTO judge_verdicts (id,run_id,judge_model_id,judge_label,judge_model_identifier,rubric_version,overall,dimensions,verdict,confidence,raw_text,input_tokens,output_tokens,cost,latency_ms,valid,error,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(run_id,judge_model_id) DO UPDATE SET overall=excluded.overall,dimensions=excluded.dimensions,verdict=excluded.verdict,confidence=excluded.confidence,raw_text=excluded.raw_text,input_tokens=excluded.input_tokens,output_tokens=excluded.output_tokens,cost=excluded.cost,latency_ms=excluded.latency_ms,valid=excluded.valid,error=excluded.error,created_at=excluded.created_at`)
      .run(uuid(), runId, judge.id, judge.name, `${judge.provider_name} / ${judge.model_id}`, String(parsedTask.version ?? '1'), record.overall, JSON.stringify(record.dimensions), record.verdict, record.confidence, String(raw).slice(0, 20000), record.inputTokens, record.outputTokens, record.cost, record.latency, record.valid ? 1 : 0, record.error, now());
  }

  const aggregate = aggregateVerdicts(verdicts);
  if (!aggregate) {
    const errors = verdictList(runId).map((row) => row.error).filter(Boolean);
    throw Object.assign(new Error(`裁判输出未通过 Schema 校验，未产生分数：${errors.join('；').slice(0, 600)}`), { status: 422 });
  }
  const applied = applyJudgeScore({ run, aggregate, judgeLabels: judges.map((model) => `${model.name} (${model.model_id})`), force });
  audit('judge', 'run', runId, { judges: judges.map((model) => model.model_id), overall: aggregate.overall, spread: aggregate.spread, applied: applied.applied });
  return { runId, aggregate, applied, verdicts: verdictList(runId) };
}

app.post('/api/runs/:id/judge', async (req, res) => {
  try {
    const result = await judgeOneRun({ runId: req.params.id, judgeModelIds: req.body?.judgeModelIds, force: req.body?.force === true });
    res.json(result);
  } catch (error) {
    res.status(error.status ?? 502).json({ error: error.message, verdicts: safeVerdicts(req.params.id) });
  }
});
function safeVerdicts(runId) { try { return verdictList(runId); } catch { return []; } }
app.get('/api/runs/:id/verdicts', (req, res) => {
  if (!judgeRunRow.get(req.params.id)) return res.status(404).json({ error: '找不到测试结果。' });
  const rows = verdictList(req.params.id);
  const aggregate = aggregateVerdicts(rows.filter((row) => row.valid).map((row) => ({ dimensions: row.dimensions, overall: row.overall, verdict: row.verdict, confidence: row.confidence })));
  res.json({ verdicts: rows, aggregate });
});
app.post('/api/sessions/:id/judge', async (req, res) => {
  const session = db.prepare('SELECT id FROM test_sessions WHERE id=?').get(req.params.id);
  if (!session) return res.status(404).json({ error: '找不到测试记录。' });
  const judgeModelIds = req.body?.judgeModelIds;
  const limit = Math.min(20, Math.max(1, Number(req.body?.limit) || 8));
  const force = req.body?.force === true;
  const candidates = db.prepare(`SELECT r.id FROM test_runs r JOIN evaluation_results e ON e.run_id=r.id
    WHERE r.session_id=? AND r.status='completed' AND r.is_mock=0 AND (e.score IS NULL OR (?=1 AND e.evaluator_type<>'human'))
    ORDER BY r.started_at LIMIT ?`).all(session.id, force ? 1 : 0, limit);
  if (!candidates.length) return res.json({ judged: 0, failed: 0, applied: 0, results: [], note: '本批次没有需要裁判评分的真实运行。' });
  const results = [];
  for (const row of candidates) {
    try {
      const result = await judgeOneRun({ runId: row.id, judgeModelIds, force });
      results.push({ runId: row.id, ok: true, overall: result.aggregate.overall, spread: result.aggregate.spread, applied: result.applied.applied });
    } catch (error) {
      results.push({ runId: row.id, ok: false, error: error.message });
    }
  }
  audit('judge_batch', 'session', session.id, { total: results.length, ok: results.filter((item) => item.ok).length });
  res.json({ judged: results.length, failed: results.filter((item) => !item.ok).length, applied: results.filter((item) => item.applied).length, results });
});

const readSettings = () => Object.fromEntries(db.prepare('SELECT key,value FROM system_settings').all().map((row) => [row.key, safeJson(row.value, row.value)]));
function leaderboardSettings() {
  const settings = readSettings();
  const rawWeights = settings.score_weights;
  const weights = rawWeights && typeof rawWeights === 'object' ? rawWeights : {};
  const rawMin = Number(settings.minimum_leaderboard_runs?.value ?? settings.minimum_leaderboard_runs ?? 10);
  return { weights, minRuns: Number.isFinite(rawMin) ? Math.max(1, Math.min(500, Math.round(rawMin))) : 10 };
}

/**
 * MIND BENCH SCORE 计算：
 * 1. 按分类取该模型有效真实评分的均值；
 * 2. 用可配置权重加权（缺测分类不按 0 处理）；
 * 3. ×10 映射到 1000 分制，并附带类别覆盖度与趋势，绝不隐藏样本不足。
 */
function buildLeaderboard({ category = 'overall', version = '', limit = 200, minRuns, weights } = {}) {
  const config = leaderboardSettings();
  const threshold = Number.isFinite(Number(minRuns)) && Number(minRuns) > 0 ? Number(minRuns) : config.minRuns;
  const scoreWeights = weights ?? config.weights;
  const params = [];
  let filter = '';
  if (category !== 'overall') { filter += ' AND t.category_id=?'; params.push(category); }
  if (version) { filter += ' AND r.model_version=?'; params.push(version); }
  const runs = db.prepare(`SELECT r.id,r.model_id,r.task_id,r.completed_at,r.task_version,t.category_id,e.score,e.evaluator_type,x.latency_ms,x.cost
    FROM test_runs r JOIN benchmark_tasks t ON t.id=r.task_id JOIN evaluation_results e ON e.run_id=r.id
    LEFT JOIN model_responses x ON x.run_id=r.id JOIN models m ON m.id=r.model_id
    WHERE r.status='completed' AND r.is_mock=0 AND r.is_external=0 AND e.score IS NOT NULL${filter}`).all(...params);
  const models = db.prepare(`SELECT m.id,m.name,m.model_id,m.model_version,p.name AS provider_name,p.kind AS provider_kind FROM models m JOIN providers p ON p.id=m.provider_id`).all();
  const totals = db.prepare("SELECT model_id,COUNT(*) AS n FROM test_runs WHERE status='completed' AND is_mock=0 AND is_external=0 GROUP BY model_id").all();
  const totalRuns = new Map(totals.map((row) => [row.model_id, row.n]));
  const nowMs = Date.now();
  const bucket = new Map();
  for (const model of models) {
    bucket.set(model.id, { model, scores: [], categories: new Map(), latencies: [], costs: [], last: null, recent: [], previous: [], sources: new Map() });
  }
  for (const run of runs) {
    const entry = bucket.get(run.model_id);
    if (!entry) continue;
    const score = Number(run.score);
    if (!Number.isFinite(score)) continue;
    entry.scores.push(score);
    entry.sources.set(run.evaluator_type || 'unknown', (entry.sources.get(run.evaluator_type || 'unknown') ?? 0) + 1);
    if (!entry.categories.has(run.category_id)) entry.categories.set(run.category_id, { sum: 0, count: 0 });
    const cell = entry.categories.get(run.category_id);
    cell.sum += score; cell.count += 1;
    if (Number.isFinite(Number(run.latency_ms))) entry.latencies.push(Number(run.latency_ms));
    if (Number.isFinite(Number(run.cost))) entry.costs.push(Number(run.cost));
    if (run.completed_at && (!entry.last || run.completed_at > entry.last)) entry.last = run.completed_at;
    const age = run.completed_at ? nowMs - new Date(run.completed_at).getTime() : Infinity;
    if (age <= 7 * 86400000) entry.recent.push(score);
    else if (age <= 14 * 86400000) entry.previous.push(score);
  }
  const totalCategories = db.prepare('SELECT COUNT(*) AS n FROM benchmark_categories').get().n || 15;
  const scores = [];
  for (const entry of bucket.values()) {
    const scored = entry.scores.length;
    if (!scored) continue;
    const categoryScores = {};
    const weightedParts = [];
    let weightSum = 0;
    for (const [categoryId, cell] of entry.categories) {
      const average = cell.sum / cell.count;
      categoryScores[categoryId] = Math.round(average);
      const weight = Number(scoreWeights?.[categoryId] ?? 1);
      if (!Number.isFinite(weight) || weight <= 0) continue;
      weightedParts.push(average * weight);
      weightSum += weight;
    }
    if (!weightSum) continue; // All tested categories were explicitly excluded by their weights.
    const weightedAverage = weightedParts.reduce((a, b) => a + b, 0) / weightSum;
    const recentAvg = entry.recent.length ? entry.recent.reduce((a, b) => a + b, 0) / entry.recent.length : null;
    const previousAvg = entry.previous.length ? entry.previous.reduce((a, b) => a + b, 0) / entry.previous.length : null;
    const row = {
      model_id: entry.model.id,
      model_name: entry.model.name,
      model_identifier: entry.model.model_id,
      model_version: entry.model.model_version,
      provider_name: entry.model.provider_name,
      provider_kind: entry.model.provider_kind,
      test_count: totalRuns.get(entry.model.id) ?? scored,
      scored_count: scored,
      average_score: Math.round(entry.scores.reduce((a, b) => a + b, 0) / scored),
      weighted_score: Math.round(weightedAverage * 10) / 10,
      mind_bench_score: Math.round(weightedAverage * 10),
      category_scores: categoryScores,
      category_coverage: Math.round((entry.categories.size / totalCategories) * 100),
      average_latency: entry.latencies.length ? Math.round(entry.latencies.reduce((a, b) => a + b, 0) / entry.latencies.length) : 0,
      average_cost: entry.costs.length ? Number((entry.costs.reduce((a, b) => a + b, 0) / entry.costs.length).toFixed(6)) : 0,
      last_tested: entry.last,
      trend: recentAvg !== null && previousAvg !== null ? Math.round(recentAvg - previousAvg) : null,
      score_sources: Object.fromEntries(entry.sources),
      rank_status: scored >= threshold ? 'qualified' : 'provisional',
      rank: null,
    };
    row.reason = scored >= threshold ? '' : `至少需要 ${threshold} 条非模拟且具有有效分数的测试，当前 ${scored} 条。`;
    scores.push(row);
  }
  scores.sort((a, b) => (b.rank_status === 'qualified') - (a.rank_status === 'qualified') || b.mind_bench_score - a.mind_bench_score || b.scored_count - a.scored_count);
  const eligible = scores.filter((row) => row.rank_status === 'qualified').slice(0, Math.min(200, Math.max(1, Number(limit) || 200)));
  eligible.forEach((row, index) => { row.rank = index + 1; });
  return { eligible, provisional: scores.filter((row) => row.rank_status === 'provisional'), threshold, weights: scoreWeights };
}
app.get('/api/leaderboard', (req, res) => {
  const category = String(req.query.category ?? 'overall');
  const version = String(req.query.version ?? '').slice(0, 100);
  const { eligible, provisional, threshold, weights } = buildLeaderboard({ category, version, limit: 200 });
  const versions = db.prepare("SELECT DISTINCT model_version FROM test_runs WHERE model_version<>'' AND is_mock=0 AND is_external=0 AND status='completed' ORDER BY model_version").all().map((row) => row.model_version);
  res.json({
    name: 'MIND BENCH SCORE',
    note: '这是平台自定义评测指数（0—1000），不是人类 IQ 或心理测量结果。按分类均值与可配置权重加权，缺测分类不按 0 处理；只统计非 Mock 的完成测试。',
    category,
    version: version || 'all',
    threshold,
    weights,
    versions,
    leaderboard: eligible,
    provisional: eligible.length ? provisional : provisional,
    metrics: eligible.map((row) => ({ modelId: row.model_id, score: row.mind_bench_score, sampleSize: row.scored_count, coverage: row.category_coverage })),
  });
});
app.get('/api/leaderboard/export', (req, res) => {
  const { eligible, provisional, threshold } = buildLeaderboard({ category: String(req.query.category ?? 'overall'), version: String(req.query.version ?? '') });
  const rows = [...eligible, ...provisional];
  if (String(req.query.format ?? 'json') === 'csv') {
    const columns = ['rank', 'rank_status', 'model_name', 'model_identifier', 'model_version', 'provider_name', 'mind_bench_score', 'average_score', 'scored_count', 'category_coverage', 'trend', 'average_latency', 'average_cost', 'last_tested'];
    const q = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    return res.type('text/csv').send([columns.join(','), ...rows.map((row) => columns.map((key) => q(row[key])).join(','))].join('\r\n'));
  }
  res.json({ name: 'MIND BENCH SCORE', exportedAt: now(), threshold, leaderboard: eligible, provisional });
});
app.get('/api/analytics',(req,res)=>{
  const categoryRows=db.prepare(`SELECT c.id,c.name,COUNT(DISTINCT CASE WHEN r.is_mock=0 AND r.is_external=0 AND r.status='completed' THEN r.id END) AS real_runs,AVG(CASE WHEN r.is_mock=0 AND r.is_external=0 AND r.status='completed' THEN e.score END) AS average_score,AVG(CASE WHEN r.is_mock=0 AND r.is_external=0 AND r.status='completed' THEN x.latency_ms END) AS average_latency,AVG(CASE WHEN r.is_mock=0 AND r.is_external=0 AND r.status='completed' THEN x.cost END) AS average_cost FROM benchmark_categories c LEFT JOIN benchmark_tasks t ON t.category_id=c.id LEFT JOIN test_runs r ON r.task_id=t.id LEFT JOIN evaluation_results e ON e.run_id=r.id LEFT JOIN model_responses x ON x.run_id=r.id GROUP BY c.id ORDER BY c.sort_order`).all().map((r)=>({...r,average_score:r.average_score===null?null:Math.round(r.average_score)}));
  const trend=db.prepare(`SELECT substr(r.completed_at,1,10) AS day,COUNT(*) AS runs,ROUND(AVG(e.score),1) AS score FROM test_runs r JOIN evaluation_results e ON e.run_id=r.id WHERE r.is_mock=0 AND r.is_external=0 AND r.status='completed' AND r.completed_at>=datetime('now','-30 days') GROUP BY day ORDER BY day`).all();res.json({categories:categoryRows,trend,leaderboard:buildLeaderboard({}).eligible.slice(0,10)});
});
app.get('/api/settings',(_req,res)=>{const settings=Object.fromEntries(db.prepare('SELECT key,value FROM system_settings').all().map((r)=>[r.key,safeJson(r.value,r.value)]));res.json({settings,concurrencyLimit});});
app.put('/api/settings/:key', (req, res) => {
  const key = req.params.key;
  const value = req.body?.value;
  if (!['score_weights', 'default_model_id', 'minimum_leaderboard_runs'].includes(key)) return res.status(400).json({ error: '不支持修改该设置。' });
  if (key === 'minimum_leaderboard_runs' && (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 500)) return res.status(400).json({ error: '最小样本数必须为 1 到 500 的整数。' });
  if (key === 'score_weights') {
    const categories = new Set(db.prepare('SELECT id FROM benchmark_categories').all().map((row) => row.id));
    if (!value || typeof value !== 'object' || Array.isArray(value) || !Object.keys(value).length || Object.entries(value).some(([id, weight]) => !categories.has(id) || typeof weight !== 'number' || !Number.isFinite(weight) || weight < 0 || weight > 100)) return res.status(400).json({ error: '权重必须为有效分类与 0 到 100 数字组成的对象。' });
  }
  if (key === 'default_model_id') {
    const model = typeof value === 'string' ? modelById.get(value) : null;
    if (!model || !model.enabled || !model.provider_enabled) return res.status(400).json({ error: '默认模型必须存在且已启用。' });
  }
  transaction(() => {
    db.prepare('INSERT INTO system_settings (key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at').run(key, JSON.stringify(value), now());
    if (key === 'default_model_id') { db.prepare('UPDATE models SET is_default=0').run(); db.prepare('UPDATE models SET is_default=1 WHERE id=?').run(value); }
  });
  writeAudit('update', 'setting', key);
  res.json({ ok: true });
});
app.get('/api/audit',(_req,res)=>res.json(db.prepare('SELECT id,action,entity_type,entity_id,details,created_at FROM audit_logs ORDER BY created_at DESC LIMIT 100').all().map((r)=>({...r,details:safeJson(r.details,{})}))));
app.get('/api/report/:sessionId',(req,res)=>{
  const session=db.prepare('SELECT * FROM test_sessions WHERE id=?').get(req.params.sessionId);if(!session)return res.status(404).json({error:'找不到测试报告。'});
  const runs=db.prepare(`SELECT r.id,r.status,r.is_mock,r.is_external,r.completed_at,t.title AS task_title,c.name AS category_name,m.name AS model_name,p.name AS provider_name,x.raw_text,x.latency_ms,x.input_tokens,x.output_tokens,x.cost,x.error,e.score,e.passed,e.evaluator_type,e.rationale FROM test_runs r JOIN benchmark_tasks t ON t.id=r.task_id JOIN benchmark_categories c ON c.id=t.category_id JOIN models m ON m.id=r.model_id JOIN providers p ON p.id=m.provider_id LEFT JOIN model_responses x ON x.run_id=r.id LEFT JOIN evaluation_results e ON e.run_id=r.id WHERE r.session_id=? ORDER BY r.started_at`).all(session.id);
  res.json({session:{...session,settings:safeJson(session.settings,{}),manifest:safeJson(session.run_manifest,{})},runs:runs.map((r)=>({...r,is_mock:Boolean(r.is_mock),is_external:Boolean(r.is_external),score:r.score===null?null:Number(r.score)}))});
});
app.get('/api/report/:sessionId/export',(req,res)=>{
  const session=db.prepare('SELECT id,name,mode,started_at,completed_at,run_manifest FROM test_sessions WHERE id=?').get(req.params.sessionId);if(!session)return res.status(404).json({error:'找不到测试报告。'});
  const rows=db.prepare(`SELECT r.id,r.status,r.is_mock,r.is_external,t.id AS task_id,t.title AS task_title,c.id AS category_id,c.name AS category_name,m.id AS model_id,m.name AS model_name,p.name AS provider_name,x.raw_text,x.latency_ms,x.input_tokens,x.output_tokens,x.cost,x.error,e.score,e.passed,e.evaluator_type,e.rationale FROM test_runs r JOIN benchmark_tasks t ON t.id=r.task_id JOIN benchmark_categories c ON c.id=t.category_id JOIN models m ON m.id=r.model_id JOIN providers p ON p.id=m.provider_id LEFT JOIN model_responses x ON x.run_id=r.id LEFT JOIN evaluation_results e ON e.run_id=r.id WHERE r.session_id=? ORDER BY r.started_at`).all(session.id);
  if(req.query.format==='csv'){const cols=Object.keys(rows[0]??{id:'',status:''});const q=(v)=>`"${String(v??'').replace(/"/g,'""')}"`;return res.type('text/csv').send([cols.join(','),...rows.map((r)=>cols.map((c)=>q(r[c])).join(','))].join('\r\n'));}
  res.json({session:{...session,manifest:safeJson(session.run_manifest,{})},runs:rows,exportedAt:now()});
});

app.use('/api',(req,res)=>res.status(404).json({error:'API 路由不存在。'}));
app.use((error,_req,res,_next)=>{console.error('[api-error]',error.message);if(res.headersSent)return;res.status(error.status??500).json({error:error.status?error.message:'服务器内部错误。'});});
if (existsSync(dist)) {
  app.use(express.static(dist, {
    index: false,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('index.html') || filePath.endsWith('build-info.json')) {
        res.setHeader('cache-control', 'no-store, max-age=0');
      } else {
        res.setHeader('cache-control', 'public, max-age=31536000, immutable');
      }
    },
  }));
  app.use((req, res, next) => req.path.startsWith('/api/')
    ? next()
    : res.sendFile(resolve(dist, 'index.html'), { headers: { 'cache-control': 'no-store, max-age=0' } }));
}

export const server=createServer(app);
const isDirect=process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href;
if(isDirect){const port=Number(process.env.PORT)||3000;const host=process.env.HOST||'127.0.0.1';server.listen(port,host,()=>console.log(`MIND BENCH listening at http://${host}:${port}`));}
export {app};
