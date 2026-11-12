CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, email TEXT UNIQUE, display_name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'owner', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS providers (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL, base_url TEXT NOT NULL DEFAULT '', api_key_cipher TEXT NOT NULL DEFAULT '', enabled INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS models (
  id TEXT PRIMARY KEY, provider_id TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE, name TEXT NOT NULL, model_id TEXT NOT NULL, model_version TEXT NOT NULL DEFAULT '', enabled INTEGER NOT NULL DEFAULT 1, is_default INTEGER NOT NULL DEFAULT 0, temperature REAL NOT NULL DEFAULT 0, max_tokens INTEGER NOT NULL DEFAULT 1024, timeout_ms INTEGER NOT NULL DEFAULT 60000, max_retries INTEGER NOT NULL DEFAULT 1, input_cost_per_million REAL NOT NULL DEFAULT 0, output_cost_per_million REAL NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS benchmark_categories (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, name_en TEXT NOT NULL, description TEXT NOT NULL, icon TEXT NOT NULL, sort_order INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS benchmark_sources (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL DEFAULT '', license TEXT NOT NULL DEFAULT '', source_type TEXT NOT NULL, notes TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS benchmark_tasks (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, category_id TEXT NOT NULL REFERENCES benchmark_categories(id), subcategory TEXT NOT NULL, difficulty TEXT NOT NULL CHECK(difficulty IN ('easy','medium','hard','expert')), prompt_zh TEXT NOT NULL, prompt_en TEXT NOT NULL DEFAULT '', source_id TEXT NOT NULL REFERENCES benchmark_sources(id), objective TEXT NOT NULL, reference_answer TEXT NOT NULL DEFAULT '', scoring_rule TEXT NOT NULL DEFAULT '{}', scoring_dimensions TEXT NOT NULL DEFAULT '[]', common_errors TEXT NOT NULL DEFAULT '[]', notes TEXT NOT NULL DEFAULT '', version TEXT NOT NULL DEFAULT '1.0.0', verification_status TEXT NOT NULL DEFAULT 'draft', is_public INTEGER NOT NULL DEFAULT 1, created_by TEXT NOT NULL DEFAULT 'system', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS benchmark_task_versions (
  id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES benchmark_tasks(id) ON DELETE CASCADE, version TEXT NOT NULL, snapshot TEXT NOT NULL, change_note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, UNIQUE(task_id, version)
);
CREATE TABLE IF NOT EXISTS benchmark_test_cases (
  id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES benchmark_tasks(id) ON DELETE CASCADE, input TEXT NOT NULL, expected TEXT NOT NULL DEFAULT '', rule TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS scoring_rubrics (
  id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES benchmark_tasks(id) ON DELETE CASCADE, rubric TEXT NOT NULL, version TEXT NOT NULL DEFAULT '1'
);
CREATE TABLE IF NOT EXISTS test_sessions (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, mode TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'running', settings TEXT NOT NULL DEFAULT '{}', run_manifest TEXT NOT NULL DEFAULT '{}', started_at TEXT NOT NULL, completed_at TEXT
);
CREATE TABLE IF NOT EXISTS test_runs (
  id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES test_sessions(id) ON DELETE CASCADE, task_id TEXT NOT NULL REFERENCES benchmark_tasks(id), model_id TEXT NOT NULL REFERENCES models(id), task_version TEXT NOT NULL, model_version TEXT NOT NULL DEFAULT '', status TEXT NOT NULL, is_mock INTEGER NOT NULL DEFAULT 0, is_external INTEGER NOT NULL DEFAULT 0, started_at TEXT NOT NULL, completed_at TEXT
);
CREATE TABLE IF NOT EXISTS model_responses (
  id TEXT PRIMARY KEY, run_id TEXT NOT NULL UNIQUE REFERENCES test_runs(id) ON DELETE CASCADE, raw_text TEXT NOT NULL DEFAULT '', latency_ms INTEGER NOT NULL DEFAULT 0, input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0, cost REAL NOT NULL DEFAULT 0, error TEXT NOT NULL DEFAULT '', provider_request_id TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS evaluation_results (
  id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE, evaluator_type TEXT NOT NULL, score REAL, passed INTEGER, dimensions TEXT NOT NULL DEFAULT '[]', rationale TEXT NOT NULL DEFAULT '', judge_model TEXT NOT NULL DEFAULT '', reviewed INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS leaderboard_snapshots (
  id TEXT PRIMARY KEY, model_id TEXT NOT NULL REFERENCES models(id), category_id TEXT REFERENCES benchmark_categories(id), score REAL NOT NULL, sample_size INTEGER NOT NULL, conditions TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS favorites (
  id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES benchmark_tasks(id) ON DELETE CASCADE, created_at TEXT NOT NULL, UNIQUE(task_id)
);
CREATE TABLE IF NOT EXISTS custom_prompts (
  id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES benchmark_tasks(id) ON DELETE CASCADE, name TEXT NOT NULL, prompt TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL DEFAULT '', details TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS judge_verdicts (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
  judge_model_id TEXT NOT NULL,
  judge_label TEXT NOT NULL DEFAULT '',
  judge_model_identifier TEXT NOT NULL DEFAULT '',
  rubric_version TEXT NOT NULL DEFAULT '1',
  overall REAL,
  dimensions TEXT NOT NULL DEFAULT '[]',
  verdict TEXT NOT NULL DEFAULT '',
  confidence REAL,
  raw_text TEXT NOT NULL DEFAULT '',
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost REAL NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  valid INTEGER NOT NULL DEFAULT 0,
  error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  UNIQUE(run_id, judge_model_id)
);
CREATE INDEX IF NOT EXISTS idx_tasks_category ON benchmark_tasks(category_id);
CREATE INDEX IF NOT EXISTS idx_verdicts_run ON judge_verdicts(run_id);
CREATE INDEX IF NOT EXISTS idx_variants_task ON custom_prompts(task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_source ON benchmark_tasks(source_id);
CREATE INDEX IF NOT EXISTS idx_runs_model ON test_runs(model_id, status);
CREATE INDEX IF NOT EXISTS idx_runs_session ON test_runs(session_id);
CREATE INDEX IF NOT EXISTS idx_eval_run ON evaluation_results(run_id);
CREATE INDEX IF NOT EXISTS idx_responses_run ON model_responses(run_id);
