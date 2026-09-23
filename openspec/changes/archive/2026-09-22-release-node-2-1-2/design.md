# Design

## Context

见 `proposal.md`。`openapi-skill-node/package.json` 与 lockfile 已声明 `2.1.2`，实现提交已经在 `main`，而 registry 当前返回 `openapi-skill@2.1.1` 为 `latest`。包配置通过 `prepublishOnly` 在发布时再次运行完整测试。现有发布约定要求正式版本不可覆盖，并用 annotated `v<version>` 标签标识发布源码。

## Goals / Non-Goals

**Goals:**

- 在维护者发布前形成可复查的测试、包清单、版本和工作区证据。
- 把凭据化发布明确留给维护者手动执行。
- 以 registry 回查作为“已发布”的唯一判据，再同步文档和 Git 标签。
- 让标签可追溯到实际用于打包的已推送提交。

**Non-Goals:**

- 不重新实现或修改 `2.1.2` 的多输出能力。
- 不发布 Maven 制品，不推进 Java `*-SNAPSHOT` 版本。
- 不提交 `.tgz`、npm token、用户级 npm 配置或临时发布输出。
- 不把上传成功但 registry 尚不可见的状态记录成已发布。

## Decisions

### 1. 发布前使用干净安装、完整测试和 dry-run 包检查

在 `openapi-skill-node` 中使用 lockfile 驱动的干净依赖安装，运行 `npm test`，并解析 `npm pack --dry-run --json`，确认名称、版本、入口、声明文件、双语 README、许可证和预期编译输出均进入包。随后检查工作区，防止构建产物或临时 tarball 被误提交。

只依赖 `prepublishOnly` 的替代方案被拒绝，因为它能阻止测试失败的上传，却不能提前审查最终文件清单或给维护者稳定的发布前证据。

### 2. 发布动作由维护者在准备提交上手动执行

仓库侧完成并推送发布准备提交，记录其 commit SHA；维护者从该提交的干净工作区执行 `npm publish`。代理不读取、转储或持久化 npm token，也不替维护者运行发布命令。

由自动化代发的替代方案被拒绝，因为用户已明确选择手动发布，且凭据不属于仓库交付边界。

### 3. registry 回查是发布状态和标签的门槛

维护者发布后，读取 npm registry，要求精确版本 `2.1.2` 可查询且 `latest` 指向 `2.1.2`。在此之前，不更新文档为“已发布”，也不创建发布标签。验证通过后更新 `docs/codex/PROJECT_CONTEXT.md`、`MODULES.md`、`TASKS.md`、相关设计文档中的发布事实，并修正已经过时的版本陈述。

仅以 `npm publish` 的退出码作为成功判据被拒绝，因为上传、registry 可见性和 dist-tag 状态是不同事实。

### 4. 标签标识实际发布源码

对维护者实际用于发布且已推送的 commit 创建 annotated `v2.1.2`，然后正常推送该标签。发布后的状态记录提交可以位于标签之后；文档必须同时记录 registry 证据与标签目标 SHA。若发布工作区不在预期提交或含未提交包内容，则停止并重新建立可追溯的准备提交。

把标签放在仅记录发布结果的后续文档提交上会弱化“标签即制品源码”的含义，因此不采用。

## Risks / Trade-offs

- [维护者从不同源码状态发布] → 发布前记录 commit SHA，并要求 `git status --short` 为空；发布后将标签指向该 SHA。
- [版本已存在且 npm 不允许覆盖] → 发布前后查询精确版本；若已存在则只核验内容与 dist-tag，不再次上传。
- [registry 或 dist-tag 传播延迟] → 保持状态为待验证，稍后重试只读查询，不重复发布。
- [文档中存在历史遗留版本陈述] → 用定向搜索统一更新当前状态，不改写历史决策的当时事实。
- [标签与 Maven 版本节奏不同] → 明确 `v2.1.2` 是本次 Node-only 发布；Java/Maven 坐标保持不变。

## Migration Plan

1. 完成发布前验证，提交并推送所有仓库侧准备工作，记录发布源码 SHA。
2. 维护者从该干净提交在 `openapi-skill-node` 执行 `npm publish`。
3. 回查精确版本、`latest` 和包元数据；失败或未传播时停止，不写“已发布”状态。
4. 验证成功后更新发布状态文档，创建指向发布源码 SHA 的 annotated `v2.1.2`，提交文档并正常推送提交与标签。
5. 若发布前失败，修复后重新走验证；若 registry 已发布但文档/标签失败，不可回滚不可变 npm 版本，只补齐仓库记录与标签。
