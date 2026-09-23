# Proposal

## Why

当前项目 catalog 主要显示服务身份，服务 catalog 主要显示文档入口和运行事实，业务分组与接口动作藏在更深层文件中。用户只提供简短需求且没有配置完整 keywords 时，模型缺少选择服务和模块的依据。

## What Changes

- 在最外层 `references/catalog.md` 按服务及文档展示分组名称和接口检索线索，链接到对应服务 catalog。
- 在服务 `references/catalog.md` 按文档展示同源检索信息，链接到该文档的 `context.md`。
- 从已有接口 summary、operationId、HTTP method/path、分组及配置 keywords 确定性生成检索信息，不生成业务同义词。
- 保留 context、分组文件和接口详情；同步单服务、Node 项目和 Java 聚合的导航说明，明确逐级匹配及未命中的检查方式。
- 保留 core/3 文件布局和契约边界，增加覆盖性、归属、链接和跨实现一致性验证。

## Capabilities

### New Capabilities

- `catalog-interface-discovery`: 两层 catalog 的接口关键词覆盖、归属隔离、逐级导航和确定性生成。

### Modified Capabilities

无。现有规格覆盖 Node 输入、诊断和多目录发布，不涉及 catalog 内容。

## Impact

影响 Node 的 `generator.ts`、`project-generator.ts`，Java 的 `SkillGenerator`、`AggregateSkillGenerator`，相关测试和生成导航文档。可能抽取小型内部检索信息构建模块；不增加运行时依赖，不改变配置或业务 API，不修改接口契约和 JSONL 机器索引格式。发布及正在进行的 `release-node-2-1-2` 不属于本变更。
