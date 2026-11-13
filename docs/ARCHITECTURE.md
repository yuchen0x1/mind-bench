# MIND BENCH 项目架构

## 技术选型

| 层 | 选择 | 理由 |
|---|---|---|
| 运行时 | Node.js 24+ | 使用内置 `node:sqlite`，无需额外安装数据库；CI 与 Docker 使用 Node.js 24 |
| API | Express 5 | 中间件式 SPA 回退、原生 async 错误传播 |
| 持久化 | `node:sqlite` `DatabaseSync` | 零依赖、WAL、外键、预编译语句；单文件便于备份 |
| 前端 | React 19 + Vite 8 | Hash 路由单页应用，构建即静态产物，无 SSR 负担 |
| 图表 | Recharts | 雷达图、面积图、柱状图、饼图的统一数据接口 |
| 动效 | Framer Motion | 页面切换与列表进出场 |
| 图标 | lucide-react | 统一线性图标 |
| 测试 | Vitest + Playwright | 单元/HTTP 集成 + 真实 Chromium 用户流程 |
| 部署 | Docker 多阶段构建 | 非 root、健康检查、数据卷 |

## 组件边界

```text
浏览器 (React 19, src/App.jsx)
  ├── 页面层：总览/题库/单题/测试中心/对比/工作台/排行榜/历史/报告
  │            /分析/模型管理/模型档案/导入/研究/设置
  ├── 共享 UI：PageHeader, SectionTitle, EmptyState, MetricCard,
  │            ModelPicker, Notice, ConfirmDialog
  └── 同源 /api JSON（48 端点）
        │
        ├── Express (src/server.mjs)
        │     ├── 安全层：CSP / nosniff / DENY / 限流 / 8MB body
        │     ├── 校验层：required()、范围截断、外键存在性检查
        │     ├── 执行层：asyncPool 并发池、AbortController 取消
        │     └── 事务层：BEGIN IMMEDIATE + 预编译语句
        │
        ├── src/db.mjs        连接、WAL、PRAGMA、轻量迁移、加解密
        ├── src/schema.sql    19 张表、外键、唯一约束、索引
        ├── src/scoring.mjs   10 种确定性评分规则
        ├── src/judge.mjs     AI 裁判：匿名化、Rubric、严格 JSON、聚合
        ├── src/providers.mjs 供应商适配器 + 模型列表发现
        ├── src/seed-data.mjs 203 道原创题（15 分类）
        └── src/supplemental-data.mjs 补充题库
```

## 数据流

### 一次测试运行

```text
用户点击「运行」
  → POST /api/test-sessions { mode, taskIds, modelIds, repeats }
  → 展开为 N×M 个 (task, model) 任务
  → 创建 test_sessions 行 + 逐条 test_runs 行（status=running）
  → 同时写入不可变 run_manifest 1.1.0：题目全文/参考答案/覆盖提示词/模型/单价/评分/环境快照 + SHA-256
  → asyncPool 并发执行（上限 MIND_BENCH_CONCURRENCY）
      → providers.mjs 调用对应协议
      → 写 model_responses（原始文本、usage、latency）
      → scoring.mjs 按 scoring_rule 评分
      → evaluation_results（evaluator_type='rule'）
      → test_runs.status = success | failed
  → 返回 { sessionId, results }
```

失败隔离：单个 (task, model) 失败只标记该 run 为 `failed`，不抛出整批异常。

### 一次 AI 裁判

```text
POST /api/sessions/:id/judge { judgeModelIds }
  → 过滤：跳过 mock / 未成功 / 空回答 / 已 reviewed 人工分
  → 对每条 run：
      buildJudgePrompt()：回答匿名化，提示词/参考答案/rubric 来自运行清单（旧清单兼容读取当前题目）
      → 调用裁判模型
      → parseVerdict()：严格 JSON + 维度校验，失败即 422 拒绝该条
      → 服务端按权重重算 overall
      → 写 judge_verdicts（UPSERT）
      → applyJudgeScore() 更新 evaluation_results（不覆盖人工复核）
  → 返回逐条 verdict 与失败原因
```

### 排行榜计算

```text
GET /api/leaderboard
  → 读取 system_settings.score_weights 与 minimum_leaderboard_runs
  → 聚合 test_runs（过滤 mock / external / 失败 / 未评分）
  → 每模型按分类求均值 → 按权重加权（仅已覆盖分类归一化）
  → weightedAverage × 10 = MIND BENCH SCORE (0-1000)
  → 分 qualified / provisional（阈值判定）
  → 附加 category_coverage / trend / score_sources
```

## SQLite 核心表（19 张）

| 表 | 作用 | 关键约束 |
|---|---|---|
| `users` | 本机默认用户占位 | — |
| `providers` | 供应商配置 | `api_key_cipher` 加密存储 |
| `models` | 模型配置 | `is_default` 全局唯一（写时置其他为 0） |
| `benchmark_categories` | 15 个一级分类 | `key` 唯一 |
| `benchmark_sources` | 来源与许可证 | — |
| `benchmark_tasks` | 题目主表（20 字段） | `category_id` FK、`derived_from` 溯源 |
| `benchmark_task_versions` | 版本快照 | `task_id` FK + 索引 |
| `benchmark_test_cases` | 内部测试用例 | `task_id` FK |
| `scoring_rubrics` | 可复用评分模板 | — |
| `test_sessions` | 一轮测试 | `mode`、`status` |
| `test_sessions.run_manifest` | 一轮测试的可复现性清单 | 题目/模型/评分器/环境快照、完整性哈希 |
| `test_runs` | 每个 (task, model) | `session_id` FK、`is_mock`、`is_external`、`status` |
| `model_responses` | 原始回答 | `run_id` FK（1:1） |
| `evaluation_results` | 评分结果 | `run_id` FK、`evaluator_type` |
| `judge_verdicts` | AI 裁判明细 | `UNIQUE(run_id, judge_model_id)` |
| `leaderboard_snapshots` | 榜快照 | — |
| `favorites` | 收藏 | `UNIQUE(user, task)` |
| `custom_prompts` | 工作台草稿 | — |
| `system_settings` | 权重、阈值、默认模型 | `key` 主键 |
| `audit_logs` | 审计 | 时间索引 |

表定义、FK、CHECK 与索引见 `src/schema.sql`。

## 关键设计决策

**1. 为什么不用 ORM？**
`node:sqlite` 的预编译语句已足够表达本项目查询，且能精确控制事务边界（`BEGIN IMMEDIATE`）。ORM 会引入额外依赖与 N+1 风险，对单机应用不划算。

**2. 为什么 AI 裁判解析失败要 422 而不是 0 分？**
0 分会被下游误读为"模型完全没有完成"，而解析失败只意味着"裁判这次没跑通"。两者在聚合时若不区分，会系统性压低模型分数。所以宁可缺一条裁判分，也不写入可疑值。

**3. 为什么排行榜不把缺测分类按 0 计？**
这会让只跑了 3 个分类的模型被 12 个"0 分"拖垮，产生错误的低分。改为只在已覆盖分类上加权并归一化，同时显式暴露 `category_coverage`，让阅读者知道分数的覆盖范围。

**4. 为什么原始回答不做任何清洗？**
评测的可信度建立在"模型说了什么就是什么"上。改写、截断或摘要都会引入评测者偏见。因此 `model_responses.raw_text` 原样保存，前端只做转义渲染。

**5. 为什么不展示思维链？**
供应商不保证返回真实推理过程，某些"reasoning"字段是二次生成的摘要。伪造或推测思维链会误导使用者，因此平台只展示供应商响应中明确返回的文本，并标注"平台不获取隐藏思维链"。

## 信任边界与当前限制

- 只绑定 `127.0.0.1`，**无多租户认证**；不得在未补认证、TLS、CSRF/来源校验与部署加固时暴露到公网。
- 提示词、导入数据、模型回答均为**不可信文本**；页面通过 React 文本节点与 `<pre>` 渲染，不使用 `dangerouslySetInnerHTML`。
- 供应商地址是用户可配置项，会引发服务端请求；远程/云部署必须增加 SSRF 防护与允许列表。
- **没有代码沙箱**：编程题只评估文本，不在任何进程执行模型生成的代码。
- 已实现 OpenAI 兼容、Anthropic Messages、Gemini `generateContent`、Ollama、LM Studio 与显式 Mock；各品牌专有特性（prompt caching、grounding、tool use 等）未实现。
- 模型列表发现已实现（`/api/providers/:id/models`），但依赖供应商返回标准格式。
- 不返回隐藏推理链；只展示供应商响应中允许返回的文本。
- `README` 与 `docs/` 描述的是使用边界与许可证边界；**代码许可证不等于被导入题目的再分发许可**。
