# 维护状态快照

记录日期：2026-11-18。此文件记录本地可验证状态；GitHub Actions 与 Release 状态以对应运行和发行页为准。

| 项目 | 当前状态 | 证据与限制 |
| --- | --- | --- |
| 主产品 | 本机 Web + Node.js 24、Docker | `src/server.mjs`、`Dockerfile`、`compose.yaml` |
| 当前版本候选 | v0.4.0 | 本地工作树已完成发布包验证；GitHub Release 需以标签工作流结果为准 |
| 自动测试 | 具备 Vitest 与 Playwright | `.github/workflows/ci.yml`；每次发布需核对当次运行 |
| 构建 | Vite 可构建，主 JS 超过 900 kB | `npm run build`；路由级拆分未完成 |
| 自动发布 | 标签触发，先复用 CI 后生成 Release 资产 | `.github/workflows/release.yml`；不等于已有改动已发布 |
| 更新 | 浏览器对同源 `/api/version` 轮询并提示刷新 | 无原生安装器、下载进度或自动回滚 |
| 依赖更新 | Dependabot 每周提交 PR | `.github/dependabot.yml`；不会自动合并发布 |
| 安全边界 | 可信本机单用户 | 无公网认证、多租户或完整 SSRF 防护 |
| 评测数据 | 203 道原创草案题目 | 逐题专家复核未完成；不得宣称权威榜单 |
| 回归门禁 | 本地会话比较 API 与报告页入口，已覆盖单元、API 与浏览器测试 | 无真实供应商对照样本或 CI 质量阈值配置 |

正式版本升级时依次检查依赖、数据迁移、单元/API、浏览器 E2E、生产构建、发布包独立运行、Actions、Release 资产和实际更新提示。所有结果按日期记录在发行说明，不继承旧版的绿色状态。
