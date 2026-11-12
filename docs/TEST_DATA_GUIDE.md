# 题库扩展与审核指南

## 当前状态

内置 **203 道**自主设计题，15 个分类各 13—14 题。来源标记 `source-original-v1`（MIND BENCH 原创），**不是**外部权威基准。全部题目应由人工逐题核验。

验证状态分布：178 题 `review_required`（待复核）、25 题 `draft`（草案，对应 `manual` 评分规则）。目前尚无 `verified` 题目——这是诚实标注，不是遗漏。

题库以任务 ID + `version` 标识，每次修改自动在 `benchmark_task_versions` 追加快照。

---

## 题目字段（20 个）

| 分组 | 字段 | 说明 |
|---|---|---|
| 标识 | `id` | 稳定唯一 ID，如 `logic-01` |
| | `title` | 简短标题 |
| | `categoryId` | 15 个一级分类之一 |
| | `subcategory` | 二级分类 |
| | `difficulty` | `easy` / `medium` / `hard` / `expert` |
| 提示词 | `promptZh` | 中文提示词（必填） |
| | `promptEn` | 英文提示词 |
| 来源 | `source_id` | 来源记录（含名称、URL、许可证） |
| | `sourceType` | `A`/`B`/`C`/`D`/`E` 分级 |
| | `license` | 许可证标识 |
| 评测 | `objective` | 测什么、观测点是什么 |
| | `reference_answer` | 参考答案（详情页默认折叠） |
| | `scoring_rule` | JSON，评分方法与参数 |
| | `scoring_dimensions` | JSON 数组，维度名与权重 |
| | `common_errors` | 常见错误，供裁判参考 |
| | `notes` | 注意事项与判定前提 |
| 治理 | `version` | 版本号，每次修改递增 |
| | `verification_status` | `draft` / `review_required` / `imported` / `verified` / `user` |
| | `is_public` | 是否在公开题库展示 |
| | `created_at` / `updated_at` | 时间戳 |
| 溯源 | `derived_from` | 复制/派生来源题目 ID |

---

## 来源分级

| 标签 | 含义 | 可再分发 |
|---|---|---|
| `A` | MIND BENCH 原创 | 是 |
| `B` | 开源社区题目 | 按原仓库许可证，逐题核实 |
| `C` | 为本平台定制的题型 | 是 |
| `D` | AI 辅助生成 + 人工验证 | 需验证记录 |
| `E` | 用户自建/导入 | 由导入者确认 |

**不要把 AI 生成后未经人工验证的题标成 `D`。** 未经核验的题只能用 `draft` 或 `review_required`。

---

## 新题审核步骤

1. **确认来源与授权**——题目从哪来、能否再分发、是否需要署名。
2. **准确标注来源类型**——不把 AI 草案写成人工验证。
3. **多人独立求解**——检查歧义、边界情况、文化/语言偏差，以及是否存在多个等价正确答案。
4. **正反测试评分器**——用代表性回答验证：
   - 完全正确的回答 → 得满分
   - 明显错误的回答 → 得低分
   - 语义等价但用词不同的回答 → 不应被误判为错
   - 含否定语境的回答（"甲不是假的"）→ 关键词规则是否误判？
5. **规则不够精确就改人工**——开放题不要硬套关键词规则，避免伪造自动正确率。
6. **记录变更**——修改说明、版本号、验证人、审核时间。

通过后把 `verification_status` 改为 `verified`。

---

## 评分规则编写规范

```json
{ "method": "all_keywords", "keywords": ["甲假", "乙真"] }
```

| method | 必需参数 | 注意 |
|---|---|---|
| `exact` | `answer` 或 `keywords[0]` | 归一化后比较；适合唯一答案 |
| `one_of` | `keywords[]` | 可枚举的同义答案 |
| `contains` | `keywords[]` | 任一片段命中即通过，宽松 |
| `all_keywords` | `keywords[]` | 全部命中才通过，需在 `notes` 说明判定前提 |
| `any_keywords` | `keywords[]` | 多解法任选其一 |
| `numeric` | `value`, `tolerance` | 容差必须显式写出 |
| `regex` | `pattern` | 注意锚点与多行 |
| `json` | `required[]`, `values?` | 结构校验，不校验语义 |
| `word_limit` | `max` | 字数上限 |
| `manual` | — | 需人工或 AI 裁判 |

**反例警示**：某题要求回答"甲是假的"，规则为 `all_keywords:["甲","假"]`。模型回答"甲不是假的"同样命中两个词，但语义完全相反。这类题必须改用 `exact` 或加否定词排除，或转 `manual`。

---

## 变体（Variant）

同一考点的不同问法，用于检测模型是否只是记住了表面措辞。在工作台右栏或 `POST /api/tasks/:id/variants` 创建。

变体不改变评分规则，因此新变体的措辞必须仍能被原规则正确判定——否则说明该规则耦合了措辞，应重新设计。

---

## 修改种子数据

改 `src/seed-data.mjs` / `src/supplemental-data.mjs` 后：

```bash
npm test        # 种子数据完整性测试会校验 ID 唯一性、分类有效性、字段完备
npm run build
```

程序对既有数据库使用 `INSERT OR IGNORE` 初始化，**不会覆盖**已存在的用户题目或旧题。升级已有条目需要写迁移脚本，**严禁直接删除用户数据库**。

轻量加列迁移在 `src/db.mjs` 的 `ensureColumn()` 中实现，幂等安全。

---

## 从外部数据集导入

「题库导入」→ 外部数据集适配，或 `POST /api/tasks/import-dataset`：

```json
{
  "format": "jsonl",
  "content": "{\"question\":\"...\",\"answer\":\"...\"}\n...",
  "license": "CC-BY-4.0",
  "mapping": { "question": "promptZh", "answer": "referenceAnswer" }
}
```

- **`license` 必填**，缺失直接 400。这是硬性门槛，防止无授权数据流入。
- 支持字段别名：`question`/`prompt`/`input` → `promptZh`；`answer`/`output`/`target` → `referenceAnswer`；`category`/`subject` → `categoryId`。
- CSV 支持引号转义与内含逗号。
- 单批最多 1000 条。
- 导入题 `verification_status='imported'`，仍需逐题复核后才可用于正式评测。
- 返回 `{ imported, skipped, errors:[{line,error}], warnings }`。

**不要**把不可再分发的数据集导入后提交到公开仓库。工具仓库的代码许可证不能推断数据许可证。
