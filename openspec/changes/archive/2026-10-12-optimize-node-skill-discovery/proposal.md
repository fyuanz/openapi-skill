# Proposal

## Why

真实样本包含 378 个接口，142 KB 的索引逐行重复公共关键词，搜“无人机”命中全部接口，且 211 个接口重复展示同一组参数。Node 源码平铺且公开入口承担下载与发布编排，增加维护成本。

## What Changes

- Node 索引按项目、服务、文档存放公共关键词，接口行去重并保持完整直达覆盖。
- 缩短入口描述，提供明确的精确搜索、业务搜索、范围过滤和按请求/响应读取引用的流程。
- 默认契约中仅在参数完全一致时省去重复副本；不丢失覆盖、来源引用和其他契约事实。
- 增加无网络的本地搜索 API/CLI，支持来源过滤、稳定排序、分页和总命中数；增加非阻断质量报告与显式接口别名配置。
- 增加确定性检索基准，报告候选数、读取量及指定 tokenizer 的 token 数。
- TS 按配置、输入、生成、检索、发布、诊断职责组织，保持包根导出和 CLI 入口。

## Capabilities

### New Capabilities
- `node-skill-retrieval`: 本地检索、接口别名、契约去重、按用途引用、质量诊断及检索成本基准。

### Modified Capabilities
- `catalog-interface-discovery`: Node 使用分层关键词和紧凑入口；保持 v4 直达布局及跨实现的契约语义，而不要求 Markdown 逐字一致。

## Impact

修改 openapi-skill-node 源码、测试、文档和对等验证脚本；不修改 Java 生成行为，不发布 npm，不改真实样本原件。已完成但未归档的 flatten-skill-interface-navigation 作为 v4 行为基线。新机器索引字段为可选扩展，旧 v4 输出可搜索和替换。真实项目内容不提交到远程。
