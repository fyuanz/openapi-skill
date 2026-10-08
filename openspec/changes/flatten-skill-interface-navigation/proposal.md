# Proposal

## Why

当前索引虽已包含接口检索信息，Agent 仍被要求依次读取服务 catalog、文档 context、分组后才到达接口。目录深度和重复导航增加读取成本，需要总索引直接到达完整接口契约。

## What Changes

- **BREAKING**：单服务、Node 项目和 Java 聚合统一生成扁平布局 v4：`references/index.md`、共享 conventions/source、operations/schemas/refs 类型目录。
- 总索引每个接口一行，直接链接契约，保留服务、文档、method/path、summary、operationId、tags、配置 keywords。
- 删除生成结果中的逐级 catalog/context/group 导航；契约保留生效参数、servers/security、完整引用集合。
- 后续补充：Node `skill:generate` 完成后清理空的 `.openapi-skill` 工作目录，保留非空恢复数据；不改变 Java 状态目录。
- 保留机器 JSONL 索引用于验证及聚合，更新其中的路径；兼容旧树替换和 Java 旧服务输入。
- 同步 Node/Java 测试及使用说明，按用户要求准备 Node 2.2.0，说明布局路径变化；只推送源码，不执行 npm 发布。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `catalog-interface-discovery`：扁平文件、单一接口索引直达、稳定命名及旧输出迁移取代多层 catalog 导航。

## Impact

影响 Node 生成器、发布校验器、Java 生成/聚合/校验、相关测试和双语说明。配置和 OpenAPI 输入保持兼容，不增加运行依赖；旧路径的外部消费者需迁移。
