# Tasks

## 1. 锁定 2.1.3 发布身份

- [x] 1.1 先将 `openapi-skill-node/test/package-metadata.test.mjs` 的期望版本改为 `2.1.3`，运行针对性测试并确认它因当前 manifest 仍为 `2.1.2` 而失败，保留 red 证据。
- [x] 1.2 在 `openapi-skill-node` 中用不创建 Git tag 的 npm 版本命令升级到 `2.1.3`，确认 `package.json`、`package-lock.json` 顶层版本和 lockfile 根包版本均为 `2.1.3`，并让 1.1 的测试转绿。

## 2. 同步待发布文档

- [x] 2.1 更新 `openapi-skill-node/README.md` 与 `README.en.md`，确认双语文档都将本地包描述为待发布 `2.1.3`、继续如实记录 registry `latest = 2.1.2`，并说明本版本包含两级目录接口发现。
- [x] 2.2 更新根 `README.md`、`README.en.md` 和 `docs/openapi-skill-design.md` 中受影响的版本/状态描述，使用针对性 `rg` 检查不存在把未发布 `2.1.3` 误称为 npm `latest` 的文本。
- [x] 2.3 按项目规则更新 `docs/codex/PROJECT_CONTEXT.md`、`MODULES.md`、`TASKS.md` 和 `DECISIONS.md`，确认任务状态、模块版本、发布边界与维护者选择 `2.1.3` 的决定一致；仅在实际路径/职责改变时才更新 `PROJECT_STRUCTURE.md`。

## 3. 验证发布包

- [x] 3.1 在 `openapi-skill-node` 执行 `npm ci` 后运行完整 `npm test`，确认全部 70 项 Node 测试通过且没有依赖或编译错误。
- [x] 3.2 执行 `npm pack --dry-run --json`，确认结果为 `openapi-skill@2.1.3`，并包含 CLI/library JavaScript 入口、类型声明、`README.md`、`README.en.md` 和 `LICENSE`；确认未生成或提交 `.tgz`。
- [x] 3.3 运行 `openspec validate release-node-2-1-3 --strict`、`git diff --check` 和 `git status --short`，确认规划/实现记录有效且提交范围不含 `node_modules`、`dist`、凭据、实际 tarball 或无关改动。

## 4. 交付发布准备

- [x] 4.1 将完成的发布准备文件作为一个独立可审查提交提交，检查提交差异只包含 `2.1.3` 元数据、测试、文档和本变更记录。
- [x] 4.2 正常推送提交到配置的 GitHub remote 并确认远端包含该提交；若远端缺失或认证失败，保留本地提交并记录具体阻塞，不 force-push。
- [x] 4.3 在交付说明中列出测试数量、dry-run 包清单摘要和提交哈希，并明确 `npm publish`、registry `latest` 核验以及 annotated tag `v2.1.3` 尚未执行，等待维护者后续明确启动发布。
