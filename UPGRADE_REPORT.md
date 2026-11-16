# MIND BENCH 第二轮项目进化交付报告

日期：2026-11-16（Asia/Shanghai）  
项目：`mind-bench`  
分支：`main`  
基线 HEAD：`cac7d02`  
工作区：本轮修改均在当前仓库，未推送、未创建新 Release。

## A. 竞品研究

本轮及既有研究合计记录 **15 个**相关开源项目：

1. lm-evaluation-harness
2. HELM
3. OpenCompass
4. FastChat / Chatbot Arena
5. OpenAI Evals
6. promptfoo
7. Hugging Face LightEval
8. BIG-bench
9. DeepEval
10. Langfuse
11. Phoenix
12. Ragas
13. SWE-bench
14. EvalPlus
15. MLflow

证据与限制见 [COMPETITOR_ANALYSIS.md](COMPETITOR_ANALYSIS.md)、[docs/OPEN_SOURCE_RESEARCH.md](docs/OPEN_SOURCE_RESEARCH.md) 和 `.evolution/research.json`。本轮通过公开 Git 传输读取了 14 个仓库的当前 HEAD；SWE-bench 的传输请求被网络限制阻断。GitHub REST API 触发了 403 rate limit，因此没有虚构最新 Release、Issue 或 PR 数量。

最值得借鉴的实现方向：

- **任务/模型/指标分层**：lm-evaluation-harness、HELM、OpenAI Evals、LightEval。
- **声明式 provider、断言和回归门禁**：promptfoo、DeepEval。
- **匿名比较与人工复核**：FastChat/Chatbot Arena。
- **trace、成本、运行和制品记录**：Langfuse、Phoenix、MLflow。
- **严格环境验证**：SWE-bench、EvalPlus；当前仅作为未来沙箱设计参考。

MIND BENCH 的相对优势是本地 SQLite ownership、Mock/external 隔离、中文工作台和已落地的 Run Manifest；主要短板是没有基线质量门禁、持久化队列、路由代码分割、远程认证/租户隔离和代码执行沙箱。

## B. 升级数量与状态

共形成 **57 个有效升级点**，其中本轮实际实施 **11 个**，上一轮已完成 **20 个**，当前完成 **31 个**；规划中 **24 个**，延期 **2 个**。没有把同一个功能机械拆成多个项目。

| EV 编号 | 状态 | 说明 |
|---|---|---|
| EV-001—EV-020 | 已完成 | 上一轮已交付并有 `.evolution/` 与测试证据 |
| EV-021 | 已完成 | 随机挑战确定性 seed |
| EV-022 | 已完成 | 进程重启会话恢复 |
| EV-023 | 已完成 | 供应商类型白名单 |
| EV-024 | 已完成 | 供应商 URL/元数据地址边界校验 |
| EV-025 | 已完成 | API request ID |
| EV-026 | 已完成 | CSV 公式注入防护 |
| EV-027 | 已完成 | `/api/tasks/export` 静态路由修复 |
| EV-028 | 已完成 | 评分规则边界校验 |
| EV-029 | 已完成 | 会话/审计分页元信息 |
| EV-030 | 已完成 | 外部数据集原文 SHA-256 |
| EV-031 | 已完成 | 运行提示和通知可访问性 |
| EV-032—EV-042 | 计划 | Manifest 基线/门禁、复跑、差异视图、代码分割、分页题库、持久化队列、观测与 registry 能力 |
| EV-043 | 计划 | DNS 解析后的私网/loopback 出站策略 |
| EV-044—EV-045 | 计划 | 备份恢复、数据保留与脱敏 |
| EV-046—EV-055 | 计划 | 裁判并发、题库复核、多解校验、成本预算、provider fixture、真实 Key 流程、归档、i18n、SBOM、压力基准 |
| EV-056 | 延期 | 公网认证和多租户需要产品范围与部署授权 |
| EV-057 | 延期 | 代码沙箱需要单独的隔离、资源和审计设计 |

完整的每项问题、依据、参考项目、实施/验收标准在 [UPGRADE_ROADMAP.md](UPGRADE_ROADMAP.md)。

## C. 代码与文档修改

### 修改的核心文件

- `src/server.mjs`：请求 ID、限流桶清理、遗留会话恢复、CSV 安全单元格、导出路由顺序、供应商输入校验、随机 seed、导入哈希、分页响应头。
- `src/providers.mjs`：供应商类型常量和 URL 校验，模型发现/调用共用边界。
- `src/scoring.mjs`：one_of/contains/keywords/numeric/word_limit 无效配置保护。
- `src/App.jsx`：运行提示、toast 的 `role`/`aria-live`/`aria-label`。

### 新增文件

- `src/reproducibility.mjs`：seed 转换和确定性 Fisher–Yates。
- `tests/evolution.regression.test.js`：第二轮回归测试。
- `PROJECT_AUDIT.md`：项目现状和风险档案。
- `COMPETITOR_ANALYSIS.md`：15 个开源项目对标。
- `UPGRADE_ROADMAP.md`：57 项升级计划。
- `UPGRADE_REPORT.md`：本交付报告。

### 同步更新

`README.md`、`CHANGELOG.md`、`docs/API.md`、`docs/ARCHITECTURE.md` 已同步新行为、边界和限制。没有数据库 schema 破坏性变更，没有删除用户数据，没有引入新运行时依赖。

## D. 测试与验证

| 检查 | 结果 | 证据/说明 |
|---|---|---|
| `npm test -- --reporter=dot` | **PASS** | 9 个测试文件，57/57 通过 |
| `npm run test:e2e` | **PASS** | Chromium 8/8 通过，覆盖仪表盘、题库、报告刷新/取消、Mock 隔离、工作台、设置、研究页和 390px 移动端 |
| `npm run build` | **PASS** | Vite 构建成功；主 JS 927.04 kB，仍有 chunk size warning |
| `npm run package:release` | **PASS** | 生成 `mind-bench-0.2.1.tar.gz`，74 文件，无用户数据 |
| `npm run verify:release` | **PASS** | SHA-256、74 文件摘要、干净生产安装、UI/API/空数据检查通过 |
| `npm audit --registry=https://registry.npmjs.org --omit=dev --audit-level=high` | **PASS** | 0 vulnerabilities |
| 默认镜像源 `npm audit --omit=dev` | **BLOCKED** | 镜像端点返回 `NOT_IMPLEMENTED`；已用官方 registry 重跑并通过 |
| 真实供应商网络调用 | **NOT RUN / BLOCKED** | 当前没有真实 API Key，不伪造跨供应商成绩 |
| 公网渗透测试 | **NOT APPLICABLE** | 当前产品边界是本机单用户；公网部署仍不安全 |

## E. 项目变化

### 升级前

核心评测闭环已经可用，但随机批次使用非确定性排序；进程重启可能留下永久运行中会话；供应商类型和 URL 的校验分散且存在 SSRF 边界；导出未防公式注入；评分器对若干错误配置会产生误导性结果；导出路由存在实际 404 缺陷；历史和审计接口无法增量翻页。

### 升级后

- 随机挑战有稳定 seed，题目选择可由 manifest 复现。
- 进程重启后的遗留会话会进入明确的 failed 状态并留下审计记录。
- 供应商保存、模型发现和真实调用使用同一类型/URL 校验。
- CSV、数据集导入和 API 错误具备更明确的安全/审计边界。
- 评分无效配置会保留回答并返回空分，而不是伪造 0 分或崩溃。
- 题库导出真实可用，历史/审计 API 可分页，界面状态通知更适合辅助技术。

### 仍然不够

- 真实供应商调用、模型可比性、计费精度和远程部署没有验证。
- 主 bundle 偏大；没有基于 manifest 的自动复跑/回归门禁。
- 没有跨进程持久化队列、用户认证、租户隔离或代码沙箱。
- 内置题库仍是原创草案/待复核状态，不能当作权威基准。

## 下一阶段

优先实施 EV-032—EV-035：以 Run Manifest 为边界做基线比较、质量门禁、复跑和差异视图；然后做 EV-036/037 的代码分割与分页题库。涉及远程服务、代码执行或真实密钥的升级必须先保留本地单用户安全边界，并补齐可验证的隔离、授权和回滚证据。
