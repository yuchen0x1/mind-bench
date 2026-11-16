# MIND BENCH 升级路线图

制定日期：2026-11-16  
说明：EV-001 至 EV-020 来自既有 `.evolution/feature_gap.json` 与上一轮交付；EV-021 之后是本轮第二次审查及后续真实计划。状态只代表代码证据，不代表已经发布或完成真实供应商验证。

## 已有升级项（上一轮已交付）

| 编号 | 升级项 | 分类 | 优先级 | 依据/参考 | 验收标准 | 状态 |
|---|---|---|---|---|---|---|
| EV-001 | 密钥 AES-256-GCM 加密与 API 脱敏 | 安全 | P0 | 本地密钥边界 | API 和日志不出现明文 Key | 已完成 |
| EV-002 | Mock 与外部回答榜单隔离 | 核心评测 | P0 | promptfoo/HELM 的实验边界 | Mock/external 不进入真实榜单 | 已完成 |
| EV-003 | 多供应商、多模型统一适配 | 核心评测 | P1 | lm-evaluation-harness/LightEval | provider 统一调用、失败隔离 | 已完成 |
| EV-004 | 确定性规则评分 | 核心评测 | P1 | OpenAI Evals/HELM | 规则可复现，异常不伪造分数 | 已完成 |
| EV-005 | AI 裁判严格 JSON 与服务端重算 | 核心评测 | P1 | HELM/DeepEval | 无效裁判返回 422，不覆盖人工分 | 已完成 |
| EV-006 | 人工复核优先 | 核心评测 | P1 | 质量审核流程 | AI 裁判默认不覆盖人工分 | 已完成 |
| EV-007 | 题目版本与来源/许可证记录 | 数据治理 | P1 | BIG-bench/OpenCompass | 题目版本和来源可追溯 | 已完成 |
| EV-008 | JSON/JSONL/CSV 导入与导出 | 数据治理 | P2 | OpenCompass 数据集适配 | 许可证必填，坏行单独报告 | 已完成 |
| EV-009 | 模型列表发现 | 核心功能 | P2 | provider 生态实践 | 能读取供应商公开模型清单 | 已完成 |
| EV-010 | 并发、超时、重试和取消 | 稳定性 | P1 | promptfoo runner | 单模型失败不影响其他运行 | 已完成 |
| EV-011 | 可复现 Run Manifest 1.1.0 | 可信度 | P1 | HELM/lm-eval/OpenAI Evals | 冻结题目、模型、评分、环境并带 SHA-256 | 已完成 |
| EV-012 | 报告 JSON/CSV 与清单导出 | 工程化 | P2 | MLflow/HELM | 报告可独立归档 | 已完成 |
| EV-013 | 分类加权、覆盖度和 provisional 榜 | 核心功能 | P1 | HELM 多指标 | 缺测不按 0，样本阈值显式 | 已完成 |
| EV-014 | 提示词工作台与变体 | UX | P2 | promptfoo | 副本/变体/版本可编辑 | 已完成 |
| EV-015 | 移动端响应式界面 | UX | P2 | 评测 dashboard 对照 | 390px E2E 可操作 | 已完成 |
| EV-016 | CI、Docker 与 Release 资产 | 工程化 | P2 | MLflow/开源项目发布实践 | 构建、健康检查和资产审计可运行 | 已完成 |
| EV-017 | Web 版本检测与刷新提示 | 工程化 | P3 | 本地 Web 更新流程 | `/api/version` 与 build-info 一致 | 已完成 |
| EV-018 | 安全头、Host/Origin/Fetch Metadata 检查 | 安全 | P0 | 本地服务安全基线 | 跨站写入和异常 Host 被拒绝 | 已完成 |
| EV-019 | 真实回答原文保存与不展示隐藏思维链 | 可信度 | P1 | 评测可追溯原则 | 原文不改写，隐藏推理不臆测 | 已完成 |
| EV-020 | 既有数据迁移与回归测试 | 稳定性 | P0 | SQLite additive migration | 旧数据可读，回归测试通过 | 已完成 |

## 本轮已实施

| 编号 | 升级项 | 分类 | 优先级 | 当前问题与证据 | 实施内容 | 验收标准 | 状态 |
|---|---|---|---|---|---|---|---|
| EV-021 | 随机挑战确定性种子 | 可信度 | P1 | 原来使用 `Math.random()`，manifest 无法重现顺序 | 新增 `src/reproducibility.mjs`，支持 seed、确定性 Fisher–Yates，写入 session settings/manifest | 相同 seed 得到相同题目顺序，API 返回 seed | 已完成 |
| EV-022 | 进程重启会话恢复 | 稳定性 | P1 | 内存 AbortController 丢失会留下 `running` | 启动时将遗留会话/运行标记为 failed 并写 audit | 重启后历史无永久 running | 已完成 |
| EV-023 | 供应商类型白名单 | 安全/稳定性 | P0 | 任意 kind 会落入兼容分支 | 统一 `PROVIDER_KINDS` 校验 | 非支持 kind 返回 400 | 已完成 |
| EV-024 | 供应商 URL 边界校验 | 安全 | P0 | 出站请求存在 SSRF 风险 | 拒绝非 HTTP(S)、凭据、0.0.0.0 与常见云元数据地址 | 保存、发现、调用都拒绝非法 URL | 已完成 |
| EV-025 | API 请求关联 ID | 运维 | P2 | 错误无法和本地日志关联 | `x-request-id` 响应头与错误体 requestId | 健康检查和错误响应可关联 | 已完成 |
| EV-026 | CSV 公式注入防护 | 安全/数据导出 | P1 | 模型文本/标题可能以 `=+-@` 开头 | 统一 csvCell 惰性转义 | CSV 中公式前缀不直接执行 | 已完成 |
| EV-027 | 导出静态路由优先级修复 | 稳定性 | P0 | `/api/tasks/export` 被 `/:id` 截获 | 把 export 路由提前并加入回归测试 | JSON/CSV 导出返回 200 | 已完成 |
| EV-028 | 评分规则边界校验 | 可信度 | P1 | 缺 targets、非数组关键词、负容差会产生误导 | 无效配置返回 null 分和明确理由；one_of 回退 expected | 错误规则不丢失原始回答、不生成伪分 | 已完成 |
| EV-029 | 历史/审计分页元信息 | 性能/UX | P2 | 固定 100 条无法继续浏览 | offset、x-total-count、x-has-more | 可增量加载，不破坏旧数组响应 | 已完成 |
| EV-030 | 外部数据集原文哈希 | 数据治理 | P2 | 导入只有来源名和许可证，没有输入摘要 | 计算并返回/审计 SHA-256 | 相同原文可识别，hash 不含密钥 | 已完成 |
| EV-031 | 状态通知可访问性 | UX | P2 | 运行和 toast 无明确读屏语义 | 添加 role、aria-live、按钮标签 | Chromium/静态检查可识别状态 | 已完成 |

## 待实施的高价值升级

| 编号 | 升级项 | 分类 | 优先级 | 竞品参考 | 实施边界与验收标准 |
|---|---|---|---|---|---|
| EV-032 | 基于 Manifest 的回归基线 | 核心功能 | P1 | promptfoo、OpenAI Evals | 选择基线/候选会话，仅同题目/模型/评分协议可比，输出 per-task diff |
| EV-033 | 回归质量门禁 | 自动化 | P1 | promptfoo CI | 配置分数下降、失败率、延迟、成本阈值，返回 pass/warn/fail |
| EV-034 | 运行复跑入口 | 核心功能 | P1 | HELM run spec、MLflow | 从 manifest 复制配置创建新会话，明确旧/新版本关系 |
| EV-035 | 版本/清单差异视图 | UX | P2 | HELM/MLflow | 显示题目、模型参数、权重、评分器变更 |
| EV-036 | 路由级代码分割 | 性能 | P2 | Vite/React 生态 | 首屏 JS 降至 500 kB gzip 前的可解释预算，E2E 不回归 |
| EV-037 | 分页题库加载 | 性能 | P2 | OpenCompass/LightEval | 大题库按 limit/offset 加载，搜索/筛选结果一致 |
| EV-038 | 任务执行持久化队列 | 稳定性 | P1 | promptfoo runner/MLflow | 跨进程恢复排队项，幂等执行，资源上限明确 |
| EV-039 | p95 延迟与失败原因统计 | 观测 | P2 | Phoenix/Langfuse | 报告和分析暴露 p50/p95、HTTP/timeout/cancel 分类 |
| EV-040 | trace/span 轻量导出 | 观测 | P3 | OpenTelemetry/Phoenix | 不引入服务依赖，提供 JSONL trace 导出 |
| EV-041 | 任务 registry 插件边界 | 架构 | P2 | lm-eval/OpenAI Evals/LightEval | 允许新增评分器/任务 schema，版本和许可证可审计 |
| EV-042 | provider 能力声明 | 架构 | P2 | OpenCompass/LightEval | 对 chat/completion/vision/tool 等能力做显式兼容检查 |
| EV-043 | 请求级网络策略 | 安全 | P0 | SSRF 防护实践 | DNS 解析后阻断 loopback/link-local/private（可配置本机 Ollama 例外） |
| EV-044 | 本地备份/恢复向导 | 数据治理 | P1 | MLflow artifacts | 原子备份 SQLite + `.key`，恢复前校验 hash，禁止覆盖未备份数据 |
| EV-045 | 数据保留与脱敏策略 | 安全 | P1 | Langfuse/企业评测工具 | 可按会话清理原文，明确保留审计和密钥不出库 |
| EV-046 | 多裁判并发控制 | 稳定性 | P2 | DeepEval/Ragas | 批量裁判受全局并发池限制，失败可重试且不重复覆盖人工分 |
| EV-047 | 题库逐题质量标注 | 数据治理 | P1 | BIG-bench/OpenCompass | 支持 reviewer、evidence、争议状态和修订记录 |
| EV-048 | 参考答案多解校验 | 可信度 | P1 | lm-eval metrics | 对 numeric/one_of/关键词规则提供人工抽样和误报报告 |
| EV-049 | 成本预算与硬上限 | 稳定性 | P2 | Langfuse/MLflow | 单会话成本预估、达到阈值前阻断或要求用户确认 |
| EV-050 | 供应商响应 schema 适配测试矩阵 | 测试 | P1 | LightEval/provider adapter | 各 provider success/error/usage/empty body fixture 覆盖 |
| EV-051 | 真实 API 密钥验证流程 | 工程化 | P2 | provider management | 用户主动触发，结果只保存状态/延迟，绝不记录密钥或完整请求 |
| EV-052 | 报告打印/静态归档 | UX | P3 | HELM/MLflow reports | 无需服务端即可查看脱敏 JSON/HTML 快照 |
| EV-053 | 国际化文案边界 | UX | P3 | 评测 dashboard | 中英文任务元数据显示一致，错误信息可定位 |
| EV-054 | 安全依赖与 SBOM 周期审计 | 安全/工程化 | P1 | 开源 release practices | CI 固定 npm audit/SBOM 检查，失败不掩盖 |
| EV-055 | 真实压力/长时运行基准 | 性能 | P2 | runner 项目 | 固定题目/Mock provider 测量吞吐、内存、取消响应时间 |
| EV-056 | 公网部署认证与租户隔离设计 | 架构/安全 | P0 | Langfuse/MLflow server | 只有在产品范围确认后实施；需要 session ownership、CSRF、TLS、审计 |
| EV-057 | 代码题安全沙箱 | 核心功能/安全 | P3 | SWE-bench/EvalPlus | 独立进程/容器、无网络、资源限制、超时、审计；未完成前不执行代码 |

## 优先级执行顺序

1. **P0/P1**：EV-032、033、034、038、043、044、045、047、048、050、054。
2. **P2**：EV-035、036、037、039、041、042、046、049、051、055。
3. **P3/P4**：EV-040、052、053、056、057；其中 EV-056/057 需要额外安全设计与明确部署授权。

总升级计划：57 项（EV-001—EV-057）。本轮实际实施：11 项（EV-021—EV-031）。
