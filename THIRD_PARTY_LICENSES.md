# 第三方许可证与归属说明

> 状态：此清单是本项目直接声明依赖的许可证概览，不构成法律意见，也不是对整个 `node_modules` 传递依赖的穷尽清点。实际依赖版本以 `package-lock.json` 为准。公开发行前，应针对锁定依赖树生成完整 SBOM/许可证报告，核对版权声明、NOTICE、字体、图标及构建产物来源。

## 直接依赖

以下名称、版本和许可证取自本次工作区安装包元数据；升级后应重新核验。各依赖仍应遵守其包内 LICENSE/NOTICE 文件。

### 运行时依赖

| 包 | 锁定工作区版本 | 声明许可证 | 项目用途 |
|---|---:|---|---|
| `express` | 5.3.0 | MIT | HTTP API 服务 |
| `framer-motion` | 14.12.0 | MIT | 前端动效 |
| `lucide-react` | 1.72.0 | ISC | UI 图标组件 |
| `react` | 19.3.1 | MIT | 前端 UI 框架 |
| `react-dom` | 19.3.1 | MIT | React DOM 渲染 |
| `recharts` | 3.10.1 | MIT | 图表组件 |

### 开发/测试依赖

| 包 | 锁定工作区版本 | 声明许可证 | 项目用途 |
|---|---:|---|---|
| `@playwright/test` | 1.65.0 | Apache-2.0 | 浏览器端到端测试 |
| `@testing-library/jest-dom` | 7.0.1 | MIT | DOM 测试断言 |
| `@testing-library/react` | 16.3.3 | MIT | React 组件测试辅助 |
| `@vitejs/plugin-react` | 6.3.0 | MIT | Vite React 插件 |
| `jsdom` | 31.0.0 | MIT | 测试 DOM 环境 |
| `vite` | 8.3.8 | MIT | 前端构建/开发服务器 |
| `vitest` | 5.1.0 | MIT | 自动化测试运行器 |

## 外部 benchmark 与题目数据

本项目没有复制上述开源研究项目中的 benchmark 题目、提示词或数据集。内置题目来源记录为 MIND BENCH 原创草案（`source-original-v1`，来源分级 A）。仓库根目录尚未添加 `LICENSE`，因此**项目自身代码与原创题库的再分发许可尚未正式声明**，请勿推定为 MIT 或 CC0。用户导入内容的许可由导入者负责核查，工具目录或框架仓库的代码许可**不**自动适用于其索引/使用的数据集。

详见 [开源研究笔记](docs/OPEN_SOURCE_RESEARCH.md) 和 [题目数据审核指南](docs/TEST_DATA_GUIDE.md)。

## 项目自身许可证

当前仓库未附根目录 `LICENSE` 文件，因此本项目自身源代码暂未明确授予开源使用/再分发许可。请勿仅凭本文件中的依赖许可证推断项目代码许可。正式公开前由权利人选择并添加项目许可证。
