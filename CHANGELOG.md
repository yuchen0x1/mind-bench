# Changelog

本项目尚未发布正式版本。以下记录当前工作区实现范围，不是稳定 API 或兼容性承诺。

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

---

## [Unreleased] - 2026-11-12 — 运行可信度与异步取消

### Added
- 新增 Web 版本清单 /api/version、构建信息 dist/build-info.json 和浏览器新部署提示。
- 新增 .github/workflows/ci.yml 与 .github/workflows/release.yml：main/PR 验证、SemVer 标签构建和 SHA-256 Release 资产。
- 新增 docs/AUTO_UPDATE.md，明确 Web 更新边界、缓存策略、权限和未完成的签名/远程发布条件。

- 为每个测试会话新增 Run Manifest：冻结题目版本、模型/供应商参数、评分权重、评分器版本与执行环境。
- 报告页展示可复现性摘要，新增 `/api/sessions/:id/manifest` 与清单 JSON 导出。
- 使用 SHA-256 对规范化清单生成完整性摘要，报告 JSON 导出内嵌清单。
- 外部粘贴回答写入 `test_runs.is_external`，在报告中明确标注，并排除正式排行榜及真实模型统计。
- 测试接口支持 `deferred:true`：立即返回会话 ID，前端可轮询进度并真正取消运行。
- 模型 `max_retries` 对网络错误和 5xx 响应执行有限指数退避重试。
- 补充外部回答、异步运行和重试的回归测试。

---

## [0.2.0] - 2026-11-11 — 评分闭环与可复现性

本次迭代的核心是**关闭三个自述缺口**：AI 裁判缺失、权重未接入排行榜、编辑副本/版本历史只是提示。同时补齐模型发现与外部数据集适配，并修复了测试污染正式库的缺陷。

### Added

**AI 裁判引擎**（`src/judge.mjs`，新增）

- 提示词层面匿名化候选回答（`Candidate A`），裁判不知道回答来自哪个模型。
- Rubric 强制来自题目 `scoring_dimensions`，不允许裁判增删维度。
- 严格 JSON 解析 + Schema 校验：缺维度 / 多维度 / 分数越界 / 自由文本 / `mock:true` 一律拒绝。
- 服务端按维度权重重算总分，不信任模型自报的 `overall`。
- 禁止自评（候选模型 == 裁判模型时拒绝）。
- 多裁判聚合：`mean` / `spread` / `agreement`，最多 3 位裁判。
- 人工复核优先，AI 裁判不覆盖已标记 `reviewed` 的人工分（除非 `force`）。
- 新表 `judge_verdicts`，`UNIQUE(run_id, judge_model_id)`，记录裁判模型、版本、原始返回、解析结果。

**新增 API（8 个）**

- `GET /api/judges` — 裁判候选池（排除 Mock）
- `POST /api/runs/:id/judge` — 单条裁判
- `GET /api/runs/:id/verdicts` — 裁判记录
- `POST /api/sessions/:id/judge` — 批量裁判
- `GET /api/tasks/:id/versions` — 版本历史
- `POST /api/tasks/:id/copy` — 复制为新题（真实落库）
- `POST /api/tasks/:id/variants` / `DELETE /api/variants/:id` — 变体管理
- `GET /api/custom-tasks` — 自建题列表
- `POST /api/tasks/import-dataset` — 外部数据集适配（JSONL/CSV，许可证必填）
- `GET /api/providers/:id/models` — 从供应商接口发现模型列表
- `GET /api/models/:id` — 模型档案（统计、分类分、走势）
- `GET /api/leaderboard/export` — 榜单导出（含权重与阈值快照）
- `DELETE /api/tasks/:id` — 删除自建题（内置题 403、有运行记录 409）

**排行榜重写**

- 分类权重从 `system_settings.score_weights` 读取并**真正参与加权计算**。
- 覆盖度（已覆盖分类 / 15）暴露到榜单，缺测分类不按 0 计。
- 趋势：近 7 日 vs 前 7 日加权分变化。
- `qualified` / `provisional` 两级排名，provisional 不占名次并给出原因。
- 版本过滤，避免不同题库版本混排。
- CSV / JSON 导出，附权重与阈值快照。

**新增页面与视图**

- **提示词工作台**（`#promptlab`）：三栏布局——自建题列表 / 编辑器 / 实时评分预览 + 变体管理。
- **模型档案**（`#model/<id>`）：能力雷达、得分走势面积图、最近运行表、参数与成本。
- **报告页 AI 裁判面板**：裁判选择、批量裁判、逐维度理由、分歧警告。
- **报告页并排对比 Tab**：LCS 逐词差异高亮 + 评分矩阵。
- **排行榜**：版本下拉、覆盖度列、趋势箭头、可展开分项条、导出按钮。
- **题库**：卡片/列表双视图切换。
- **供应商**：模型发现下拉 + 供应商条带。
- **系统设置**：最小样本阈值可编辑（原为静态文案）。
- **总览**：真实运行趋势面积图（替换原占位块）。

**部署**

- `Dockerfile`：多阶段构建、非 root `node` 用户、healthcheck、`/data` 卷。
- `compose.yaml`：端口仅绑 `127.0.0.1`，命名卷 `mind-bench-data`。
- `.dockerignore`。

**文档**

- README 全面重写：功能状态表（区分已实现/未验证/未实现）、11 张真实截图、Docker 实测说明、环境变量表、安全设计、已知限制。
- 新增/重写 `docs/SCORING_GUIDE.md`、`docs/API.md`、`docs/ARCHITECTURE.md`、`docs/USER_GUIDE.md`、`docs/BENCHMARK_METHODOLOGY.md`、`docs/TEST_DATA_GUIDE.md`。

### Changed

- `express.json` 上限从 1MB 调整为 8MB（数据集导入需要）。
- `server.listen` 支持 `HOST` 环境变量（Docker 需要 `0.0.0.0`）。
- `GET /api/tasks/:id` 增返 `variants`、`derivedFrom`。
- `GET /api/sessions/:id` 增返 `verdicts`。
- `GET /api/runs/:id` 增返 `judge_model`。
- `GET /api/custom-tasks` 增返 `is_public`（修复复制题变私有导致的 404）。
- `PUT /api/runs/:id/evaluation` 的 `passed` 改为 `?1:0`（修复 SQLite 布尔绑定错误）。
- Mock 供应商的 `base_url` 强制为空字符串（避免显示误导性的 `https://api.openai.com/v1`）。
- 排行榜表头由 7 列修正为 8 列；报告 KPI 区由 4 列改为 5 列。

### Fixed

- **测试污染正式数据库**：`vite.config.js` 缺少 `test.setupFiles`，`tests/setup.js` 未生效，集成测试直接写入 `data/mind-bench.sqlite`，遗留 5 个测试供应商与 4 个模型。已补 `setupFiles`，并把数据库备份到 `data/backups/` 后清理残留。
- **复制题目后详情 404**：`draftFromTask` 拿到 `undefined` 的 `is_public`，`PUT` 时写成 0。已修前端默认值与后端返回字段。
- **变体保存后预览不更新**：`VariantEditor` 依赖 `data?.task?.title`，而 `useApi` 不返回 `task`。已改为传入 `taskTitle` + `key`。
- **模型卡片显示多余 `0`**：`{model.is_default && ...}` 渲染了数字 0。已改为 `Boolean()`。
- **E2E 严格模式冲突**：「添加供应商」按钮匹配 2 个元素；变体按钮误点左侧「新建自建题目」。已用 `.first()` 与作用域定位修复。
- **移动端截图空白**：侧栏 overlay 遮挡内容。已改为先关栏截图、再单独截导航。

### Tests

- 新增 `tests/judge.test.js`（8 个测试）：匿名化、默认 rubric、严格 JSON、code fence 兼容、拒绝自由文本/缺维度/额外维度/越界、拒绝 mock、多裁判聚合。
- 新增 `tests/api.features.test.js`（9 个测试）：副本/版本/变体/删除保护/数据集导入、裁判池排除 mock、自评阻断、judge JSON 校验、无效维度 422、人工复核不被覆盖、排行榜 weights/threshold/provisional/导出、模型档案不含密钥。
- 重写 `tests/e2e/app.spec.js`（6 个测试）：覆盖 10 步真实用户流程 + 移动端。
- 结果：**Vitest 36/36 通过，Playwright 6/6 通过**。

### Known limitations

- **无真实 API Key**：真实供应商联网调用、计费精度、跨供应商可比性均未验证。所有测试使用 Mock 或本地 stub。
- 203 道内置题仍为原创草案（178 `review_required` + 25 `draft`），尚无 `verified`。
- **无代码沙箱**：编程题只评文本，不执行代码。
- 单机应用，无认证/多租户/公网部署防护。
- Vite 开发模式仍无 `/api` 代理。
- 供应商专有特性（prompt caching、grounding、tool use）未实现。
- 根目录 `LICENSE` 仍未添加，正式公开前须由权利人确定。

---

## [0.1.0] - 2026-11-11 — 初始可运行 MVP

### Added

- Node.js/Express API、React/Vite 界面及本地 SQLite 持久化。
- 15 个评测分类和 203 道带来源/许可/版本/验证状态的 MIND BENCH 原创草案题。
- OpenAI-compatible、Anthropic Messages、Gemini generateContent 与显式 Mock provider adapter。
- AES-256-GCM 本地供应商 Key 加密；请求限制、运行超时/取消及批量并发控制。
- 规则评分与人工评分，测试会话、回答和结果历史、基础排行榜、分析及 JSON/CSV 导出。
- 用户、架构、评分、题目审核、数据来源与开源研究文档。
- Vitest 单元/API 集成测试和 Playwright Chromium 浏览器流程测试。

### Known limitations

- 内置题库为待人工审核草案；没有 AI judge、代码执行沙箱、认证、多租户或公网部署支持。
- 没有真实 API Key，未验证真实模型调用和供应商计费。
- Docker 部署、自动模型发现、所有厂商专有 API 均未实现。
- 类别权重设置尚未接入排行榜聚合。
- 项目自身根目录许可证尚未添加。

[0.2.0]: 当前工作区实现
[0.1.0]: 初始实现
