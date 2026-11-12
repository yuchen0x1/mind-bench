# 自动更新与在线发布

## 适用范围

MIND BENCH 是普通 Web 应用，不是 Electron/Tauri 桌面安装包。因此本项目不执行本机安装器替换，也不伪造桌面端更新清单或下载进度。更新方式是：

1. GitHub Actions 对 main 和 Pull Request 执行测试、构建和浏览器回归。
2. 推送符合 vMAJOR.MINOR.PATCH 的 Git 标签后，Release 工作流验证标签与 package.json 版本一致。
3. 工作流生成包含 dist/ 的不可变 Web 构建包，并生成 SHA256SUMS.txt。
4. GitHub Release 使用 GitHub CLI 和 GITHUB_TOKEN 创建；当前没有远程仓库时，工作流不会在本地执行发布。
5. 已打开的浏览器页面每 5 分钟轮询 /api/version。服务端构建版本或构建 ID 变化时，页面显示“发现新的部署”，用户可刷新加载新版本。

## 版本信息

版本来源为 package.json 的 SemVer 三段式版本：

- PATCH：修复问题；
- MINOR：兼容的新功能；
- MAJOR：不兼容变更。

Vite 构建会生成 dist/build-info.json，其中包含版本、构建 ID、构建时间和通道。Express 的 /api/version 返回同一份信息，并设置 Cache-Control: no-store，避免更新检查被缓存。

## 更新检查接口

/api/version 返回：

~~~json
{
  "name": "MIND BENCH",
  "version": "0.1.0",
  "buildId": "local",
  "buildTimestamp": "2026-11-12T00:00:00.000Z",
  "channel": "stable",
  "checkedAt": "2026-11-12T00:00:00.000Z",
  "releaseUrl": null
}
~~~

buildId 在 GitHub Actions 中使用提交 SHA；本地构建没有提交环境时使用 local。客户端同时比较版本和构建 ID，能够识别“版本号未变但部署内容已变”的情况。

## GitHub Actions

- .github/workflows/ci.yml：main push 与 PR 触发；执行 npm ci、npm test、npm run build、Chromium 安装和 npm run test:e2e。
- .github/workflows/release.yml：只响应 v*.*.* 标签；先验证标签版本等于 package.json，再测试、构建、打包、生成 SHA-256，并创建 GitHub Release。
- CI 仅需要 contents: read。
- Release 仅需要 contents: write，使用 GitHub 提供的 GITHUB_TOKEN；不需要额外私钥。

正式发布示例：

~~~bash
npm version patch
git push origin main
git push origin v0.1.1
~~~

必须先把 package.json 版本变更提交到 main，再推送同名 vX.Y.Z 标签。当前工作区没有远程仓库，因此 origin 和实际 Release 尚未配置。

## 部署侧缓存要求

部署 Web 构建时：

- index.html 与 build-info.json 必须不缓存或短缓存；
- dist/assets/* 可以使用带 hash 的长期 immutable 缓存；
- 反向代理/平台不得缓存 /api/version；
- 发布失败时保留旧部署，不删除当前可用版本。

Express 已对这些路径设置对应的缓存头。若由 Nginx、CDN 或托管平台接管静态资源，需保持同样策略。

## 安全与校验边界

已实现：

- 更新检查使用同源部署路径，不接受前端传入的任意下载 URL；
- Release 资产生成 SHA-256 校验文件；
- GitHub Actions 使用最小权限；
- 发布前执行测试和版本标签校验；
- 更新提示只刷新浏览器，不会覆盖用户数据或中断后台测试。

尚未实现/需要外部条件：

- GitHub Release 的真实资产下载验证，需要远程仓库和发布权限；
- 浏览器端不会自动下载或安装操作系统更新包；
- 没有代码签名证书，因此不能声称完成 Windows/macOS 安装包签名；
- 没有 Beta/Dev 通道的独立部署源；
- 没有跨进程部署回滚控制器，回滚由部署平台完成。

## 测试

~~~bash
npm test
npm run build
npm run test:e2e
~~~

更新专用验证包括：

- /api/version 返回 SemVer 版本和构建 ID；
- dist/build-info.json 在构建时生成；
- 版本/构建 ID 变化时前端显示刷新提示；
- CI 工作流只在 main/PR 验证；
- Release 工作流拒绝与 package.json 不一致的标签。

