# Design

## Context

动机见 proposal.md。Node `generator.ts` 和 Java `SkillGenerator` 已构建带 summary、sourceOperationId、method、path、tags、group 和 documentId 的操作索引。context 仅含第一 tag 分组及数量，分组页才列接口动作。Node `project-generator.ts` 和 Java `AggregateSkillGenerator` 的根 catalog 目前只列服务入口。

Java 聚合接收已生成的服务文件映射，而非原始 OpenAPI；其聚合元数据目前仍标记 core/2，导航文字也仍描述早期 context 内容。这是观察到的现状：本变更更新导航文字，保留已有版本标记和接收范围，不顺带迁移聚合格式。Node 项目及当前服务输出保持 core/3。

## Goals / Non-Goals

**Goals:**

- 相同接口检索信息同时出现在外层及对应服务 catalog，模型无需先猜服务归属。
- 明确按外层 catalog → 服务 catalog → document context → 分组 → 接口逐级查找。
- 在不添加配置和持久索引格式的前提下复用现有数据，保证 Java/Node 检索语义一致。

**Non-Goals:**

- 不实现搜索引擎、向量检索、LLM 关键词生成、词库或语言分词。
- 不展开参数、请求响应、Schema 或整段 description 到 catalog。
- 不删除 context、不将外层入口改成直达接口，不改业务契约、发布流程或包版本。
- 不承诺模型自动触发 Skill，也不保证任意未出现在来源中的同义表达一定命中。

## Decisions

### 1. 两层均保留按文档归属的接口检索信息

外层以服务为块，保留指向服务 catalog 的相对链接；块内按文档和第一 tag 分组列检索条目。服务 catalog 使用相同文档/分组组织，并为文档提供 context 链接。保留分组计数、已有配置 keywords、服务 sourceType 和现有服务级 server/security 事实。

条目采用短行，例如 `上传文件；uploadFile；POST /files`。summary 为主要可读动作，非空 operationId 提供精确名称，method/path 始终存在。每个接口一行，不把不同接口的词合并成没有归属的大词袋。分组展示第一 tag 名称，其他 tags 作为该接口的检索别名。无 tag 使用现有 untagged 规则。空文档有明确无接口说明和 context 链接。

备选：仅上提 tag 名称不足以检索具体动作；仅新增配置 keywords 把维护负担交给用户；外层直链 context 不符合已确认的逐级路径，均不采用。

### 2. 确定性复用已有操作索引

内部检索视图由现有操作索引记录及 provenance 中已有配置 keywords 构建。服务生成与项目/聚合装配共用各语言的小型构建/渲染逻辑；装配阶段读取已生成的 JSONL 机器索引，不反向解析 Markdown，不重新抓取输入，也不新增持久化 JSON 格式。机器索引仍不要求模型阅读。

排序使用明确的服务、文档、分组和操作身份顺序；显示文本去首尾空白、归一行内空白，别名在所属条目内按同一规则去重。路径保持原值并安全渲染，summary/operationId/tags 使用现有 Markdown 转义边界。不同 method/path 或服务/文档下的同名动作保留各自条目，不做全局去重。

不提取 description 中的所谓关键词，也不自动推断“附件”等业务同义词。需要补充别名时仍使用现有受信配置 keywords。

### 3. 兼容已有服务树

Java 聚合从现有索引记录构建外层检索视图，也使用同一视图为嵌入的服务 catalog 补充检索区，避免接收旧服务输出时只有外层得到改进。生成固定标题的检索区，重复装配不重复追加；不得清空已有服务 catalog 的其他内容。对于既有接收范围中不存在 group 字段的记录，以 tags 第一项推导分组，不改变成员接口和 context 文件布局。

保留现有 JSONL/provenance 和版本接受规则。此变更是 Markdown 检索内容的增量增强，不要求提高 core 格式版本或拒绝可替换的旧输出。覆盖性由新生成行为测试验证；通用发布验证继续检验链接和完整树，不用新增必填标记追溯拒绝旧树。

### 4. 入口说明与数据边界

单服务说明从服务 catalog 开始；多服务说明要求先选择外层候选，再读对应服务 catalog，然后 context。已知 method/path 时精确匹配；仅有业务描述时匹配动作、tag 和配置关键词。多个候选时检查各自归属和具体契约，未命中时检查其他候选及分组，不把一次失败当成接口不存在。

导入的文本只放 references，不能进入受信 SKILL.md frontmatter 或指令模板。两层 catalog 明确其内容是 API 来源数据，关键词命中不等于允许执行 API 或可以跨服务合并契约。

## Risks / Trade-offs

- [两层重复增加阅读量] → 仅保留短检索条目，排除契约正文；覆盖全部操作，不静默截断；记录代表性多接口样例的两层字节数并遵守现有总输出预算。超预算明确失败并保留旧输出。
- [缺少自然语言 summary 时检索较弱] → method/path 总能定位，operationId 提供补充；可使用现有配置 keywords，不编造词义。
- [同名服务模块或接口导致误选] → 保留服务、文档、第一 tag 与 method/path 身份，验证多候选不互相覆盖。
- [跨语言或层级内容漂移] → 使用共享输入的行为测试，对照检索记录及相对链接，不要求无关 JSON 缩进字节一致。
- [旧聚合服务 catalog 重复或丢失内容] → 验证幂等补充、原 server/security 事实保留和旧成员接受行为。

## Migration Plan

先增加失败测试，再实现服务及项目/聚合检索区与导航模板，运行验证后同步产品文档。现有配置无需迁移，重新生成即获得两层检索内容；继续使用现有完整树原子替换及失败保留机制。回退生成器后重新生成即可恢复原 catalog。注册表发布及 `release-node-2-1-2` 的变更另行处理。
