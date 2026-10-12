# Design

## Context

见 proposal.md。现有 v4 由旧服务树投影生成，publisher 校验布局、索引和闭包；机器索引可在保持 Markdown 直达导航的同时支持本地搜索。Java 保持原输出，本次以语义对等取代逐字比较。

## Goals / Non-Goals

**Goals:** 降低检索输出量且不降低完整性；纯函数生成和检索；配置/IO/发布分离；单文件保持在 800 行以内。

**Non-Goals:** 向量数据库、联网搜索、自动改写源契约、自动推断同义词、跨服务 Schema 合并、npm 发布。

## Decisions

- `src/index.ts` 只做包根导出，`src/cli.ts` 保持可执行入口；`application/` 编排、`config/` 配置与类型、`input/` 读取/解析、`generation/` 契约与布局、`discovery/` 索引/搜索/入口、`publication/` 发布及校验、`diagnostics/` 错误及质量信息。配置身份校验放独立模块，避免配置依赖生成器。保留根 dist/index.js 与 dist/cli.js，不承诺未公开的深层 dist 路径。
- 项目关键词在索引头、服务关键词在服务摘要、文档关键词在文档摘要各存一次。接口行保留 method/path、summary、operationId、全部 tags（首项代表 group）及独立 service/document 身份；不重复公共关键词。保持行级可搜索性。
- 生效参数不变。仅当原始 operation/pathItem.parameters 与生效 parameters 结构完全相同才省略该副本；显式记录省略字段，差异、引用和覆盖保留。避免双份 raw 文件增加默认读取成本。
- 闭包保留完整集合，每条链接增添 request/response/other 用途标记；递归和共同依赖可有多个用途。机器索引新增可选 requestFiles/responseFiles，与旧 closureFiles 兼容。
- 配置在 document 下新增 operationAliases，以 `METHOD /path` 为键，值为有界关键词数组；未知文档、未知接口键、非法数据均拒绝。别名只进入 references，不进入受信入口指令。
- 非阻断质量报告存 references/source.json 的 quality.findings，稳定代码只报告 owner、method/path、缺 summary、请求体缺结构等信息，不复制自由描述或示例。库与生成 CLI 保持成功 stderr 为空。
- 本地 `search <query> --skill <directory> [--service ...] [--document ...] [--limit ...] [--offset ...]` 读取机器索引与 source.json；精确 method/path、operationId 优先，普通词按 AND 匹配，接口字段高于公共范围关键词。返回紧凑 JSON（候选、总量、hasMore），无契约正文。旧 v4 缺新增字段时正常工作，输入及文件路径有界验证。
- Token 基准使用开发依赖 tokenizer 的明确编码（cl100k_base），不作为运行时依赖；记录其版本与代理读取流程。包含合成固定 fixture 和可选真实样本路径，不提交实际项目契约。测量为确定性检索代理指标，不宣称真实 LLM 成功率。
- 保留 v4 文件结构及兼容读取，通过可选元数据标识紧凑格式。Java 对等检查比较来源、接口覆盖、生效契约与闭包，允许 Node 独有别名/质量报告/排版。检查发现 Java v4 校验拒绝新增根文件，因此质量信息放入既有 source 元数据，不增加文件类型。

## Risks / Trade-offs

真实试用后按用户“常见场景够用”的边界收尾：保留现有空格 AND 和字段权重，不增加中文分词、向量检索或自动同义词。搜索返回的 summary 为最多 160 个 Unicode 码点的预览（含省略号），超过时添加 summaryTruncated=true；匹配排序仍用完整摘要，原索引及契约不变。入口优先说明已安装命令的有界候选查询，纯文件搜索保留为无 CLI 时的替代路径；由 LLM 从需求提取动作/实体关键词。160 是可预测的显示上限，并非 token 上限。

- [紧凑表达丢失原始语义] → 只省略可精确重建的重复参数，覆盖与本地引用测试先行。
- [宽词命中范围内全部接口] → 范围明确、字段权重优先、返回总数与分页，不隐藏剩余候选。
- [移动模块导致打包路径失效] → 清理 dist 后构建，包根 API/CLI 烟测与 npm pack --dry-run。
- [源项目私有数据进入仓库] → 样本仅本地只读使用，提交合成数据及汇总结果。

## Migration Plan

先新增失败测试，再重构并实现。运行完整 Node 测试、基准、打包预检及可运行的语义对等验证；更新双语文档和开发结构说明，提交并普通推送。用户原样本不覆盖，原子发布/失败保留行为不变。
