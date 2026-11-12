# 提示词数据来源与授权指南

## 项目自带题库

当前初始题库由 `src/seed-data.mjs` 与 `src/supplemental-data.mjs` 自主编写，来源数据库登记为 `source-original-v1`（MIND BENCH 原创，来源分级 A）。它们标注"草案/待人工复核"，不属于任何列出的外部基准，也不应被当作权威测验。

> 注意：仓库根目录**尚未添加 `LICENSE`**，因此原创题库的再分发许可尚未正式声明。正式公开前应由权利人确定并写入许可证；此前请勿假定其为 CC0 或任何特定协议。

## 外部项目/数据集

下列仓库的代码许可证不等于其所有任务、数据、提示词或第三方引用都具有相同许可。当前没有复制或内置这些项目的题目/数据：

- lm-evaluation-harness：<https://github.com/EleutherAI/lm-evaluation-harness>
- OpenAI Evals：<https://github.com/openai/evals>
- promptfoo：<https://github.com/promptfoo/promptfoo>
- HELM：<https://github.com/stanford-crfm/helm>
- LightEval：<https://github.com/huggingface/lighteval>
- BIG-bench：<https://github.com/google/BIG-bench>
- ARC-AGI：<https://github.com/arcprize/ARC-AGI>
- AI Evaluation Tools：<https://github.com/aglio-lab/ai-evaluation-tools>

使用公开基准前逐项确认：数据所在仓库/具体目录；数据集 license/竞赛规则；署名、NOTICE、修改标示、非商业或用途限制；是否允许二次分发；数据版本/commit；是否需保留 canary 或隐藏测试集。仓库代码 license 不能覆盖作者引用的数据。

## 用户导入

通过题库导入页或 `POST /api/tasks/import` 导入 JSON。每项包含 `sourceType` (`A/B/C/D/E`)、`sourceName`、`sourceUrl`、`license`、`sourceNotes`。未知许可填写"未知/待核实"，仅供本地使用并避免公开导出。导入数据由用户负责合法性与准确性，系统不为来源背书。

### 外部数据集适配器（JSONL / CSV）

`POST /api/tasks/import-dataset` 用于把外部数据集转换为 MIND BENCH 题目：

```json
{
  "format": "jsonl",
  "content": "{\"question\":\"...\",\"answer\":\"...\"}",
  "license": "CC-BY-4.0",
  "mapping": { "question": "promptZh", "answer": "referenceAnswer" }
}
```

设计要点：

- **`license` 为必填字段**，缺失直接返回 400。这是刻意的强制门槛——防止无授权数据在无记录的情况下流入题库。
- 许可证原样写入 `benchmark_sources`，导出时一并带出，便于追溯。
- 支持字段别名映射：`question`/`prompt`/`input` → `promptZh`；`answer`/`output`/`target` → `referenceAnswer`；`category`/`subject` → `categoryId`。
- CSV 解析器支持引号转义与字段内含逗号，不使用第三方 CSV 库。
- 导入题 `verification_status='imported'`，需逐题复核后才能用于正式评测。
- 单批最多 1000 条，逐条错误（含行号）随结果返回，部分成功不影响其他条目。

**系统不校验证书真伪**，只强制要求填写并完整记录。许可真实性的判断责任在导入者。

## 外部官方下载与适配器

对不允许随软件再分发的数据，建议增加官方 downloader/adapter：用户在官方条款允许的情况下自行下载，程序只读取用户指定路径；避免把第三方题目打包进安装包、仓库、截图或测试 fixture。对授权开放数据，应保留来源、版本、许可证、归因和必要的修改说明。
