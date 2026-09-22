# Proposal

## Why

当前 Node CLI 只能把生成的项目 Skill 发布到一个输出父目录，无法用一次配置同时服务 Codex、Trae 等使用不同 Skill 目录的 Agent。项目需要在保留现有单字符串配置兼容性的同时，支持将同一份生成结果分发到多个目录，并明确部分发布失败时的行为。

## What Changes

- 允许顶层 `output` 同时接受一个非空路径字符串或一个非空路径数组；省略时仍默认使用 `.agents/skills`。
- 将相对输出路径统一相对于 CLI 项目根目录解析，规范化并拒绝重复或不安全的多目标配置。
- OpenAPI 输入只读取一次、Skill 文件集合只生成一次，然后按配置顺序发布到所有输出目录。
- 每个输出目录继续使用独立的校验、暂存、备份和原子替换；多个目录之间不提供整体事务或跨目录回滚。
- 任一目标发布失败时，命令整体失败，已经成功发布的目标保持更新，并提供不泄露敏感内容的目标级诊断。
- 扩展程序化运行结果和 CLI 成功输出以报告全部 Skill 目录，同时为现有单目录调用方保留兼容访问方式。
- 将 `openapi-skill` Node 包版本从 `2.1.1` 更新为 `2.1.2`，并同步中英文文档与项目事实文档。

## Capabilities

### New Capabilities

- `node-multiple-output-directories`: 定义 Node 配置的单目标/多目标输出、规范化校验、逐目录独立原子发布、部分成功失败语义及结果报告。

### Modified Capabilities

无。

## Impact

- 影响 `openapi-skill-node` 的公开 TypeScript 配置类型、解析后的配置模型、`run()` 返回值、CLI 文案、发布编排和相关测试。
- 影响 Node 包中英文 README、根级项目说明和版本元数据。
- 不改变 OpenAPI 下载、解析、Skill 内容生成、单个输出目录内部的原子替换实现，也不新增 Agent 名称枚举或 Agent 专属路径推断。
