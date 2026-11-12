# MIND BENCH 项目进化交付报告

日期：2026-11-12  
范围：`C:\Users\lenmo\Desktop\模型智商提示词` 单项目模式  
Git：当前目录不是 Git 仓库，因此没有分支、提交或远程地址可供报告。

## 1. 项目原始情况

MIND BENCH 是 React/Vite + Express + SQLite 的本地 AI 模型评测工作台，现有 203 道题、15 个能力分类、多供应商/多模型调用、确定性评分、AI 裁判、人工复核、排行榜、报告、分析、导入导出与响应式界面。项目定位是可审计的本地评测工具，不测量人类 IQ；真实供应商 Key 未配置时不能声称完成真实跨模型比较。

## 2. 开源研究

- 第一轮候选：15 个项目，见 `research.json`。
- 筛选参考：8 个项目。
- 深度研究：5 个项目（promptfoo、OpenAI Evals、lm-evaluation-harness、HELM、lighteval），读取了源码目录/关键实现入口，并将结论映射到本项目。
- 研究重点：任务与版本定义、provider 抽象、缓存/重试/取消、pipeline、metrics、trace、报告和运行审计。
- 研究边界：未复制外部题目或代码；许可证对未明确项目标记为“需以仓库声明为准”。

## 3. 功能差距与实际移植

本轮选择 P2 高价值缺口：可复现评测运行清单（Run Manifest）。每个测试会话启动时冻结：

- 题目 ID、题目版本、分类、评分规则和维度；
- 供应商、模型 ID/版本、温度、Token 上限、超时、重试；
- 权重快照、客观评分器版本、AI 裁判协议版本；
- Node.js、平台、架构、时区、并发上限及 Mock/external 标记；
- SHA-256 完整性摘要。

实现结果：`test_sessions.run_manifest` 持久化；新增 `GET /api/sessions/:id/manifest`；报告 JSON 内嵌清单；报告页展示摘要并支持“导出清单”。旧数据库通过 `ensureColumn()` 轻量迁移兼容，不覆盖历史记录。

## 4. UI、架构与安全改进

- 报告页新增可复现性面板，显示题目/模型/权重/环境快照、评分器和哈希前缀。
- 后端把清单构建集中在会话创建路径，避免前端拼接可信元数据。
- 清单不保存 API Key 明文；保留现有 AES-256-GCM、CSP、限流、参数绑定和 Mock/external 隔离。
- README、API 参考、架构说明、CHANGELOG 同步更新。

## 5. 修改文件

`src/schema.sql`、`src/db.mjs`、`src/server.mjs`、`src/App.jsx`、`src/styles.css`、`tests/api.features.test.js`、`README.md`、`docs/API.md`、`docs/ARCHITECTURE.md`、`CHANGELOG.md`，以及 `.evolution/` 交付记录。

新增运行时依赖：无。

## 6. 测试与验证

| 检查 | 结果 |
|---|---|
| `npm test` | 38 / 38 通过 |
| `npm run test:e2e` | 6 / 6 通过 |
| `npm run build` | 成功；存在约 922.78 kB JS chunk 警告 |
| Node 语法检查 | `src/server.mjs`、`src/db.mjs` 通过 |

新增回归证据验证了 manifest 版本、题目/模型快照、权重快照、SHA-256 格式和独立 manifest API。未执行真实供应商网络调用、压力测试或渗透测试。

## 7. 进化评分

| 维度 | 改造前 | 改造后 | 证据 |
|---|---:|---:|---|
| 功能完整度 /25 | 20 | 23 | 运行清单、导出与多层评分闭环 |
| UI/UX /20 | 16 | 18 | 报告页可复现性摘要、移动端 E2E |
| 稳定性 /20 | 15 | 18 | 38/38 单测 API、6/6 E2E、取消/重试/失败隔离 |
| 架构与代码质量 /15 | 11 | 13 | 幂等迁移、后端集中构建 manifest、无新依赖 |
| 性能与安全 /10 | 7 | 8 | 安全头、限流、密钥脱敏；仍有 bundle 警告 |
| 文档与工程交付 /10 | 7 | 10 | README/API/架构/CHANGELOG/.evolution 全套记录 |
| **合计 /100** | **76** | **90** | 以本地可验证证据为准 |

评分不是人类智力或产品质量的客观测量；它只是本次工程交付的证据汇总。

## 8. 未完成事项

1. 真实供应商 Key、跨供应商分数可比性和计费精度仍未验证。
2. 203 道原创题仍需逐题人工/专家复核。
3. 还没有基于 Run Manifest 的自动复跑、manifest diff 和回归质量门禁。
4. 代码执行沙箱、多租户认证、CSRF/SSRF 防护仍不在当前单机范围内。
5. Vite 生产 bundle 仍需代码分割优化。

## 9. 下一阶段建议

优先实现“基于 manifest 的回归比较与质量门禁”：同题目版本、模型版本、评分器和权重下，比较两次运行的分数/延迟/成本变化；在阈值超限时输出明确的 provisional/fail 状态。随后再评估是否需要持久化队列和受限代码沙箱。
