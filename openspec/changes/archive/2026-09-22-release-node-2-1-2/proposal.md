# Proposal

## Why

Node 包源码已经推进到 `openapi-skill@2.1.2` 并完成多输出目录能力验证，但 npm registry 的 `latest` 仍是 `2.1.1`。需要把已验证源码整理为可由维护者手动发布的不可变版本，并在发布成功后同步仓库中的发布事实。

## What Changes

- 对 `openapi-skill@2.1.2` 执行干净的发布前测试与打包检查。
- 由维护者在仓库外持有 npm 凭据并手动执行 `npm publish`；自动化或代理不接触发布令牌。
- 发布后从 npm registry 验证版本与 `latest` 标签均为 `2.1.2`。
- 仅在 registry 验证成功后更新项目发布状态，并为准确的发布源码提交创建、推送 annotated `v2.1.2` Git 标签。
- 不修改 Java/Maven 版本、生成 Skill 的格式或 Node 包运行时行为。

## Capabilities

### New Capabilities

无。本变更只发布并记录既有行为，已设置 `skip_specs: true`。

### Modified Capabilities

无。

## Impact

- 影响 npm registry 中的 `openapi-skill` 包、Git 发布标签以及 `docs/codex/` 发布状态记录。
- 不改变公共 API、配置兼容性、依赖、Java reactor 或 Maven Central 制品。
- 发布操作需要维护者本机 npm 身份；凭据和令牌不得进入仓库、日志或 OpenSpec 工件。
