# Proposal

## Why

主分支已经包含 npm `openapi-skill@2.1.2` 发布后完成并验证的两级目录接口发现能力，但 Node 包元数据仍停留在已发布的 `2.1.2`。需要按维护者指定的补丁版本 `2.1.3` 整理一致的版本元数据、发布说明与可复核的打包证据，为后续人工执行 npm 发布做好准备。

## What Changes

- 将 `openapi-skill-node` 的包版本、锁文件根包版本和版本测试断言统一升级为 `2.1.3`。
- 更新中英文包文档、仓库状态文档和发布记录，明确 `2.1.3` 是待发布源码版本，并说明其包含已完成的两级目录接口发现能力。
- 通过干净依赖安装、完整 Node 测试和 `npm pack --dry-run --json` 验证发布包身份、内容清单及必要入口。
- 提交并正常推送发布准备变更；实际 `npm publish`、registry `latest` 验证以及 `v2.1.3` annotated tag 仅在维护者后续明确执行发布时完成。
- 不修改 Java/Maven 版本、生成格式、公开 API、配置契约或运行时行为。

## Capabilities

### New Capabilities

无。本变更只准备既有 Node 行为的 npm 补丁发布，不引入新的产品能力。

### Modified Capabilities

无。现有 OpenSpec REQUIREMENTS 不变；`.openspec.yaml` 使用 `skip_specs: true`。

## Impact

- 直接影响 `openapi-skill-node/package.json`、`package-lock.json`、包元数据测试和 Node 中英文 README。
- 影响描述源码版本、npm `latest` 和发布状态的仓库/项目文档，包括 `docs/codex/` 中的任务、决策、模块和上下文记录。
- 发布准备阶段不需要 npm 凭据，不执行 registry 写操作，也不创建发布标签。
- Java reactor、Maven Central 坐标、Vue 消费端固定 tarball 和生成的 `openapi-skill-core/3` 布局保持不变。
