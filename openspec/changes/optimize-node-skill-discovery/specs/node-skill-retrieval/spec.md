# Spec Delta

## Purpose

让 Node 生成的 API Skill 支持有界、可重复的本地接口检索，减少重复契约和无关引用读取，并通过质量报告和可复现成本基准验证发现效率，始终保留完整接口事实与来源。

## ADDED Requirements

### Requirement: 本地搜索返回完整计数和有界候选

系统 SHALL 提供库函数和 CLI 搜索生成后的 v4 Skill，不访问网络。搜索 SHALL 支持 query、service、document、limit、offset，精确 method/path 或 operationId 优先，普通空格分隔词按 AND 匹配，接口字段优先于范围关键词。返回 SHALL 包含 total、hasMore 和含归属/直达文件的候选，默认 10 条、最多 100 条；排序稳定。非法参数和损坏索引 MUST 明确失败。

#### Scenario: 宽关键词命中大量接口
- **WHEN** 关键词覆盖 150 个接口且 limit=10
- **THEN** 返回 10 条、total=150、hasMore=true，后续 offset 页无重复或遗漏

#### Scenario: 旧版输出和重名来源
- **WHEN** 搜索旧 v4 输出且 operationId 在多个来源重复
- **THEN** 可返回全部匹配来源并按 service/document 收窄，不合并同名契约

### Requirement: 生效契约消除可重建重复参数

系统 SHALL 保留生效 parameters、servers、security、请求响应与示例；只在原始参数与生效参数结构相同时省略副本并标注来源位置。引用、覆盖差异、显式空值 MUST 可解释且保留。

#### Scenario: 相同参数重复出现
- **WHEN** operation.parameters 与生效 parameters 相同
- **THEN** 只展示一份参数并标明被省略副本的位置

#### Scenario: 路径参数被操作覆盖
- **WHEN** pathItem.parameters 与 operation.parameters 定义同一参数且 required 不同
- **THEN** 保留覆盖前差异、生效值及来源，不把 required 与 nullable 合并

### Requirement: 引用按任务用途标记

系统 SHALL 保留完整直接/传递引用集合，并标明请求和响应用途，使用户可选择所需 Schema；共同引用 SHALL 同时标记，递归 SHALL 有界终止。

#### Scenario: 只查看请求字段
- **WHEN** 请求和响应引用独立 Schema
- **THEN** 请求相关直接和传递引用可独立识别，无需先打开响应 Schema

### Requirement: 显式别名及非阻断质量信息

系统 SHALL 接受按文档和 method/path 配置的接口别名，拒绝未知接口或非法配置，不生成推测同义词。系统 SHALL 输出稳定结构的缺 summary、请求体缺结构诊断；质量诊断 MUST NOT 阻止有效文档发布或导致库写控制台，也不复制原始描述和示例。

#### Scenario: 缺少 summary 的接口配置中文别名
- **WHEN** 一个有英文路径而没有 summary 的接口配置中文别名
- **THEN** 中文可匹配该接口，质量报告仍标记缺 summary，不修改源契约

### Requirement: 可复现检索成本验证

项目 SHALL 提供确定性基准，输出固定问题的目标命中、候选数、读取文件数、字节数与指定 tokenizer 的 token 数；保持 fixture 与排序稳定，MUST 区分代理指标与真实 LLM 评测。真实项目输入 SHALL 可选且不进入发布包。

#### Scenario: 重复执行基准
- **WHEN** 用相同输入、问题与 tokenizer 运行两次
- **THEN** 指标一致；紧凑索引覆盖全部接口且重复关键词 fixture 的字节与 token 开销小于旧索引
