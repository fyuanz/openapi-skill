# node-cli-diagnostics Specification

## Purpose

定义 `openapi-skill` Node CLI 在读取、解析、校验和发布失败时向人和自动化环境提供稳定、安全且可定位的诊断，并允许开发者显式查看完整异常链。

## Requirements

### Requirement: 默认失败输出稳定的单条诊断

Node CLI 在执行失败时 SHALL 向 stderr 写入一条规范化诊断，并 SHALL 以 `ERROR`、可用的 `serviceId/documentId` 上下文、阶段、错误代码和可操作消息标识失败；默认输出 MUST NOT 包含 JavaScript stack 或 `cause` 链。没有文档上下文的配置或内部错误 SHALL 仍提供阶段、错误代码和消息。

#### Scenario: 文档解析失败

- **WHEN** 已识别为 `user-service/account` 的文档包含非法 JSON
- **THEN** CLI SHALL 在 stderr 输出一条包含 `user-service/account`、`PARSE`、`INVALID_JSON` 和解析失败说明的诊断
- **THEN** 默认输出 SHALL 不包含 JavaScript 调用栈

#### Scenario: 配置读取失败

- **WHEN** CLI 在识别 service/document 之前无法读取或解析配置
- **THEN** CLI SHALL 输出包含 `CONFIG` 阶段、稳定错误代码和可操作消息的诊断
- **THEN** CLI SHALL 不虚构 service/document 上下文

#### Scenario: 未识别异常

- **WHEN** CLI 捕获到不能归类为既有失败类型的异常值
- **THEN** CLI SHALL 将其规范化为带 `INTERNAL` 阶段和稳定兜底错误代码的单条诊断

### Requirement: JSON 语法诊断提供可靠位置

Node CLI 对 OpenAPI JSON 的语法失败 SHALL 在能够从输入确定位置时报告一基行号和一基列号。位置不可可靠确定时，CLI SHALL 省略位置而不是输出猜测值；重复对象键 SHALL 继续被拒绝并 SHALL 标明重复键名。

#### Scenario: 非法 JSON 可定位

- **WHEN** OpenAPI 文档在确定的字符偏移处存在语法错误
- **THEN** 默认诊断 SHALL 报告与原始文档对应的一基行号和一基列号

#### Scenario: 重复对象键

- **WHEN** OpenAPI 文档的同一对象中重复声明一个键
- **THEN** CLI SHALL 以 `INVALID_JSON` 拒绝该文档并在诊断中标明重复键名
- **THEN** CLI SHALL 在能够确定时报告第二次键声明的位置

#### Scenario: 位置不可可靠确定

- **WHEN** 底层错误没有可验证的输入偏移信息
- **THEN** CLI SHALL 输出不带行列号的稳定解析诊断

### Requirement: 调试模式输出完整异常链

Node CLI SHALL 接受可选的 `--debug` 参数。执行失败且启用调试模式时，CLI SHALL 在规范化诊断之后向 stderr 输出顶层异常的 stack 以及按顺序可达的 `cause` 异常信息；异常链存在循环或异常深度时 MUST 有界终止。

#### Scenario: 调试解析失败

- **WHEN** 用户以 `--debug` 运行 CLI 且 OpenAPI 解析失败
- **THEN** stderr SHALL 先包含与默认模式相同的规范化诊断
- **THEN** stderr SHALL 随后包含顶层异常 stack 和底层解析原因

#### Scenario: 默认模式隐藏内部链

- **WHEN** 相同失败未启用 `--debug`
- **THEN** stderr SHALL 不输出 stack 或 `cause` 链

#### Scenario: 异常 cause 形成循环

- **WHEN** 调试模式遇到循环引用的异常 `cause` 链
- **THEN** CLI SHALL 有界终止诊断输出而不是无限循环

### Requirement: CLI 输出通道和退出码保持兼容

Node CLI 成功时 SHALL 仅将生成摘要写入 stdout 并以退出码 `0` 结束；运行失败时 SHALL 将诊断写入 stderr 并以退出码 `1` 结束；命令行参数使用错误 SHALL 将用法写入 stderr 并以退出码 `2` 结束。`--debug` SHALL 能够单独使用或与 `--config <path>` 组合使用，且参数顺序不影响行为。

#### Scenario: 成功运行

- **WHEN** 配置和所有 OpenAPI 文档有效且发布成功
- **THEN** CLI SHALL 在 stdout 输出生成摘要、保持 stderr 为空并以退出码 `0` 结束

#### Scenario: 运行失败

- **WHEN** 配置已被接受但读取、解析、生成或发布失败
- **THEN** CLI SHALL 保持 stdout 为空、向 stderr 输出诊断并以退出码 `1` 结束

#### Scenario: 参数无效

- **WHEN** 用户传入未知参数、缺少 `--config` 值或重复冲突参数
- **THEN** CLI SHALL 向 stderr 输出包含 `--debug` 和 `--config <path>` 的用法并以退出码 `2` 结束

### Requirement: 默认诊断避免披露敏感输入

默认诊断 MUST NOT 包含 OpenAPI 文档正文、HTTP 请求头或远程 URL 的用户名、密码、查询参数和片段。若诊断展示远程来源，最多 SHALL 展示协议、主机、端口和路径；调试模式属于用户显式请求的内部诊断，可包含底层异常原文。

#### Scenario: 带凭证和查询参数的远程来源失败

- **WHEN** 配置的远程 URL 包含用户名、密码、查询参数或片段且读取失败
- **THEN** 默认 stderr 诊断 SHALL 不包含这些敏感 URL 组成部分

#### Scenario: 文档正文含敏感值

- **WHEN** 非法 JSON 附近包含口令或令牌文本
- **THEN** 默认 stderr 诊断 SHALL 只报告错误类型和位置，不回显错误位置附近的文档片段

### Requirement: 诊断增强不改变库边界和原子发布

Node 库入口 SHALL 继续通过 Promise rejection 或抛出错误向调用方报告失败，并 MUST NOT 自行写入 stdout 或 stderr。任何新增诊断处理 MUST NOT 在输入、解析、校验、生成或发布失败时替换已有 Skill 或发布部分输出。

#### Scenario: 以库方式调用失败

- **WHEN** 调用方直接调用导出的 `run` 或生成函数且操作失败
- **THEN** 调用方 SHALL 收到错误而不是被库实现写入控制台

#### Scenario: 解析失败时已有 Skill 不变

- **WHEN** 已发布完整 Skill 后的下一次 CLI 运行发生 JSON 解析失败
- **THEN** 本次运行 SHALL 输出诊断并以退出码 `1` 结束
- **THEN** 已发布 Skill 的文件树 SHALL 保持逐字节不变
