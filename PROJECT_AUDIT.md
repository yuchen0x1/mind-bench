# MIND BENCH 项目现状审计

审计日期：2026-11-16（Asia/Shanghai）  
仓库：`mind-bench`，分支 `main`，HEAD `cac7d02`，远程 `origin/main`  ️  
审计范围：当前工作区源代码、SQLite schema、测试、构建与既有 `.evolution/` 记录。

## 1. 项目定位

MIND BENCH 是一个本地单用户 AI 模型评测工作台。它把同一题目发送给一个或多个模型，保存原始回答、供应商元数据、耗时和 Token，使用确定性规则、AI 裁判和人工复核形成可追溯报告。项目明确不把分数解释为人类 IQ，也不把 Mock 或外部粘贴回答混入正式排行榜。

主要用户是需要比较模型、回归提示词、审查回答质量和保存实验记录的开发者或研究者。当前部署边界是可信本机用户；服务默认绑定 `127.0.0.1`，没有账号、多租户和远程访问控制。

## 2. 实际技术栈与运行路径

| 层 | 当前实现 | 证据 |
|---|---|---|
| 前端 | React 19、Vite 8、Hash 路由、Framer Motion、Recharts、lucide-react | `package.json`、`src/App.jsx`、`vite.config.js` |
| 后端 | Express 5，同源 `/api` JSON API | `src/server.mjs` |
| 数据 | Node.js 24 `node:sqlite`，SQLite WAL、外键和预编译语句 | `src/db.mjs`、`src/schema.sql` |
| 供应商 | OpenAI 兼容、Anthropic、Gemini、DeepSeek、智谱、Moonshot、MiniMax、通义、OpenRouter、Ollama、LM Studio、Mock | `src/providers.mjs` |
| 评分 | exact、one_of、contains、all/any_keywords、numeric、regex、json、word_limit、manual | `src/scoring.mjs` |
| 裁判 | 匿名候选、固定 rubric、严格 JSON、服务端重算、多裁判聚合 | `src/judge.mjs`、`judge_verdicts` |
| 发布 | Vite 构建信息、Docker、CI、标签发布工作流 | `vite.config.js`、`Dockerfile`、`.github/workflows/` |
| 测试 | Vitest 单元/API、Playwright Chromium E2E | `tests/`、`playwright.config.js` |

## 3. 已实现能力

- 203 道内置原创草案题目、15 个分类、难度和来源/许可证字段。
- 题库搜索、分类/难度/来源筛选、卡片/列表视图、收藏、题目复制、版本快照和提示词变体。
- 供应商和模型管理、连接测试、模型列表发现、成本参数、AES-256-GCM 密钥存储。
- 单题、分类、随机、极限、稳定性、自定义和外部回答运行；并发池、超时、重试、取消和失败隔离。
- 运行清单冻结题目、模型、参数、权重、评分器、环境和 SHA-256 完整性摘要。
- 确定性规则评分、AI 裁判评分、人工复核；人工评分不被 AI 裁判默认覆盖。
- 报告、排行榜、分类权重、覆盖度、趋势、版本筛选、JSON/CSV 导出。
- 提示词工作台、模型档案、分析页面、研究资料页和移动端布局。
- CI、Docker、Release 资产、版本检测和本地更新提示。

## 4. 本轮第二次审查发现

### 已确认并修复

1. `/api/tasks/export` 位于 `/api/tasks/:id` 之后，Express 会把 `export` 当作题目 ID，导致导出端点返回 404。已把静态路由提前并加入回归测试。
2. 随机挑战使用 `Math.random()`，运行清单无法说明题目顺序。已加入稳定种子和确定性 Fisher–Yates，并写入 manifest。
3. 进程重启后内存中的 `AbortController` 消失，历史会话可能永久停留在 `running`。启动时现在会把遗留会话和运行收敛为 `failed` 并写审计事件。
4. 供应商 kind 任意字符串会落入 OpenAI 兼容分支，URL 仅在真正调用时才校验。现在创建、更新、模型发现和调用都共享类型/协议/常见元数据地址校验。
5. CSV 导出直接写入模型回答、题目标题和报告字段，存在电子表格公式注入风险。导出单元格现在对公式前缀做惰性转义。
6. `one_of` 缺少 `targets` 时没有回退到参考答案；非数组关键词、负容差和无效字数上限可能产生误导性分数。评分器已返回可审计的空分结果。
7. API 缺少跨层请求关联标识；现在每个响应返回 `x-request-id`，错误体包含同一 ID，限流桶也会清理过期来源。
8. 会话和审计接口只有固定上限；现在保留旧数组响应，同时通过 `x-total-count` / `x-has-more` 提供分页信息。
9. 外部数据集导入没有记录原文摘要；现在返回并写入审计详情 SHA-256。
10. 运行中提示和通知缺少明确的可访问状态语义；已补充 `role`、`aria-live` 和图标按钮标签。

### 仍然存在的缺陷与技术债务

- 前端生产 JS 主 chunk 约 927 kB，构建仍有 chunk size warning；页面尚未按路由拆分。
- 内置题目虽然有来源和验证状态，但仍需逐题专家复核，不能当作权威能力基准。
- 真实供应商调用、跨供应商分数可比性、账单成本精度和公网部署没有在本地验证。
- 供应商 URL 仍允许用户自行配置内网地址；当前默认边界是本机单用户，云端部署仍需要 DNS 解析后的私网白名单、认证、TLS、CSRF 和租户隔离。
- 没有持久化任务队列、跨进程恢复、基于 manifest 的自动复跑和回归质量门禁。
- 没有代码执行沙箱；模型生成的代码只作为文本回答保存。
- API 没有账号和权限模型，审计日志只有本地存储。

## 5. 基线验证

本轮修改前后均使用 Node.js `v24.20.0`。当前结果：

| 检查 | 结果 | 说明 |
|---|---|---|
| `npm test -- --reporter=dot` | PASS | 9 个测试文件，57/57 通过（含新增第二轮回归） |
| `npm run build` | 待最终收口后重跑 | 上一基线构建通过，但有约 927 kB JS chunk warning |
| 真实供应商联网调用 | BLOCKED / 未执行 | 工作区没有真实 API Key，不伪造跨供应商结果 |
| 公网渗透测试 | NOT RUN | 当前产品边界是本机单用户 |
| Docker 与 Release | PARTIAL | 仓库已有本地/CI 流程；本轮未创建新 Release |

## 6. 成熟度判断

当前项目适合可信本机用户进行可追溯的模型评测和提示词回归，核心数据流完整，自动化测试覆盖较好。它还不具备公开多租户服务、权威基准发布、代码执行评测或生产级远程安全边界所需的认证、隔离和运维能力。

## 7. 后续顺序

优先实现基于 manifest 的回归比较/质量门禁和路由级代码分割；随后再评估持久化队列、远程认证、私网 URL 策略和代码沙箱。任何新基准数据都必须先完成来源、许可证和逐题验证记录。
