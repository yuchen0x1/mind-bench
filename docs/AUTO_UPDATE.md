# 自动更新与在线发布

## 适用范围

MIND BENCH 是普通 Web 应用，不是 Electron/Tauri 桌面安装包。因此本项目不执行本机安装器替换，也不伪造桌面端更新清单或下载进度。更新方式是：

1. GitHub Actions 对 main 和 Pull Request 执行测试、构建和浏览器回归。
2. 推送符合 vMAJOR.MINOR.PATCH 的 Git 标签后，Release 工作流验证标签与 package.json 版本一致。
3. 工作流生成包含 `dist/`、后端、schema、文档和依赖清单的完整应用包，生成逐文件 `release-manifest.json` 和下载包 `SHA256SUMS.txt`；不包含用户数据库或密钥。
4. Windows/Linux 测试、生产依赖审计及独立解压运行验证通过后，使用 GitHub CLI 和最小权限 GITHUB_TOKEN 创建 Release。
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
  "version": "0.2.1",
  "buildId": "local",
  "buildTimestamp": "2026-11-12T00:00:00.000Z",
  "channel": "stable",
  "checkedAt": "2026-11-12T00:00:00.000Z",
  "releaseUrl": null
}
~~~

buildId 在 GitHub Actions 中使用提交 SHA；本地构建没有提交环境时使用 local。客户端同时比较版本和构建 ID，能够识别“版本号未变但部署内容已变”的情况。

## GitHub Actions

- .github/workflows/ci.yml：main push、PR、手动及可复用调用；Windows/Linux 执行安装、单元/API、生产依赖审计、构建、浏览器回归和独立发布包验证。生产依赖 high 以上漏洞会阻止通过。
- .github/workflows/release.yml：响应 v*.*.* 标签，复用上述完整验证；验证标签等于 package.json 后打包、核对、提取发布说明并创建 Release。
- CI 仅需要 contents: read。
- Release 仅需要 contents: write，使用 GitHub 提供的 GITHUB_TOKEN；不需要额外私钥。

正式发布示例：

~~~bash
npm version patch
git push origin main
git push origin v0.2.1
~~~

必须先把 package.json、锁文件、`docs/releases/release-notes.md` 与 README 更新提交到 main，再推送同名 vX.Y.Z 标签。项目仓库为 [yuchen0x1/mind-bench](https://github.com/yuchen0x1/mind-bench)。不要移动已经发布的版本标签；后续修复递增版本。

本地制作并检查与 CI 相同的完整包：

```bash
npm run build
npm run package:release
npm run verify:release
```

输出位于 `.tmp/releases/`。发布包可直接 `npm ci --omit=dev` 后 `npm start`，无须再次构建。验证脚本在临时目录安装和运行，使用隔离数据与动态端口，不触碰正式 `data/` 或正在运行的 3000 服务。离线已有缓存时可设 `MIND_BENCH_RELEASE_OFFLINE=1`；远程 CI 使用正常联网安装。

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

- GitHub Release 的下载资产校验与 CI 结果以实际发布后的记录为准；
- 浏览器端不会自动下载或安装操作系统更新包；
- 没有代码签名证书，因此不能声称完成 Windows/macOS 安装包签名；
- 没有 Beta/Dev 通道的独立部署源；
- 没有跨进程部署回滚控制器，回滚由部署平台完成。

## 测试

~~~bash
npm test
npm run build
npm run test:e2e
npm run package:release
npm run verify:release
~~~

更新专用验证包括：

- /api/version 返回 SemVer 版本和构建 ID；
- dist/build-info.json 在构建时生成；
- 版本/构建 ID 变化时前端显示刷新提示；
- CI 工作流只在 main/PR 验证；
- Release 工作流拒绝与 package.json 不一致的标签。

