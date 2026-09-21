# Design

## Context

Node CLI 当前在 `cli.ts` 捕获 `run()` rejection，只打印最外层 `Error.message`。生成链已经使用 `Error.cause` 保留下载、本地读取、文档生成等底层错误，并通过 `serviceId/documentId` 包装多数文档错误；但这些信息由自由文本拼接表达，CLI 没有统一渲染层。

`input.ts` 在 `JSON.parse` 前运行轻量递归扫描以拒绝重复键。扫描器维护字符索引但错误时没有暴露偏移；外层又把所有语法原因压缩为统一 `INVALID_JSON` 消息。该扫描器是无需新增依赖即可得到确定位置的最佳边界。

## Goals / Non-Goals

**Goals:**

- 让 CLI 默认错误稳定、简洁、可测试，同时保留现有错误分类和文档所有者上下文。
- 由输入扫描阶段产生可靠的字符偏移，并统一转换为一基行列。
- 仅在 CLI 边界负责控制台渲染；库函数仍只抛出错误。
- 让 `--debug` 能查看完整异常链，同时防止循环或极深 `cause` 导致无界输出。

**Non-Goals:**

- 不建立通用日志框架，不增加第三方 JSON 解析或 CLI 参数依赖。
- 不为所有 OpenAPI 结构错误补充 JSON Pointer；本次只保证阶段、代码、上下文以及 JSON 语法位置。
- 不改变 Spring Boot Starter，也不增加机器可读 JSON 日志模式。
- 不改变生成文件、core/3 格式或发布事务边界。

## Decisions

### 1. 使用带字段的内部诊断错误，CLI 最后统一格式化

新增内部诊断表示，至少携带 `phase`、`code`、安全消息、可选的 service/document 和位置，并继续使用原生 `cause` 保存原始异常。各边界在拥有上下文时补充字段，CLI 捕获处将任意异常归一化后渲染。

格式采用单行人类可读形式，例如：

```text
ERROR user-service/account [PARSE/INVALID_JSON]: expected an object key (line 42, column 17)
```

配置级错误省略 owner：

```text
ERROR [CONFIG/INVALID_CONFIG]: cannot read configuration
```

阶段限定为 `CONFIG`、`DOWNLOAD`、`LOCAL`、`PARSE`、`VALIDATE`、`GENERATE`、`PUBLISH` 和 `INTERNAL`。既有大写前缀可映射到阶段和代码；无法分类的值使用 `INTERNAL/UNEXPECTED_ERROR`。

选择字段化内部对象而不是继续解析自由文本，因为文本反向解析容易被路径、文档 ID 和底层错误中的冒号破坏。没有把诊断对象作为新的公共返回类型，是为了保持 `run()` 的 Promise rejection API 兼容。

### 2. 由现有 JSON 扫描器产生偏移，不依赖 V8 错误文本

调整重复键/语法扫描器，使其在失败时抛出包含 UTF-16 字符偏移的内部解析错误。行列通过扫描原文至该偏移计算；这与 JavaScript 字符串索引和 CLI 展示保持一致。第二次重复键的起始引号作为重复键位置。

扫描器负责当前已覆盖的 JSON 文法错误和重复键；通过扫描后仍由 `JSON.parse` 产生对象。若 `TextDecoder` 或 `JSON.parse` 返回没有可信偏移的错误，只输出不带位置的 `INVALID_JSON`，不解析依赖 Node/V8 版本的英文错误消息。

替代方案是引入带位置的 JSON parser，但会增加运行时依赖、可能改变数字或重复键语义；本需求不值得承担该兼容成本。

### 3. 参数解析保持小型且显式

CLI 接受零个或一个 `--config <path>` 以及零个或一个 `--debug`，二者顺序任意。未知参数、缺失值和重复参数统一视为用法错误并退出 `2`。不引入参数解析库。

`--debug` 只影响 CLI 的错误渲染，不传入生成和发布逻辑，因此不会改变正常控制流或产物。

### 4. 调试输出遍历 cause 链并设置上限

默认先输出规范化单行诊断。调试模式随后输出顶层 stack；再按 `Caused by:` 顺序输出每个 Error cause 的 stack 或字符串表示。遍历使用对象身份集合检测循环，并设置固定深度上限；循环或截断以明确标记结束。

不对显式 debug 输出进行完全脱敏，因为它的用途正是呈现底层异常原文；README 必须提示其可能包含来源细节，不应直接发布到公共 issue。默认输出则只使用诊断层生成的安全消息。

### 5. 默认来源信息采用最小披露

文档诊断以 service/document 作为主要来源标识，通常无需展示 URL 或文件绝对路径。确需展示远程来源时，先通过 URL 结构化移除 username、password、search 和 hash；绝不从底层 fetch 错误中直接复制 URL 到默认消息。解析错误不回显输入片段。

### 6. 通过子进程测试真实 CLI 契约

除单元测试诊断归一化和行列计算外，新增对编译后 CLI 的子进程测试，分别断言 stdout、stderr 和退出码。原子发布继续通过现有运行测试验证，并增加“已有 Skill + 非法 JSON + CLI 失败后整树不变”的覆盖。

## Risks / Trade-offs

- [现有使用者可能匹配旧的自由文本错误] → 保留既有大写错误代码（如 `INVALID_JSON`）并在 README 说明稳定字段；不承诺完整句子逐字兼容。
- [UTF-16 列号与某些编辑器按 Unicode code point 计列不同] → 明确以 JavaScript 字符串位置为基础，并用 ASCII、多字节 UTF-8、CRLF/LF 测试固定行为。
- [默认消息在重新包装时意外带入敏感 URL] → 默认格式化只读取诊断错误的安全字段，原始异常只保存在 `cause` 并仅在 debug 中展开。
- [自定义扫描器与 `JSON.parse` 文法漂移] → 保持扫描器范围为标准 JSON，使用表驱动非法输入测试；通过扫描后的输入仍必须交给 `JSON.parse`。
- [调试异常链过大] → 循环检测和固定深度上限保证输出有界。

## Migration Plan

该变更是向后兼容的可选 CLI 增强，无数据迁移。发布时随 Node 包版本更新；出现问题可回退到旧 CLI 渲染逻辑，不影响已生成 Skill。实现完成后用现有 npm 测试、真实 CLI 子进程测试和本地打包检查验证。
