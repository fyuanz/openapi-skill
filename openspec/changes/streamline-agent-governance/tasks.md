# Tasks

## 1. 根指令精简

- [ ] 1.1 重写根目录 `AGENTS.md`：新增简短治理优先级，明确 OpenSpec 是规格驱动工作流、变更生命周期和已约定行为的唯一工作流来源，并通过人工复核确认不再包含完整 OpenSpec 命令表或 CLI 手册。
- [ ] 1.2 在 `AGENTS.md` 中保留项目专有的首读文档、TDD/红绿流程、文件规模、可验证决策、文档更新、验证和正常推送规则，并通过逐项对照旧文件确认没有删除这些仓库级规则。
- [ ] 1.3 确认 `AGENTS.md` 不复制 `openspec/config.yaml` 的语言配置、不描述生成目录为手工维护源，并用文本搜索验证没有残留 `/opsx:` 命令表或 `$openspec-*` 命令清单。

## 2. 项目文档同步

- [ ] 2.1 更新 `docs/codex/PROJECT_CONTEXT.md` 的 OpenSpec 状态与约束，说明 OpenSpec 负责工作流和已约定行为、根 `AGENTS.md` 只负责仓库工程规则；用定向阅读确认不再把根指令描述为 OpenSpec 规则载体。
- [ ] 2.2 更新 `docs/codex/PROJECT_STRUCTURE.md` 的目录职责，明确 `openspec/` 是工作流与规格事实源、`.agents/` 等是生成输出、`AGENTS.md` 是仓库工程规则；用 `rg -n "AGENTS\\.md|OpenSpec|openspec" docs/codex/PROJECT_STRUCTURE.md` 复核。
- [ ] 2.3 在 `docs/codex/DECISIONS.md` 顶部新增本次治理决策，记录接受状态、背景、决定、备选方案和影响；阅读新增段落确认它 supersede 2026-09-20 OpenSpec 采纳决策中“在 AGENTS.md 记录 CLI surface 和命令拼写”的做法。
- [ ] 2.4 在 `docs/codex/TASKS.md` 顶部增加本次文档治理任务记录，列出修改范围和验证方式；确认任务状态表述为已实现前的计划或实现后的完成记录，与实际变更一致。
- [ ] 2.5 全仓定向搜索 `AGENTS.md`、OpenSpec 命令表和“唯一工作流来源”等表述，修正仍要求在 `AGENTS.md` 双写 OpenSpec 指令的过时文档；使用 `rg -n "opsx:|\\$openspec-|AGENTS\\.md.*OpenSpec|OpenSpec.*AGENTS\\.md" AGENTS.md docs/codex openspec/changes/streamline-agent-governance` 复核结果只保留有意的历史或变更说明。

## 3. 验证与交付审查

- [ ] 3.1 运行 `openspec validate "streamline-agent-governance"`，确认 `skip_specs: true` 下零产品规格 delta 合法且 change 有效。
- [ ] 3.2 运行 `openspec status --change "streamline-agent-governance" --json`，确认 proposal/design/tasks 为 done、specs 为 skipped。
- [ ] 3.3 运行 `openspec doctor` 和 `openspec list --json`，确认 OpenSpec 根仍健康且该 change 出现在活跃列表中。
- [ ] 3.4 运行 `git diff --check` 并审查 `git status --short` 与 `git diff -- AGENTS.md docs/codex openspec/config.yaml openspec/changes/streamline-agent-governance`，确认没有产品代码、依赖、发布产物或 `.agents/`/`.claude/`/`.codebuddy/` 生成目录被修改。
- [ ] 3.5 按里程碑交付规则提交本变更的规划/文档相关文件并正常推送；若远端或认证阻塞，报告具体错误且不使用 force-push。