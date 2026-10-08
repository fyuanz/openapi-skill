# Spec Delta

## MODIFIED Requirements

### Requirement: 两层 catalog 提供同源接口检索信息

系统 SHALL 用唯一的 `references/index.md` 取代两层 catalog。每个操作 SHALL 恰有一条直接链接到接口文件的单行记录，包含服务和文档归属、summary、method/path、源 operationId、全部 tags、第一 tag 分组及适用的已配置 keywords。单服务和多服务 SHALL 使用同一布局。

#### Scenario: 未配置关键词时按接口动作查找
- **WHEN** 操作 summary 为“上传文件”且没有配置 keywords
- **THEN** 总索引包含“上传文件”、来源身份及直达接口的相对链接

#### Scenario: 同名接口属于不同服务或文档
- **WHEN** 多个来源有同名接口
- **THEN** 每条记录独立保留来源和 method/path，并链接各自契约

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

SKILL.md SHALL 指示已知 method/path 或 operationId 时精确搜索总索引，业务描述结合动作、tags、配置 keywords 检索；大索引可文本搜索而不要求全文载入。多个候选 SHALL 核对来源和契约；未命中 SHALL 扩大关键词及来源范围，MUST NOT 将一次未命中视为接口不存在。

#### Scenario: 需求匹配多个候选
- **WHEN** 简短描述命中多个模块
- **THEN** 指引要求比较归属及契约，不默认第一个或合并接口

### Requirement: 兼容性和来源数据边界保持不变

系统 SHALL 输出布局版本 `openapi-skill-core/4`，更新所有 Markdown 和机器索引路径，保留 JSONL 的稳定接口身份及引用集合。发布 SHALL 保持原子替换和失败保留，允许替换受支持旧版本输出；Java 聚合 SHALL 继续接受受支持旧服务树，并输出扁平结果。来源文本 SHALL 仅为 references 数据，MUST NOT 提升为 SKILL.md 指令或执行授权。

#### Scenario: 聚合已有服务输出
- **WHEN** Java 输入旧版服务树或新版扁平服务树
- **THEN** 聚合生成完整扁平索引和契约，来源及引用链接有效

#### Scenario: 替换旧布局
- **WHEN** 新版成功发布到已有旧版 Skill
- **THEN** 旧深层文件被完整替换且无残留；失败保留旧完整树

#### Scenario: 来源文字包含指令式内容
- **WHEN** summary 包含指令式文字
- **THEN** 该文字仅安全地出现在 reference 数据中

#### Scenario: 新目录内容超过输出预算
- **WHEN** 完整输出超过预算
- **THEN** 明确失败且不发布截断或部分树

### Requirement: 生成结果确定且跨实现一致

系统 SHALL 为契约分配含服务和文档命名空间的稳定安全文件名，对超长及冲突名称使用确定性摘要消歧，不依赖 operationId 唯一性。相同输入顺序变化 SHALL 产生相同结果。Java 和 Node SHALL 对等覆盖操作、归属、文件路径和直达导航。

#### Scenario: 改变输入排列
- **WHEN** 输入内容相同但排列变化
- **THEN** 文件名、索引及引用不变

#### Scenario: Java 与 Node 使用同一文档
- **WHEN** 两种生成器使用相同身份和文档
- **THEN** 扁平路径、接口覆盖、归属和链接语义一致

#### Scenario: 长名称及同名 Schema
- **WHEN** 名称超长、清洗后冲突或不同来源 Schema 同名
- **THEN** 文件名有界、大小写不敏感下唯一且来源不混合
