# Design

## Context

见 `proposal.md` 的 Why。当前 npm registry 的 `latest` 是 `openapi-skill@2.1.2`，Node 包源码、锁文件根元数据和包元数据测试也均为 `2.1.2`；`v2.1.2` 之后的主分支已包含并验证两级目录接口发现实现。仓库约定发布版本不可变、每个已发布版本对应一个 annotated Git tag，并由维护者控制 npm 凭据和实际发布动作。

## Goals / Non-Goals

**Goals:**

- 让所有发布身份来源一致指向 `2.1.3`，避免 manifest、lockfile 与测试断言漂移。
- 在不写 registry 的情况下产出可复核的测试和 tarball 清单证据。
- 将“源码已准备”与“registry 已发布”作为两个不同状态记录，防止文档提前宣称 `latest` 已变化。
- 使后续维护者发布、registry 核验和打标签步骤明确且可追踪。

**Non-Goals:**

- 不在实施阶段执行 `npm publish`、修改 dist-tag、读取 npm 凭据或创建 `v2.1.3` 标签。
- 不改变 Node 的公开 API、配置格式、生成布局或运行时依赖。
- 不升级 Java/Maven 版本，也不重新固定 Vue 消费端历史 tarball。
- 不为纯发布工程工作新增或修改产品规格。

## Decisions

### 1. 使用维护者指定的补丁版本 2.1.3

尽管两级目录接口发现是用户可见增强，本次版本号由维护者明确指定为 `2.1.3`，实施时以该决定为准。版本只在 Node/npm 发布线推进，Java 的 `2.1.1-SNAPSHOT` 和 Maven Central 已发布坐标不随之变化。

备选方案是使用 `2.2.0` 表达向后兼容的新能力；该方案不符合本次明确的版本选择，因此不采用。

### 2. 用 npm 自身同步 manifest 与 lockfile

实施时优先在 `openapi-skill-node` 中使用不创建 Git tag 的 npm 版本命令，使 `package.json`、`package-lock.json` 顶层版本和 lockfile 根包版本由同一工具更新；随后通过已有包元数据测试锁定三处一致性。

备选方案是手工编辑三处 JSON。虽然结果简单，但更容易遗漏 lockfile 根包元数据，因此不采用。

### 3. 发布准备不等同于发布完成

准备提交中的 README 和项目状态文档 SHALL 将本地源码描述为 `2.1.3` 待发布，同时继续如实记录 npm `latest = 2.1.2`。只有维护者实际发布并完成 registry 查询后，后续工作才能把 `2.1.3` 记为已发布并创建 annotated tag。

备选方案是在准备阶段就把所有文档写成 `latest = 2.1.3`；这会制造不可验证的外部状态声明，因此不采用。

### 4. 以干净安装、完整测试和 dry-run 包清单作为准备门槛

实施阶段先运行 `npm ci`，再运行完整 `npm test`，最后执行 `npm pack --dry-run --json`。dry-run 结果必须显示包名 `openapi-skill`、版本 `2.1.3`，并包含 CLI/library 入口、类型声明、双语 README 和 LICENSE；不得生成或提交实际 tarball。

备选方案是只运行增量构建或只检查 JSON 版本；这无法覆盖发布钩子、编译产物和 `files` 白名单，因此不采用。

## Risks / Trade-offs

- [补丁版本承载可见增强可能与常见 SemVer 预期不同] → 在决策与发布记录中明确这是维护者选择，并确认没有破坏性 API 或配置变化。
- [文档可能把待发布状态误写成已发布] → 明确区分“本地源码 2.1.3”与“registry latest 2.1.2”，发布后再单独更新外部状态。
- [`npm ci` 会重建本地依赖和编译输出] → 只提交源、锁文件和要求的文档；排除 `node_modules`、`dist`、tarball 及临时输出。
- [dry-run 内容与预期不符] → 在提交和推送前阻止完成状态，修正 package `files` 或构建结果后重新验证。

## Migration Plan

1. 在 Node 包目录将版本元数据统一更新为 `2.1.3`，不创建 tag。
2. 更新版本测试与待发布状态文档。
3. 执行干净安装、完整测试和 dry-run 包检查；失败则保留为未完成任务，不推送不完整发布准备。
4. 更新 `docs/codex/TASKS.md` 等受影响记录，提交相关文件并正常推送。
5. 后续由维护者明确启动发布：执行 `npm publish`，查询 registry 确认版本、`latest`、摘要和完整性，再更新发布记录并创建/push `v2.1.3` annotated tag。

回滚准备变更时可通过后续普通提交恢复版本和文档；不得删除或重写已经推送的历史。若 `2.1.3` 已实际发布，则 npm 版本不可覆盖，修复必须使用新版本。
