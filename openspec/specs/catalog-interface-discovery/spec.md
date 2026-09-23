# catalog-interface-discovery Specification

## Purpose

让生成的 API Skill 在最外层与服务内的 catalog 中同时提供具有服务和文档归属的接口检索信息，使只有简短业务需求的读取者能够逐级选择服务、模块和 context，再核对分组及具体接口契约，无需预先知道内部服务身份或配置完整关键词。

## Requirements

### Requirement: 两层 catalog 提供同源接口检索信息

系统 SHALL 在多服务 Skill 的最外层 `references/catalog.md` 按服务及文档展示接口检索信息，在嵌入服务的 `references/catalog.md` 按文档展示相同来源的检索信息。系统 SHALL 包含每个有操作的分组名称、接口数量、接口检索条目及已有对应层级配置 keywords；单服务输出 SHALL 提供服务级检索信息。

#### Scenario: 未配置关键词时按接口动作查找
- **WHEN** 一个服务的 business 文档包含 summary 为“上传文件”的操作，且没有配置 keywords
- **THEN** 外层与该服务 catalog 都包含“上传文件”及正确文档和分组归属
- **AND** 读取者无需先打开 context 即可识别候选服务及文档

#### Scenario: 同名接口属于不同服务或文档
- **WHEN** 两个服务或同一服务的不同文档均包含名为“上传文件”的操作
- **THEN** 两层 catalog 保留各自归属与 method/path，不因文本相同而合并或丢失候选

### Requirement: 检索条目完整且忠于来源

系统 SHALL 为每个操作展示非空 summary、非空源 operationId、HTTP method/path 和所属第一 tag 分组，并保留其余 tags 作为检索线索。系统 SHALL 将同一条目内重复别名去重，保持可检索文本并安全渲染 Markdown。系统 MUST NOT 生成来源与配置中不存在的业务同义词、把完整契约复制进 catalog，或静默截掉操作条目。

#### Scenario: 缺少 summary 和 operationId
- **WHEN** 操作没有有效 summary 和 operationId，且没有 tags
- **THEN** 两层检索信息仍包含其 HTTP method/path，并归入现有未分组类别

#### Scenario: 其他 tag 和中文检索信息
- **WHEN** 操作的第一 tag 为“文件管理”，其他 tag 为“附件”，summary 含中文及 Markdown 特殊字符
- **THEN** 操作仅计入“文件管理”分组，保留“附件”和 summary 作为检索信息，特殊字符不会生成额外链接或破坏索引

#### Scenario: 大量接口仍完整覆盖
- **WHEN** 文档包含大量操作且完整输出仍在现有预算内
- **THEN** 两层检索信息包含全部操作，不只保留前若干项

### Requirement: 导航保留逐级入口

多服务 Skill 的系统指引 SHALL 指定外层 catalog → 服务 catalog → 文档 context → 分组 → 接口的查找路径。外层检索块 SHALL 提供对应服务 catalog 的有效相对链接；服务文档块 SHALL 提供对应 context 的有效相对链接。单服务 SHALL 从服务 catalog 开始。系统 SHALL 保留 context 的既有导航职责以及现有服务 catalog 的 server/security 事实。

#### Scenario: 从外层定位上传接口
- **WHEN** 读取者从外层 catalog 匹配“上传文件”
- **THEN** 可依次沿服务 catalog、对应 context、分组和接口文件的本地链接到达该操作
- **AND** 无需读取 JSONL 或使用文件系统全局扫描完成该路径

#### Scenario: 模块没有接口
- **WHEN** 一个输入文档没有操作
- **THEN** catalog 保留文档身份与其导航入口并明确无接口，不虚构检索条目

### Requirement: 未命中和多候选具有明确读取指引

生成的 SKILL.md SHALL 指示已知 method/path 时优先精确匹配，仅有业务描述时结合接口动作、tag 和配置 keywords 筛选。指引 SHALL 要求多个候选时继续核对归属及契约，未命中时检查其他候选文档和分组；MUST NOT 将一次未命中等同于接口不存在。

#### Scenario: 需求匹配多个候选
- **WHEN** 简短业务描述命中两个不同模块
- **THEN** 生成指引要求分别核对候选模块与操作契约，不默认选择第一个或合并契约

### Requirement: 兼容性和来源数据边界保持不变

系统 SHALL 保留既有 context、分组、操作、Schema 文件布局、索引格式、版本接受规则和发布失败保留行为。Java 聚合对原先支持的服务树 SHALL 继续接受，并为外层及嵌入服务提供检索信息。来源自由文本 SHALL 只作为 references 中的数据，不进入受信 SKILL.md 描述或指令；两层 catalog SHALL 明示该数据边界。

#### Scenario: 聚合已有服务输出
- **WHEN** 输入是原先可接受、尚无接口检索区的服务树
- **THEN** 聚合输出在两层 catalog 增加检索信息，保留已有服务事实和契约文件
- **AND** 已有检索区不会因重新装配而重复追加

#### Scenario: 来源文字包含指令式内容
- **WHEN** summary 含有要求执行动作的指令式文字
- **THEN** 该文字仅作为安全渲染的 reference 数据出现，SKILL.md 不将其提升为指令或执行授权

#### Scenario: 新目录内容超过输出预算
- **WHEN** 增加检索信息导致完整生成结果超过现有输出预算
- **THEN** 系统明确报告失败，发布流程保留原完整 Skill，不发布截断或部分目录

### Requirement: 生成结果确定且跨实现一致

系统 SHALL 在输入顺序变化但内容相同时产生稳定的检索顺序与内容。Java 与 Node 对等输入 SHALL 产生等价的操作覆盖、分组计数、归属与逐级导航语义。

#### Scenario: 改变输入排列
- **WHEN** 相同服务、文档和操作以不同输入顺序生成
- **THEN** 对应 catalog 的检索内容和链接保持一致

#### Scenario: Java 与 Node 使用同一文档
- **WHEN** 两种生成器使用相同服务身份与 OpenAPI 文档且没有 Node 专属配置差异
- **THEN** 检索条目、分组计数和归属一致，全部本地导航链接可达
