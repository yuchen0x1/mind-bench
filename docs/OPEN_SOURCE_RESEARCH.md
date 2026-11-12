# 开源研究与评测项目实现笔记

研究基于各项目官方 GitHub 仓库、源码目录、README、许可证文本及可访问的官方文档。项目分支/Release 会更新，复现时应固定 commit/tag。**本项目没有复制以下任何 benchmark 题目、提示词或数据集。**代码许可不代表仓库所含第三方数据具有相同许可。

| 项目 | 仓库代码许可证/状态（检查时） | 评测任务与评分实现 | 多模型接口与可复现借鉴 |
|---|---|---|---|
| [EleutherAI/lm-evaluation-harness](https://github.com/EleutherAI/lm-evaluation-harness) | MIT；最新 Release API 曾返回 v0.4.13。 | `lm_eval/tasks/` 使用 YAML/任务工厂注册任务，`lm_eval/api/task.py` 定义 Task；`lm_eval/api/metrics.py` 提供指标和聚合。 | `lm_eval/api/model.py` 抽象 likelihood/generation；`lm_eval/models/` 有多个后端。借鉴任务定义、请求适配与 metric 解耦，记录 task/prompt/seed/backend。许可证与数据集许可分别审查。 |
| [OpenAI/Evals](https://github.com/openai/evals) | `LICENSE.md` 标题写 MIT；GitHub API license 元数据识别曾显示 Other/NOASSERTION，须以文件文本和法律意见为准。未确认有 GitHub latest release。 | `evals/base.py`、`evals/eval.py`、`evals/registry.py`、`evals/elsuite/`；JSON/YAML eval、solver、grader，支持 model-graded eval；README 说明 registry data 使用 Git LFS。 | `completion_fns/` 可扩展模型 completion；借鉴 registry 与 solver/grader 分离。冻结 eval 配置、数据 revision、模型与裁判版本；远程输出仍可能变化。 |
| [promptfoo](https://github.com/promptfoo/promptfoo) | MIT；源码仓库近期 release 版本需按实际 tag 固定。 | `src/providers/`、`src/assertions/`、`src/evaluator/`、`src/testCase/` 分别负责 provider、断言、运行和测试用例；面向 prompt/agent/RAG 回归。 | 借鉴声明式 provider/test/assertions、对照测试与 CI；固定配置、provider、模型/生成参数。它更偏应用回归，不应误解成统一数据集排行榜。 |
| [Stanford HELM](https://github.com/stanford-crfm/helm) | Apache-2.0；Release 与分支以官方仓库为准。 | `src/helm/benchmark/` 中 scenarios、adaptation、model_deployments、metrics 和 run specs 分层。 | 借鉴 scenario、model adapter、metric、run spec 解耦及可追溯报告；固定场景版本、模型部署、指标实现。 |
| [Hugging Face LightEval](https://github.com/huggingface/lighteval) | MIT；release API 在研究时返回 v0.13.0（2025-11-24）；确认信息可能过期。 | `src/` 组织任务、指标和评测 pipeline；自定义任务文档定义数据准备、后处理、指标。任务具有不同指标，不存在通用公式。 | README 列 Transformers、vLLM、SGLang、Accelerate、API endpoint 等路径；借鉴 task/metric/backend 模块化。数据许可需逐数据集核验。 |
| [Google BIG-bench](https://github.com/google/BIG-bench) | Apache-2.0；仓库 API 曾标记 archived；未核实 latest release。 | `bigbench/benchmark_tasks/` 有 JSON 配置与 Python `task.py`；`json_task.py`、`task_metrics.py` 暴露任务级 metrics/ScoreData。 | `model.generate_text()` 和 `cond_log_prob()` 抽象能力可借鉴；简单任务 JSON，复杂任务 Python，任务级测试与指标。README 有 BIG-bench Lite。题目数据条款需逐项核验。 |
| [ARC-AGI tooling](https://github.com/arcprize/ARC-AGI) / [ARC-AGI-2 data](https://github.com/arcprize/ARC-AGI-2) | tooling 仓库 MIT；ARC-AGI-2 独立数据仓库标注 Apache-2.0。公开规则、数据条款须按具体仓库/竞赛条款核验。 | ARC-AGI 工具仓库重点是交互环境/渲染/记录/scorecard，不等于静态 ARC 数据集。其 scorecard 对关卡动作效率使用平方反比形式，并聚合关卡。 | `Arcade.make()`、`env.step(GameAction)` 是 agent/environment 接口，不是通用聊天 completion。借鉴轨迹记录与显式规则；环境和数据版本必须区分。 |
| [aglio-lab/ai-evaluation-tools](https://github.com/aglio-lab/ai-evaluation-tools) | 目录仓库 CC0-1.0；release 快照可用于标识版本。 | 这是工具目录/链接索引，不是统一评测执行器、题库或评分框架；`data/tools.csv/json` 可机器读取。 | 无统一模型 API 或评分指标。可借鉴分类目录与可版本化资源列表；CC0 不会改变索引到的第三方工具/数据许可。 |

## 转化为 MIND BENCH 实现

- 用关系型 SQLite 存储 category、task、source、task version、provider/model、session/run/response/evaluation，schema 在 `src/schema.sql`。
- 模型接口在 `src/providers.mjs`，当前实现 OpenAI-compatible、Anthropic Messages、Gemini generateContent 和显式 Mock。
- 评分器 `src/scoring.mjs` 区分明确的确定性规则与 manual；AI 裁判在 `src/judge.mjs` 中实现（匿名化 + 固定 rubric + 严格 JSON + 服务端重算 + 多裁判聚合），产出写入 `judge_verdicts` 表并在报告中与规则分、人工分严格区分。参考了 HELM 的 metric 分层与 OpenAI Evals 的 solver/grader 分离思路，但实现独立。
- 用关系型 SQLite 存储 category、task、source、task version、provider/model、session/run/response/evaluation/verdict，schema 在 `src/schema.sql`（19 张表）。
- 模型接口在 `src/providers.mjs`，实现 OpenAI-compatible、Anthropic Messages、Gemini generateContent、Ollama、LM Studio 和显式 Mock，并支持从供应商端点发现模型列表。
- 排行榜按分类权重加权（借鉴 HELM 的 run spec 可追溯思路），暴露覆盖度与权重快照，缺测分类不按 0 计。
- run 保存题目版本、模型声明版本、参数、耗时、Token、费用、原文、结果；并发限制与失败隔离。
- 原创题标为 draft/review-required；外部 benchmark 不直接内置，提供带来源/许可字段的用户导入。
- 榜单过滤 Mock/失败/未完成并设最小有效样本门槛；分数标为 MIND BENCH SCORE，不是 IQ。

## 研究限制

此研究在 2026-11-11 附近进行；外部 GitHub API/Search 有限流/超时，部分 Release/每任务数据许可无法逐条确认。表中 release/status 以项目页面和 API 可访问结果为准，不应作为当前最新版本承诺。正式扩展外部数据前，需重新审查上游 license、commit、数据文件许可及竞赛条款。
