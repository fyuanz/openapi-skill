# catalog-interface-discovery Specification

## Purpose

让生成的 API Skill 通过单一接口索引直接定位具有服务和文档归属的完整契约，支持精确路径和业务关键词检索；按需读取请求、响应及引用结构，减少重复导航与无关上下文，同时保持完整来源、稳定路径和安全的数据边界。

## Requirements

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

### Requirement: 检索条目完整且忠于来源

系统 SHALL 保留非空 summary、源 operationId、全部 tags、method/path 和配置 keywords，安全渲染 Markdown 并将自由文本规范化为单行。系统 MUST NOT 推测业务同义词、复制完整契约进索引或静默截断接口记录。

#### Scenario: 缺少 summary 和 operationId
- **WHEN** 接口缺少 summary、operationId 和 tags
- **THEN** 记录仍含 method/path 和来源，使用 untagged 分组

#### Scenario: 其他 tag 和中文检索信息
- **WHEN** 接口包含多个中文 tags 和 Markdown 特殊字符
- **THEN** 索引保留全部检索信息且不会生成来源控制的额外链接或行

#### Scenario: 大量接口仍完整覆盖
- **WHEN** 大量接口完整输出在预算内
- **THEN** 所有接口都在总索引中，无需读取契约全文即可搜索

### Requirement: 导航保留逐级入口

系统 SHALL 将原逐级入口替换为 SKILL.md → index.md → operation.md。所有契约 SHALL 位于 `references/operations/`、`references/schemas/` 或 `references/refs/` 的直接子文件；MUST NOT 输出 services/documents/context/groups 导航树。接口 SHALL 保留生效的参数、servers/security、请求响应契约和完整引用集合。共享 conventions SHALL 可达。

#### Scenario: 从外层定位上传接口
- **WHEN** Agent 在总索引匹配“上传文件”
- **THEN** 可直接打开接口契约，无需先读取服务、文档或分组页
- **AND** 所需 Schema 和引用契约通过接口页的直接链接按需读取

#### Scenario: 模块没有接口
- **WHEN** 文档没有操作
- **THEN** 索引保留文档身份并明确无接口，来源元数据保留该文档

### Requirement: 未命中和多候选具有明确读取指引

SKILL.md SHALL 简短说明用途并优先展示受控配置的业务能力；不从源描述生成受信指令。指引 SHALL 提供精确搜索、动作和实体组合搜索、来源收窄、未命中扩大的可执行示例；保留无需搜索 CLI 的纯文件查找路径。多个候选 MUST 核对归属与契约；MUST NOT 把首条结果当作唯一匹配或一次未命中视为接口不存在。

#### Scenario: 需求匹配多个候选
- **WHEN** 业务需求匹配多个来源
- **THEN** 指引要求收窄服务/文档并比较契约，按需读取相关请求/响应引用

### Requirement: 兼容性和来源数据边界保持不变

系统 SHALL 输出布局版本 `openapi-skill-core/4`，更新所有 Markdown 和机器索引路径，保留 JSONL 的稳定接口身份及引用集合。发布 SHALL 保持原子替换和失败保留，允许替换受支持旧版本输出；Java 聚合 SHALL 继续接受受支持旧服务树，并输出扁平结果。来源文本 SHALL 仅为 references 数据，MUST NOT 提升为 SKILL.md 指令或执行授权。

#### Scenario: 聚合已有服务输出
- **WHEN** Java 输入旧版服务树或新版扁平服务树
- **THEN** 聚合生成完整扁平索引和契约，来源及引用链接有效

#### Scenario: 替换旧布局
- **WHEN** 新版成功发布到已有旧版 Skill
- **THEN** 旧深层文件被完整替换且无残留；失败保留旧完整树

#### Scenario: Node 生成不遗留空工作目录
- **WHEN** Node 发布成功或失败后已清理本次暂存内容，工作目录可正常删除
- **THEN** 系统 SHALL 清理空的 staging、backups 和 .openapi-skill 目录，包括旧版遗留空目录
- **AND** MUST NOT 递归删除其他任务、状态或恢复备份；回滚失败 SHALL 保留备份并报告恢复路径

#### Scenario: 来源文字包含指令式内容
- **WHEN** summary 包含指令式文字
- **THEN** 该文字仅安全地出现在 reference 数据中

#### Scenario: 新目录内容超过输出预算
- **WHEN** 完整输出超过预算
- **THEN** 明确失败且不发布截断或部分树

### Requirement: 生成结果确定且跨实现一致

系统 SHALL 保持 v4 平面契约路径、来源身份、完整接口及引用覆盖与稳定输出。Java 与 Node 对等输入 SHALL 具有等价生效契约和闭包；Node 可使用紧凑 Markdown、可重建的重复参数省略及可选扩展字段，不要求排版或新增 Node 信息逐字一致。

#### Scenario: 改变输入排列
- **WHEN** 相同内容以不同服务、文档、操作顺序输入
- **THEN** Node 输出路径、索引、搜索顺序和质量报告保持一致

#### Scenario: Java 与 Node 使用同一文档
- **WHEN** 两种生成器处理共享 fixture
- **THEN** 接口身份、路径、生效契约和完整引用集合等价，Node 紧凑表示不被误报为事实丢失

#### Scenario: 长名称及同名 Schema
- **WHEN** 名称超长、清洗后冲突或不同来源 Schema 同名
- **THEN** 文件名有界、大小写不敏感下唯一且来源不混合

### Requirement: 本地 CLI 调用不依赖全局命令

Node 生成的 SKILL.md SHALL 说明 CLI 随 npm 包安装而非随 Skill 生成，指导从安装包的项目根目录调用本地脚本，并以当前 Skill 的绝对目录作为搜索目标。MUST NOT 仅因裸命令不在 PATH 中而断言 CLI 不可用。指引 SHALL 区分命令工作目录与 Skill 文件相对路径，保留工具缺失时的文件搜索。

#### Scenario: 本地包存在但未全局安装
- **WHEN** 项目已安装 openapi-skill，而普通 shell 找不到同名命令
- **THEN** 模型按指引调用项目本地脚本获得分页结果，无需全局安装或下载包

#### Scenario: Skill 输出位于自定义目录
- **WHEN** 当前 Skill 目录位于项目之外且路径包含空格
- **THEN** 指引中的绝对目标路径能定位正确 Skill，结果文件路径仍相对该 Skill 目录
