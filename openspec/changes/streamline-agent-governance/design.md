# Design

## Context

当前仓库已经通过 `openspec init --tools codebuddy,claude,codex,agents --language zh-CN` 接入 OpenSpec 1.13.1。`openspec/config.yaml` 决定工件语言，`.agents/skills/openspec-*` 等目录由 CLI 生成并在 `.gitignore` 中忽略；根目录 `AGENTS.md` 是受版本控制的用户项目指令，不应被当成 OpenSpec 生成文件维护。

现有 `AGENTS.md` 同时承担两类职责：一是仓库特有的首读、测试、文档和交付规则；二是从 OpenSpec 初始化时手工记录的工作流命令、目录布局和生命周期说明。第二组规则已经由 OpenSpec 技能与 `openspec/` 目录提供，继续复制会造成双重来源。

## Goals / Non-Goals

**Goals:**

- 让 OpenSpec 成为规格驱动流程、变更生命周期和已约定行为的唯一工作流来源。
- 保留 `AGENTS.md` 中仍有项目价值、且 OpenSpec 不负责的工程约束。
- 让文档明确 `openspec/`、根 `AGENTS.md`、生成技能目录和 `docs/codex/` 的职责边界。
- 以最小改动降低未来 OpenSpec 升级带来的漂移风险。

**Non-Goals:**

- 不改变 OpenSpec schema、CLI 版本、语言配置或工具初始化范围。
- 不手工编辑 `.agents/`、`.claude/`、`.codebuddy/` 中的生成技能。
- 不把 `docs/codex/` 迁移到 OpenSpec，也不重写项目历史 ADR。
- 不改变任何 Java、Node、Starter 或生成 Skill 的产品行为。

## Decisions

### 1. `AGENTS.md` 只保留仓库级工程规则

保留强制首读、测试先行、文件规模、文档更新、验证和里程碑交付规则。删除 OpenSpec 命令表、CLI 清单、`openspec/specs` 与 `openspec/changes` 的重复解释、artifact 语言重复说明和同步细则。

理由：这些工程规则是本仓库对代理的额外要求；OpenSpec 技能不应承载项目的提交、首读和文档更新策略。

备选方案：

- 保留现状并继续双写。拒绝，因为命令表和流程说明最容易在 OpenSpec 升级后漂移。
- 删除整个 `AGENTS.md`。拒绝，因为会丢失 OpenSpec 之外仍需强制执行的项目规则。

### 2. 用简短治理声明引用 OpenSpec，而不是复制 OpenSpec 指令

`AGENTS.md` 开头只声明：非平凡功能、重构和架构变更必须通过适用的 OpenSpec 技能/命令启动；OpenSpec 工作流和规格以 `openspec/` 及生成技能为准；本文件不得复制 OpenSpec 指令。

理由：这样足以改变代理优先级，又不会在根指令中维护第二个命令手册。

备选方案：

- 在 `AGENTS.md` 保留完整命令表作为快捷参考。拒绝，因为这正是重复来源。
- 将完整规则放入 `openspec/config.yaml` 的 `context:`。拒绝，因为该上下文会进入每个规划工件，不适合承载仓库工程守则。

### 3. `docs/codex/` 记录分工，不替代 OpenSpec 当前规格

更新文档时只记录治理决定和实际目录职责：OpenSpec 管“做什么、当前约定、变更生命周期”；`docs/codex/` 管产品上下文、模块职责、任务状态和 ADR 历史；`AGENTS.md` 管代理执行工程规则。

理由：文档应帮助读者理解系统，不再把 `AGENTS.md` 描述成 OpenSpec 工作流内容的存放点。

备选方案：

- 大规模重构 `docs/codex/`。拒绝，因为本变更只需消除治理冲突，过大的文档迁移会扩大审查面。

### 4. 本变更不创建产品规格增量并设置 `skip_specs: true`

该变更只改变代理治理文档，不改变产品外部行为；当前 `openspec/specs/` 也为空，没有可修改的既有 capability。

理由：OpenSpec 校验允许纯文档/工具/重构类变更零 delta，但必须显式声明。

备选方案：创建一个 `agent-governance` 产品 capability。拒绝，因为这会把仓库内部协作规则误建模为产品能力。

## Risks / Trade-offs

- 风险：删除命令表后，新代理不知道具体应调用哪个技能。→ 缓解：根 `AGENTS.md` 保留“调用适用 OpenSpec 技能”的强约束；具体技能由 OpenSpec 生成目录和 Codex/Claude/CodeBuddy 自身发现机制提供。
- 风险：文档更新不完整，旧文档仍声称 `AGENTS.md` 承载 OpenSpec 工作流。→ 缓解：任务中包含定向搜索和四个 `docs/codex` 文件的同步检查。
- 风险：过度精简导致项目工程规则丢失。→ 缓解：逐项保留 first-read、TDD、文档、验证、交付五类规则，并用 diff 审核。
- 风险：把纯文档变更误判为产品规格变更。→ 缓解：设置 `skip_specs: true`，并用 `openspec validate` 验证零 delta 合法。

## Migration Plan

1. 重写根 `AGENTS.md` 的治理段和项目工程规则，删除重复 OpenSpec 手册内容。
2. 定向更新 `docs/codex/` 中的状态、结构、任务记录和 ADR 说明。
3. 运行 Markdown 差异检查、OpenSpec 校验和健康检查。
4. 审查 `git diff`，确认没有产品代码或生成技能目录被修改。

回滚方式：恢复 `AGENTS.md` 与相关 `docs/codex` 文件的上一提交即可；本变更不迁移数据、不改变配置格式、无运行时兼容性风险。