# Tasks

## 1. 发布前核验

- [x] 1.1 查询 npm registry 的精确 `2.1.2` 版本与 `latest`，确认应执行新发布还是只做发布后收尾，并保存可复查的命令结果。
- [x] 1.2 在 `openapi-skill-node` 执行 lockfile 驱动的干净安装和 `npm test`，验证完整 Node 测试套件通过且 package/lockfile 版本均为 `2.1.2`。
- [x] 1.3 执行 `npm pack --dry-run --json`，验证包名、版本、入口、类型声明、双语 README、许可证和预期 `dist` 文件清单，且没有生成需提交的 tarball。
- [x] 1.4 运行 OpenSpec 严格校验、`git diff --check` 和工作区检查，提交并正常推送发布准备变更，记录将用于手动发布的干净 commit SHA。

## 2. 维护者手动发布

- [ ] 2.1 维护者确认位于任务 1.4 的干净 commit，在 `openapi-skill-node` 手动执行 `npm publish`；以命令成功且未暴露/写入凭据作为完成证据。

## 3. 发布后验证与记录

- [ ] 3.1 从 npm registry 查询 `openapi-skill@2.1.2` 及 dist-tags，验证精确版本可见并且 `latest` 为 `2.1.2`；若尚未传播则停止收尾且不重复发布。
- [ ] 3.2 更新 `docs/codex/PROJECT_CONTEXT.md`、`MODULES.md`、`TASKS.md` 和受影响的当前设计说明，记录 npm `2.1.2` 已发布、验证证据及 Java/Maven 版本未变化，并用定向搜索确认当前状态陈述一致。
- [ ] 3.3 为任务 1.4 记录的实际发布源码 commit 创建 annotated `v2.1.2` 标签，验证标签目标与注释后正常推送标签。
- [ ] 3.4 重新运行 OpenSpec 严格校验与 `git diff --check`，提交并正常推送发布后文档，确认远端分支和 `v2.1.2` 标签均可见且工作区干净。
