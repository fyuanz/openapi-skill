# Proposal

## Why

`openapi-skill` Node CLI 目前只允许把 OpenAPI 文档配置为 HTTP(S) URL。对于离线测试、本地 fixture、CI 中已导出的 OpenAPI JSON，或服务未启动时的文档生成，用户必须先额外提供 HTTP 入口，增加不可验证、不可维护的运行依赖。配置中的 `services[].documents[].url` 支持本地 JSON 文件路径后，用户可以显式指向受信本地契约，复用同一套生成与原子发布流程。

## What Changes

- `services[].documents[].url` 在 HTTP(S) URL 之外，还接受本地 JSON 文件路径，例如 `./openapi/account.json`、`F:/foo/account.json` 或 `/abs/account.json`。
- 本地相对路径以 `run()` 的 `cwd` / `process.cwd()` 为基准解析，与现有默认配置文件和 `output` 的相对路径语义保持一致。
- `loadConfig()` 不再把所有非 HTTP(S) `url` 值判为配置错误，而是将其解析为本地文档来源。
- `run()` 在读取文档时增加本地读取分支，继续应用单文档 8 MiB 和项目总计 32 MiB 输入限制，并把本地文件字节交给同一生成与校验链路。
- 本地文件读取失败使用类似 `<serviceId>/<documentId>: LOCAL: ...` 的错误边界，任一本地位文件失败均不替换已有 Skill。
- HTTP/HTTPS 文档的下载行为、超时、重定向拒绝和内容类型校验保持不变。
- 更新 TypeScript 类型、测试、README 和设计文档，说明 `url` 字段现在表示 HTTP(S) URL 或本地 JSON 文件路径。

## Capabilities

### New Capabilities

- `node-local-document-sources`: 定义 Node CLI 显式配置的本地 JSON 文档来源行为，包括路径解析、读取限制、失败语义与生成集成。

### Modified Capabilities

- 无。

## Impact

- 受影响代码：`openapi-skill-node/src/config.ts`、`openapi-skill-node/src/index.ts`、`openapi-skill-node/src/types.ts`。
- 受影响测试：`openapi-skill-node/test/project-config.test.mjs`、`openapi-skill-node/test/run.test.mjs`，并可能新增本地文件专用测试。
- 受影响文档：`openapi-skill-node/README.md`、`openapi-skill-node/README.en.md`、`docs/openapi-skill-design.md`、`docs/codex/` 相关状态与结构说明。
- 不影响 Java core、Spring Boot Starter、Maven 坐标或已发布历史制品；Node CLI 的 HTTP(S) 兼容行为不产生破坏性变更。
