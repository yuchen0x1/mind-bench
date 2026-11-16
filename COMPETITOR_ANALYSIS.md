# MIND BENCH 竞品与相关开源项目对标

研究日期：2026-11-16（第二轮审查）  
范围：AI 评测、提示词回归、可观测性、数据集基准和报告工程。研究目标是比较实现模式，不复制外部题目、数据或代码。

## 研究方法与限制

- 逐项目查看官方 GitHub 仓库入口、README、目录/源码入口和许可证声明；重点仓库沿用既有 `.evolution/research.json` 的源码路径记录。
- 使用公开 Git 传输读取 14 个仓库当前 `HEAD` 引用；`swebench/SWE-bench` 的传输请求在本轮被网络限制阻断。GitHub REST API 在本机触发 403 rate limit，因此没有把未核实的最新 Release、Issue 数量或 PR 状态写成事实。
- 下表的“最近状态”使用已核验的 HEAD 引用或仓库页面可见信息；它不是对项目当前 Release 版本的承诺。复查时应固定 commit/tag，并重新核验数据集许可证。

## 15 个项目对比

| 项目（官方仓库） | 许可证/研究状态 | 源码与实现证据 | 对方优势 | MIND BENCH 现状 | 决策 |
|---|---|---|---|---|---|
| [lm-evaluation-harness](https://github.com/EleutherAI/lm-evaluation-harness) | MIT；HEAD `d6de816` | `lm_eval/api/task.py`、`lm_eval/api/metrics.py`、`lm_eval/models/` | 任务注册、模型后端、指标聚合边界清晰 | 题目/供应商/评分已分层，但任务配置不是外部 YAML registry | 借鉴任务版本和 runner 快照；不复制数据 |
| [HELM](https://github.com/stanford-crfm/helm) | Apache-2.0；HEAD `63754d0` | `src/helm/benchmark/` 的 scenario、adapter、metric、run spec | 多指标、场景与报告可审计 | 有 manifest、分类权重和报告，但没有 scenario 插件协议 | 借鉴 scenario/metric 分离与结果边界 |
| [OpenCompass](https://github.com/open-compass/OpenCompass) | 以仓库声明为准；HEAD `8b4193f` | `opencompass/` 的 datasets、models、evaluators、summarizers | 中文/多模型批量评测与汇总覆盖广 | 供应商数量较少，批量任务上限 300 | 借鉴数据集/模型/评测器分层，保持本地单机范围 |
| [FastChat / Chatbot Arena](https://github.com/lm-sys/FastChat) | Apache-2.0；HEAD `587d5cf` | `fastchat/llm_judge/`、arena 服务和匿名投票流 | 匿名对比、用户偏好和竞技场体验 | 当前是规则分/AI 裁判，不含多人投票或在线竞技场 | 借鉴匿名候选和人工复核，不引入远程社区服务 |
| [OpenAI Evals](https://github.com/openai/evals) | 以 `LICENSE.md` 和仓库声明为准；HEAD `8eac7a7` | `evals/registry`、`evals/elsuite`、solver/grader | 评测定义和执行器可扩展 | 已有题目版本、评分器和裁判，但没有 registry 插件加载 | 借鉴 eval 定义/实现分离 |
| [promptfoo](https://github.com/promptfoo/promptfoo) | MIT；HEAD `f12d114` | `src/providers/`、`src/assertions/`、`src/evaluator/`、`src/testCase/` | Prompt/Agent/RAG 回归、断言、CI 质量门禁 | 已有多模型运行和对比，没有自动基线门禁 | P1：设计 manifest 对齐的回归阈值 |
| [LightEval](https://github.com/huggingface/lighteval) | MIT；HEAD `b97a653` | `src/lighteval/` 的 pipeline、tasks、metrics | 多后端与指标模块化 | provider 适配器已有，指标类型仍集中在评分模块 | 借鉴 pipeline、日志和 backend 抽象 |
| [BIG-bench](https://github.com/google/BIG-bench) | Apache-2.0；仓库标记为 archived | `bigbench/benchmark_tasks/`、`task_metrics.py` | 任务规范统一，简单 JSON 与复杂 Python 任务并存 | 内置题库是自有草案，外部数据通过带许可证导入 | 借鉴任务规范；不复制题目 |
| [DeepEval](https://github.com/confident-ai/deepeval) | 以仓库声明为准；HEAD `c0bd9c8` | `deepeval/metrics/`、测试用例和模型回归接口 | LLM-as-a-judge 指标、测试案例和断言生态 | 有 AI 裁判但 rubric 维度固定在题目快照 | 借鉴指标可解释性和测试案例组织 |
| [Langfuse](https://github.com/langfuse/langfuse) | MIT；HEAD `cafb5c0` | Web/服务端 trace、prompt、dataset、score 数据模型 | 追踪、成本、版本和 prompt 管理完整 | 已保存响应、Token、成本和 manifest，但没有 trace/span | 评估轻量 trace，不直接引入其服务依赖 |
| [Phoenix](https://github.com/Arize-ai/phoenix) | 以仓库声明为准；HEAD `40f9a38` | tracing/evals/experiments 目录 | OpenTelemetry 观测、实验和错误分析 | 只有本地审计与运行报告，没有 OTEL 导出 | 借鉴 trace 字段与 p95 指标 |
| [Ragas](https://github.com/explodinggradients/ragas) | Apache-2.0；HEAD `8c63f10` | metrics、evaluation dataset 和 judge 组合 | RAG 多维度指标与样本级解释 | MIND BENCH 面向通用题目，暂无 context/retrieval 字段 | 若扩展 RAG 题型再引入 metric adapter |
| [SWE-bench](https://github.com/swebench/SWE-bench) | 以仓库声明为准；HEAD 传输本轮 BLOCKED | 任务实例、补丁验证和测试执行器（需按仓库当前代码复核） | 把答案验证落到真实测试执行 | 当前没有代码沙箱，代码题仅评估文本 | 仅作为未来安全沙箱和 patch 验证参考 |
| [EvalPlus](https://github.com/evalplus/evalplus) | MIT；HEAD `26d6d00` | 代码题增强测试集和严格执行验证 | 通过更强测试发现“看似正确”实现 | 当前无代码执行，无法获得同等证据强度 | 不在本轮引入，列为高风险后续 |
| [MLflow](https://github.com/mlflow/mlflow) | Apache-2.0；HEAD `1303a62` | tracking、runs、artifacts、evaluation API | 实验、制品和模型版本生命周期完整 | SQLite 报告和导出已覆盖单机需求，但无 artifact store | 借鉴 run/artifact 命名和比较视图，不引入服务端依赖 |

## 关键差距结论

### 对方普遍更强的地方

1. **可扩展任务 registry**：lm-evaluation-harness、OpenAI Evals、LightEval 和 OpenCompass 允许新增任务/指标而不修改核心 runner。
2. **回归门禁**：promptfoo、DeepEval、MLflow 等把基线、阈值和 CI 结果作为一等公民；MIND BENCH 目前只有版本筛选和手动对比。
3. **观测与实验追踪**：Langfuse、Phoenix、MLflow 能跨运行聚合 trace、成本、错误和制品；MIND BENCH 仍以单机 SQLite 报告为主。
4. **代码/环境验证**：SWE-bench、EvalPlus 把结果交给测试执行器验证；MIND BENCH 明确没有代码沙箱。
5. **社区规模和数据广度**：OpenCompass、HELM、BIG-bench 等覆盖更多数据集和模型，但也带来许可证、版本和可比性成本。

### MIND BENCH 当前相对优势

- 本地部署和 SQLite 数据 ownership 清晰，默认不把回答上传到第三方服务。
- 对 Mock、外部粘贴回答、失败、未评分和人工复核有显式隔离，榜单不会把缺测当 0。
- Run Manifest 冻结题目全文、参考答案、模型参数、权重和评分协议，且有 SHA-256 完整性摘要。
- 供应商密钥不通过 API 返回；报告保留原始回答和请求元数据，便于人工追溯。
- 中文题库、提示词工作台、模型发现、移动端界面和研究说明更贴近本地中文用户。

## 采纳与不采纳

| 方向 | 处理 |
|---|---|
| registry / task schema | 采纳设计原则，下一阶段新增 manifest 兼容的可扩展任务定义；本轮不改变现有数据库契约 |
| baseline regression gate | 采纳为 P1；需要先定义基线、分数差、延迟/成本阈值和失败策略 |
| trace / OpenTelemetry | 采纳字段设计，暂不引入 Langfuse/Phoenix 运行时依赖 |
| 代码执行沙箱 | 暂不采纳；需要单独的进程隔离、资源限制、审计和用户授权设计 |
| 外部题库/数据集 | 只提供带许可证字段的导入；不直接复制题目和答案 |
| GPL/AGPL 或声明不清的代码 | 不直接移植；保留链接和研究结论，先做许可证复核 |

## 可追溯来源

既有源码入口和许可证复核记录保存在 `docs/OPEN_SOURCE_RESEARCH.md` 与 `.evolution/research.json`。本轮本地代码改动对应 `UPGRADE_ROADMAP.md` 的 EV-021 至 EV-029，并在 `UPGRADE_REPORT.md` 列出验证命令和未完成原因。
