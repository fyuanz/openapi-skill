# Spec Delta

## MODIFIED Requirements

### Requirement: 两层 catalog 提供同源接口检索信息

系统 SHALL 使用唯一 references/index.md 和每接口一个直达链接的单行记录。Node SHALL 将项目、服务、文档关键词分别存放在所属范围摘要，不逐接口复制；接口记录保留归属、summary、method/path、operationId、全部 tags，第一 tag 即分组，无 tags 时标明 untagged。Java 保留既有 v4 输出。空文档 SHALL 明确保留身份。

#### Scenario: 未配置关键词时按接口动作查找
- **WHEN** 接口 summary 是“上传文件”且没有配置关键词
- **THEN** 索引可检索到动作、来源和接口直达链接

#### Scenario: 公共关键词不会重复污染接口行
- **WHEN** 服务关键词为“无人机”且只有 3 个接口自身包含该词
- **THEN** Node 公共词仅出现于范围摘要，其他接口行不因继承而包含该词

#### Scenario: 同名接口属于不同服务或文档
- **WHEN** 不同文档有同名接口且某接口有多个 tags
- **THEN** 各行保留独立来源、全部 tags 及 method/path，不合并或截断

### Requirement: 未命中和多候选具有明确读取指引

SKILL.md SHALL 简短说明用途并优先展示受控配置的业务能力；不从源描述生成受信指令。指引 SHALL 提供精确搜索、动作和实体组合搜索、来源收窄、未命中扩大的可执行示例；保留无需搜索 CLI 的纯文件查找路径。多个候选 MUST 核对归属与契约；MUST NOT 把首条结果当作唯一匹配或一次未命中视为接口不存在。

#### Scenario: 需求匹配多个候选
- **WHEN** 业务需求匹配多个来源
- **THEN** 指引要求收窄服务/文档并比较契约，按需读取相关请求/响应引用

### Requirement: 生成结果确定且跨实现一致

系统 SHALL 保持 v4 平面契约路径、来源身份、完整接口及引用覆盖与稳定输出。Java 与 Node 对等输入 SHALL 具有等价生效契约和闭包；Node 可使用紧凑 Markdown、可重建的重复参数省略及可选扩展字段，不要求排版或新增 Node 信息逐字一致。

#### Scenario: 改变输入排列
- **WHEN** 相同内容以不同服务、文档、操作顺序输入
- **THEN** Node 输出路径、索引、搜索顺序和质量报告保持一致

#### Scenario: Java 与 Node 使用同一文档
- **WHEN** 两种生成器处理共享 fixture
- **THEN** 接口身份、路径、生效契约和完整引用集合等价，Node 紧凑表示不被误报为事实丢失
