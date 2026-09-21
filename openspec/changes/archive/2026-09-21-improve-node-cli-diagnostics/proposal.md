# Proposal

## Why

Node CLI 当前只把最外层异常消息写入 stderr；虽然能够失败退出并保留旧 Skill，但 JSON 解析失败等问题缺少稳定的来源、阶段和位置诊断，完整 `cause` 链也无法按需查看。这使本地排错和 CI 定位成本偏高。

## What Changes

- 为 Node CLI 的失败输出定义稳定的诊断格式，至少包含 service/document 上下文、失败阶段、错误代码和可操作消息。
- JSON 语法解析失败时，在可确定的情况下报告行列位置；无法可靠定位时仍提供稳定的通用诊断。
- 新增 `--debug` 命令行选项，在 stderr 输出完整异常栈和 `cause` 链；默认模式保持简洁且不泄露文档正文、请求头或 URL 查询参数。
- 保持成功信息写入 stdout、失败信息写入 stderr、失败退出码为 `1`，参数使用错误退出码为 `2`。
- 保持生成与发布的原子性：诊断增强不得导致失败输入替换已有 Skill 或发布部分结果。
- 本次不增加 `validate`、`dry-run`，也不修改 Spring Boot Starter 的 HTTP 响应或日志行为。

## Capabilities

### New Capabilities

- `node-cli-diagnostics`: 定义 Node CLI 默认诊断、调试诊断、输出通道、退出码、安全披露和失败发布语义。

### Modified Capabilities

- 无。

## Impact

- 主要影响 `openapi-skill-node` 的 CLI 参数解析、错误归一化、OpenAPI JSON 解析和 CLI/运行测试。
- Node 库入口继续以 Promise rejection 报告错误，不要求调用方使用控制台，也不改变现有生成结果格式。
- 不新增运行时依赖；npm 包 CLI 增加向后兼容的可选参数。
- 需要同步 Node 中英文 README、`docs/codex/TASKS.md`，如形成新的技术取舍则同步 `docs/codex/DECISIONS.md`。
