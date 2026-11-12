# HTTP API 参考

API 由 Express 在 `http://127.0.0.1:3000` 提供，同源路径以 `/api` 开头，使用 JSON 请求/响应。当前**没有登录认证、用户隔离或权限系统**；服务绑定回环地址只降低网络暴露面，不是认证机制。不要把服务代理到公网，也不要让不可信网页访问。

- 请求体上限 **8 MiB**。
- 每 IP 限流 **240 次 / 60 秒**（`429`）。
- 错误统一返回 `{ "error": "说明" }`。
- 非 `/api` 路径由生产构建的 SPA 接管。
- 所有 SQL 使用参数绑定；请求字段做长度截断与范围校验。

共 50+ 个端点（含会话清单与报告导出相关端点）。

---

## 健康与仪表盘

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | `{ ok, time, db, concurrency }`。 |
| GET | `/api/dashboard` | 题目/分类/模型/真实运行统计、最近运行、分类统计、候选榜单、`trend`（近 14 日运行趋势）。 |
| GET | `/api/categories` | 分类列表、题目难度计数、有真实结果时的均分。 |
| GET | `/api/analytics` | 分类统计、近 30 天真实运行趋势及榜单。 |

---

## 题库

| 方法 | 路径 | 请求/查询参数 | 说明 |
|---|---|---|---|
| GET | `/api/tasks` | `category`, `difficulty`, `q`, `source`, `limit`, `offset` | `{ tasks, total }`。 |
| GET | `/api/tasks/:id` | — | `{ task, versions, variants, favorite, derivedFrom }`；不存在返回 404。 |
| POST | `/api/tasks` | `{ title, categoryId, subcategory, difficulty, promptZh, objective, ... }` | 创建自建题，201 + `{ task }`；默认评分规则 `manual`。 |
| PUT | `/api/tasks/:id` | `title`, `category`, `subcategory`, `difficulty`, `promptZh`, `promptEn`, `objective`, `referenceAnswer`, `scoringRule`, `dimensions`, `commonErrors`, `notes`, `isPublic`, `changeNote` | 更新并追加版本快照。内置题不可直接改，需先「复制为新题」。 |
| DELETE | `/api/tasks/:id` | — | 删除自建题。内置题 `403`；已有运行记录 `409`。 |
| POST | `/api/tasks/:id/copy` | `{ title? }` | **复制为新题**，真实落库，`derived_from` 记录来源，返回 201 + `{ task }`。 |
| GET | `/api/tasks/:id/versions` | — | 版本历史快照列表（含 `changeNote`、时间）。 |
| POST | `/api/tasks/:id/variants` | `{ name, promptZh, notes? }` | 新增同考点变体问法。 |
| DELETE | `/api/variants/:id` | — | 删除变体。 |
| GET | `/api/custom-tasks` | `q`, `limit` | 自建/副本题目列表（含 `is_public`、变体计数），供提示词工作台使用。 |
| POST | `/api/tasks/import` | JSON 数组或 `{ "tasks": [...] }` | 原生格式导入，最多 1000 条；`{ imported, errors:[{index,error}] }`。 |
| POST | `/api/tasks/import-dataset` | `{ format: "jsonl"\|"csv", content, license, mapping? }` | **外部数据集适配**。`license` 必填，缺失即 400。支持字段别名映射（`question`→`promptZh` 等）。导入题 `verification_status='imported'`。返回 `{ imported, skipped, errors, warnings }`。 |
| GET | `/api/tasks/export` | `category`, `format=json\|csv` | 导出题目与来源元数据。 |
| POST | `/api/tasks/:id/favorite` | — | 切换收藏，`{ favorite }`。 |
| GET | `/api/favorites` | — | 本机收藏列表。 |

创建题目的最低字段：`title`、有效的 `categoryId`、`subcategory`、`difficulty`、`promptZh`、`objective`。导入的最低字段：`title`、有效 `categoryId`、`promptZh`。

> 导入者须自行确认第三方数据授权；服务**不验证**许可真伪，只强制要求填写并原样记录。

---

## 供应商与模型

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/providers/kinds` | 支持的 13 种 kind：`openai`, `anthropic`, `gemini`, `deepseek`, `zhipu`, `moonshot`, `minimax`, `qwen`, `openrouter`, `ollama`, `lmstudio`, `openai-compatible`, `mock`。 |
| GET | `/api/providers` | `{ providers, models }`；**不返回 Key 明文**，只给 `has_api_key`。 |
| POST | `/api/providers` | `{ name, kind, baseUrl, apiKey, enabled }`。Key 服务端 AES-256-GCM 加密；`kind='mock'` 时 `base_url` 强制为空。 |
| PUT | `/api/providers/:id` | 更新；仅当提交非空 `apiKey` 时替换既有 Key。 |
| DELETE | `/api/providers/:id` | 存在关联模型或历史记录时 `409`。 |
| **GET** | **`/api/providers/:id/models`** | **从供应商接口发现模型列表**。按 kind 请求对应端点（OpenAI 兼容 `/models`、Ollama `/api/tags`、Gemini `/v1beta/models`），返回 `{ provider, models:[{id,name}], source }`。供应商未配 Base URL 返回 400，上游失败返回 502。 |
| POST | `/api/models` | `{ providerId, name, modelId, modelVersion, temperature, maxTokens, timeoutMs, maxRetries, inputCostPerMillion, outputCostPerMillion, enabled, isDefault }`。 |
| GET | `/api/models/:id` | **模型档案**：`{ model, provider, stats, successRate, categoryScores, recent, history, judgedRuns }`。用于雷达图与走势图。 |
| PUT | `/api/models/:id` | 更新模型配置。 |
| DELETE | `/api/models/:id` | 有历史记录时 `409`。 |
| POST | `/api/models/:id/test-connection` | 连接检查。Mock 检查只表示 Mock 流程可用。 |

> Base URL 会引发**服务器端请求**（潜在 SSRF 面）。单机使用时由你控制；若改为多用户，必须加白名单校验。

---

## 运行测试

### 单题 / 多模型

`POST /api/test-runs`：

```json
{
  "taskId": "logic-01",
  "modelIds": ["model-id"],
  "name": "可选运行名称",
  "promptOverride": "可选的本次提示词覆盖",
  "manualText": "可选：记录外部回答而不调用供应商",
  "deferred": true
}
```

`modelIds` 可用单个 `modelId` 替代。`deferred:true` 时立即返回 `202 { sessionId, status:"running" }`，通过 `GET /api/sessions/:id` 轮询并可调用取消接口；省略时保持同步执行并在完成后返回 `{ sessionId, results }`。失败模型以独立 `status:"failed"` 记录，不抛弃其他结果。人工粘贴回答不消耗 Token，并写入 `isExternal:true`，不会进入正式排行榜。Mock 返回标记 `mock:true` 且 `score: null`。

### 批量 / 挑战

`POST /api/test-sessions`：

```json
{
  "name": "可选名称",
  "mode": "random",
  "categoryId": "logic",
  "difficulty": "medium",
  "taskIds": ["logic-01"],
  "questionCount": 10,
  "repeats": 3,
  "modelIds": ["model-id"],
  "deferred": true
}
```

批量接口同样支持 `deferred:true`，返回 `202` 后异步执行。

支持的 `mode`：`single`、`category`、`comprehensive`、`extreme`、`random`、`stability`、`custom`、`external`。

- 单轮最多 300 个「模型 × 题目」任务。
- 并发受 `MIND_BENCH_CONCURRENCY` 控制（默认 4，上限 8）。
- `random` / `challenge` / `stability` / `custom` 会打散题目顺序。
- `stability` 使用 `repeats` 重复同一批题。

### 会话与回答

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/sessions?limit=50` | 最近会话（limit ≤ 100）。 |
| GET | `/api/sessions/:id` | 会话设置、逐条 run/回答/评分，新增 `verdicts`（AI 裁判明细）。 |
| GET | `/api/sessions/:id/manifest` | 读取该会话的不可变 Run Manifest：题目/模型/评分/环境快照与 SHA-256 完整性摘要。 |
| POST | `/api/sessions/:id/cancel` | 取消运行中的会话；已结束或不存在 `404`。 |
| GET | `/api/runs/:id` | 单条运行详情：提示词、原始回答、Token、耗时、费用、评分、评分理由、`judge_model`。 |
| PUT | `/api/runs/:id/evaluation` | 人工评分：`{ score: 0..100, passThreshold: 0..100, rationale }`。写入 `evaluator_type='human'`。 |

---

## AI 裁判

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/judges` | 裁判候选池。**排除 Mock 模型**；不返回 Key。 |
| POST | `/api/runs/:id/judge` | 对单条运行发起裁判。`{ judgeModelId }`。 |
| GET | `/api/runs/:id/verdicts` | 该运行已有的裁判记录。 |
| POST | `/api/sessions/:id/judge` | **批量裁判**：`{ judgeModelIds: [...] }`（最多 3 位）。并发受同一并发池限制，逐条隔离失败。 |

裁判流程与拒绝条件：

1. 匿名化候选为 `Candidate A`，提示词声明裁判不知候选来源；
2. rubric 强制来自题目 `scoring_dimensions`；
3. 解析严格 JSON；**缺维度 / 多维度 / 分数越界 / 自由文本 / `mock:true` 一律 422**；
4. 服务端按权重重算 `overall`，不信任模型自报值；
5. 候选模型 ID == 裁判模型 ID → 拒绝（禁止自评）；
6. 已有 `reviewed` 人工评分时不覆盖，除非 `{ force: true }`；
7. 写入 `judge_verdicts`（`UNIQUE(run_id, judge_model_id)`，重复为 UPSERT）。

返回示例：

```json
{
  "verdict": {
    "runId": "run-1",
    "judgeModelId": "m-2",
    "judgeModel": "GPT-4o",
    "overall": 85,
    "dimensions": [{ "name": "任务完成度", "score": 90, "reason": "..." }],
    "spread": null,
    "agreement": null,
    "mock": false
  }
}
```

---

## 排行榜、报告与分析

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/leaderboard?category=overall&version=&limit=&minRuns=&weights=` | 返回 `{ eligible, provisional, threshold, weights, category }`。 |
| GET | `/api/leaderboard/export?format=csv\|json` | 导出榜单，**附带权重与阈值快照**，便于复现。 |
| GET | `/api/report/:sessionId` | 会话报告及逐条结果。 |
| GET | `/api/report/:sessionId/export` | 默认 JSON；`?format=csv` 输出 CSV。 |
| GET | `/api/settings` | 当前设置与并发上限。 |
| PUT | `/api/settings/:key` | 允许 `score_weights`、`default_model_id`、`minimum_leaderboard_runs`，体为 `{ "value": ... }`。**`score_weights` 已实际接入排行榜加权计算**。 |
| GET | `/api/audit` | 最近审计事件。 |

排行榜行字段：

```json
{
  "model_id": "...",
  "model": "GPT-4o",
  "provider": "OpenAI",
  "weighted_score": 782,
  "category_scores": { "logic": 85, "math": 74 },
  "category_coverage": 9,
  "runs": 42,
  "avg_latency": 3120,
  "last_run_at": "2026-11-11T09:00:00.000Z",
  "trend": 12,
  "score_sources": { "rule": 30, "judge": 10, "human": 2 },
  "rank_status": "qualified",
  "reason": null
}
```

`provisional` 行的 `rank_status` 为 `provisional`，`reason` 说明原因（如 `样本 4/10`），**不占名次**。

---

## 状态码与错误

| 码 | 含义 |
|---|---|
| `200` | 成功 |
| `201` | 创建 / 运行成功 |
| `400` | 参数错误（含缺少许可证） |
| `403` | 内置题不可删除/编辑 |
| `404` | 不存在 |
| `409` | 受历史外键限制无法删除 |
| `413` | 请求体或导入超限 |
| `422` | 裁判输出不符合 Schema（**不降级为 0 分**） |
| `429` | 频率限制 |
| `502` | 供应商调用失败 |

单个模型运行失败通常收录在 `results` 中，而不是导致整批请求失败。

---

## 数据与安全注意

- 不要把真实 Key、私密回答或个人数据复制到公共问题、日志或截图。
- API 无认证；运行报告包含**原始模型回答**。仅适合可信的本机使用者。
- 供应商地址由配置决定；云端部署需补 SSRF 防护、认证、TLS 与审计隔离。
- **用户/模型生成的代码不会被执行**——本平台没有代码沙箱，因此也不提供"运行代码"端点。
- 分数仅代表规则/裁判/人工审核结果，**不代表普适智能或 IQ**。
