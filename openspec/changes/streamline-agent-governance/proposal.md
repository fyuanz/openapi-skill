# Proposal

## Why

根目录 `AGENTS.md` 当前复制了一整套 OpenSpec 命令、目录布局和生命周期规则，而这些规则已经由 `openspec/config.yaml`、`openspec/` 下的规格/变更工件以及 OpenSpec 生成的技能提供。重复维护会在 CLI 升级、命令名变化或流程调整时产生漂移，并让代理在“根指令”和“OpenSpec 技能指令”之间面对两个来源。

## What Changes

- 精简根目录 `AGENTS.md`，移除其中手工维护的 OpenSpec 命令表、CLI 清单、目录解释和生命周期细则。
- 在 `AGENTS.md` 中保留项目专有的工程规则：强制首读文档、测试先行、文件规模、文档同步、验证和里程碑交付要求。
- 增加明确的治理优先级：OpenSpec 是规格驱动工作流、变更生命周期和已约定行为的唯一工作流来源；`AGENTS.md` 只记录仓库级工程约束，不复制 OpenSpec 指令。
- 更新 `docs/codex/` 中关于 OpenSpec 采纳状态和职责边界的记录，说明根指令与 OpenSpec 的分工，避免文档继续把 `AGENTS.md` 描述为 OpenSpec 规则载体。
- 不修改产品代码、OpenAPI 生成行为、依赖版本或发布产物。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- 无。

这是仓库治理与文档重构，不改变产品的外部可观察行为；将在变更元数据中设置 `skip_specs: true`，而不是人为创建产品规格增量。

## Impact

- 主要影响根目录 `AGENTS.md` 的指令结构和代理读取方式。
- 需要同步更新 `docs/codex/PROJECT_CONTEXT.md`、`docs/codex/PROJECT_STRUCTURE.md`、`docs/codex/TASKS.md` 和 `docs/codex/DECISIONS.md` 中与 OpenSpec 职责边界相关的事实。
- `openspec/config.yaml`、`.agents/`、`.claude/`、`.codebuddy/` 和 OpenSpec 生成技能不由实现阶段手工改写；生成目录仍按现有 `.gitignore` 规则保持忽略。
- 验证重点是 OpenSpec 根健康、变更校验、Markdown 差异检查，以及确认文档中不存在新的重复命令维护责任。
