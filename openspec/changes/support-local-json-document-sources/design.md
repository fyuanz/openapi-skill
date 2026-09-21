# Design

## Context

`openapi-skill-node/src/config.ts` 当前在 `parseDocuments()` 中强制 `services[].documents[].url` 必须是 `http:` 或 `https:` URL。`run()` 之后通过 `downloadServices()` 和 `downloadDocument()` 只使用 `fetch` 读取所有文档，再交给生成与发布链路。配置本身默认可从项目根目录的 `openapi-skill.config.json` 或 `package.json#openapiSkill` 读取。

该限制使离线 fixture、本地导出的 OpenAPI JSON 和服务未启动场景无法直接使用 CLI；但生成器只看 `Uint8Array`，不关心字节来自 HTTP 还是本地文件，因此本地读取主要改在配置解析和输入获取边界。

See `proposal.md` - Why / What Changes。

## Goals / Non-Goals

**Goals:**

- 让 `services[].documents[].url` 兼容 HTTP(S) URL 与本地 JSON 文件路径。
- 让本地路径解析、大小限制、失败错误边界和原子发布语义与当前项目约定一致。
- 保持 HTTP(S) 下载行为与已有测试兼容，不引入破坏性配置变更。
- 更新测试和文档，使新输入类型可验证、可维护。

**Non-Goals:**

- 不支持目录扫描、glob、配置文件外部自动发现或递归读取。
- 不支持 `file://` URL；本次只接受示例中的普通本地路径。
- 不改变 Java core、Spring Boot Starter、Maven 构建流程或生成内容布局。
- 不在生成结果中持久化本地文件的绝对路径；继续只保留现有内容摘要等 provenance 事实。

## Decisions

### 1. 继续复用 `url` 字段，把本地来源放在解析后的内部结构中

公开配置类型 `DocumentSource.url` 保持为 `string`，避免已有配置迁移。`loadConfig(cwd)` 在解析文档时把字符串分为两类：

- 以 `http://` 或 `https://` 开头（大小写不敏感）：远程来源。
- 其他字符串：本地文件路径。

理由：用户明确要求在 `url` 配置项上支持本地路径，新增 `file` 字段会引入并行字段和兼容成本。

备选方案：

- 新增 `file` 或 `path` 字段。拒绝，因为与需求描述不符，且会使错误检查分散在两个字段。
- 支持 `file://` URL。暂不纳入，因为它不是示例所需，且会额外引入协议解析边界。

### 2. 本地相对路径以 `cwd` 为基准解析

`loadConfig(cwd)` 已经知道运行目录；本地相对路径应在 `run()`/CLI 的项目根目录下解析，例如 `./openapi/account.json` 指向 `<cwd>/openapi/account.json`。

理由：这与 `openapi-skill.config.json` 默认位置和 `output` 相对路径语义一致。配置文件可能通过 `--config ../shared/config.json` 指向项目外，此时让本地文档路径悄悄相对配置文件目录会让行为难以预测。

备选方案：

- 相对配置文件所在目录解析。拒绝，因为 CLI 路径语义通常相对调用目录，且在多个项目共享配置时会变复杂。
- 不解析，要求用户只写绝对路径。拒绝，因为用户明确希望支持 `./openapi/account.json`。

### 3. 在配置解析阶段输出明确的来源类型和绝对路径

内部增加解析后字段，例如：

```ts
type DocumentSourceKind = 'remote' | 'local';

interface ResolvedDocumentSource extends DocumentSource {
  keywords: string[];
  kind: DocumentSourceKind;
  path: string; // remote 时保留原文 URL，local 时保留绝对路径
}
```

`parseDocuments()` 接受 `cwd`，对本地路径使用 `resolve(cwd, normalizedPath)` 生成绝对路径；对远程来源保留原始 URL。这样 `downloadServices()` 不需要再次猜测路径来源。

理由：把跨平台路径问题集中在配置解析层，读取阶段只消费确定结果，便于测试和维护。

备选方案：

- 仅在下游 `downloadDocument()` 中检测路径。拒绝，因为读取函数需要知道是 `fetch` 还是 `readFile`，而判别逻辑会与配置校验重复。
- 改变 `ResolvedDocumentSource.url` 为已解析绝对路径。可行，但保留原始值对错误消息和未来文档展示更友好。

### 4. 增加本地读取分支，并抽取单文档大小限制

`downloadServices()` 对每个 `ResolvedDocumentSource` 分派：

- `kind === 'remote'`：继续 `downloadDocument(owner, source.url, signal)`。
- `kind === 'local'`：调用本地读取函数读取 `source.path`，返回 `Uint8Array`。

本地读取函数应先 `stat` 文件，确认是普通文件；若 `size > 8 MiB` 直接失败，避免读入超大内存。随后 `readFile`，再与项目总预算累计。错误边界使用 `<serviceId>/<documentId>: LOCAL: ...`。

理由：与 HTTP 分支的 8 MiB 限制保持一致，并在读取前提前拒绝明显超大文件，维持确定性。

备选方案：

- 先 `readFile` 再检查长度。简单，但超大文件会不必要地分配内存。
- 不检查 `stat.isFile()`。可接受，但目录或特殊文件会产生较难定位的系统错误，不是首选。

### 5. `timeoutMs` 不套用到本地文件读取

当前 `AbortController` 和 `setTimeout` 围绕 HTTP fetch。本地 `fs.readFile` 不具备同样的事件循环中断语义；为了保持超时仍适用于所有网络下载，本地文件读取不接入该超时。

理由：本地文件是受信项目输入，读取通常快速且可重试；强制超时会给测试跨平台添加不必要复杂度。

备选方案：

- 用 `AbortSignal.timeout()` + 流式读取取消本地文件。复杂且在 Node 20 上的可移植收益不高。
- 对本地文件也失败超时。拒绝，因为缺少可靠的中断点，容易产生半失败语义。

## Risks / Trade-offs

- 风险：把 Windows 绝对路径 `F:/foo/account.json` 误判为 URL scheme。→ 缓解：只把精确的 `http://` / `https://` 前缀视为远程，其余全部按本地路径处理。
- 风险：本地路径指向项目外的敏感文件。→ 缓解：不新增目录扫描或通配符；配置文件本就是受信项目配置，CLI 只读取逐项显式路径，文档中明确该信任边界。
- 风险：测试过度依赖 Windows 路径，CI 跨平台不稳定。→ 缓解：使用 `path.win32`/`path.posix` 或临时目录绝对路径构造测试输入，避免硬编码盘符；关键规范只要求绝对与相对路径语义。
- 风险：README/设计文档仍声称 “每个 URL 必须 HTTP(S)”，造成行为文档不一致。→ 缓解：任务中加入定向搜索和双语 README 同步。
- 风险：本地文件读取分支破坏当前 HTTP 失败原子性。→ 缓解：本地读取仍在 `run()` 下载阶段抛出，未完成前不会进入 `publishSkill()`。

## Migration Plan

1. 先新增失败测试，覆盖 `loadConfig` 接受本地路径、`run` 读取本地文件、缺失文件/超大文件/版本错误失败且旧 Skill 保留，以及现有 HTTP 测试仍通过。
2. 实现内部类型、配置解析分支和本地读取函数。
3. 在 `openapi-skill-node` 下运行 `npm test`，确认全部现有与新增测试通过。
4. 更新双语 README 和顶层设计文档，然后运行 OpenSpec 校验与仓库文档检查。
5. 提交变更并按里程碑交付规则推送。

回滚方式：恢复 `openapi-skill-node/src`、测试和文档文件即可；没有配置格式迁移、数据库变更或持久化状态迁移。
