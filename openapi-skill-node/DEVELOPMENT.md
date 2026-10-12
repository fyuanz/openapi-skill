# Node 包开发与检索基准

## 源码职责

```text
src/
  index.ts                 包根导出，保持公共 API
  cli.ts                   可执行入口，路由生成与搜索命令
  application/             生成/搜索命令与 run 编排
  config/                  配置解析、类型、身份和关键词/别名校验
  input/                   OpenAPI 解析、本地/远程读取及搜索元数据读取
  generation/              服务/项目契约、引用图、紧凑契约、布局投影
  discovery/               入口描述、紧凑索引和纯函数搜索
  publication/             原子发布、完整性校验、多输出结果
  diagnostics/             错误规范化及非阻断质量提示
```

配置不依赖生成器。`run` 编排输入读取、纯函数生成和发布，`index.ts` 不承担 IO。文件树校验与磁盘发布分离。旧导航渲染只用于内部服务树和迁移测试，最终发布 v4 直达布局。公共导出从 `openapi-skill` 引入，不依赖内部 `dist` 文件位置。

构建先清理包内 `dist`，再调用 TypeScript，避免模块移动后把旧文件一起打包。启用严格类型及未使用符号检查。测试使用 Node 内置 test runner，tokenizer 只作为开发依赖。

## 验证命令

在包目录执行：

```sh
npm ci
npm test
npm run benchmark
npm pack --dry-run
```

从仓库根运行 `mvn -pl openapi-skill-core -am -Dtest=CatalogDiscoveryTest -Dsurefire.failIfNoSpecifiedTests=false test` 后，在包目录运行：

```sh
node scripts/check-flat-parity.mjs
node scripts/check-java-interop.mjs
```

前者比较 Java/Node 共享 fixture 的接口覆盖、身份、路径、可重建契约和引用集合，允许 Node 排版和可选索引字段不同。后者将 Node 服务输出交给当前 Java 校验器和聚合生成器，验证新增质量元数据不破坏 v4 互通。其临时文件只写入忽略的 Maven target 目录。

## 测量方法

本次变更验证：Node 回归 94/94 通过，Java `CatalogDiscoveryTest` 7/7 通过，语义对等及 Java 聚合互通检查通过，OpenSpec 严格校验通过。`npm pack --dry-run` 确认发布包包含 59 个文件，只有编译产物、包元数据、许可证和文档，没有旧扁平模块或真实项目样本。

固定合成 fixture 有 120 个接口及独立请求/响应 Schema。基准比较旧版逐行关键词布局与新输出，使用 `js-tiktoken@1.0.21`、`cl100k_base`。每个问题记录目标命中、候选总量、首屏命中、分页次数、读取文件数、字节数和 token 数。

旧流程读取 Skill、关键词匹配行、目标接口、共享约定及完整闭包；新流程读取 Skill、分页搜索结果、目标接口、共享约定及任务相关闭包。多个查询各自从空上下文开始；同一查询内文件去重。合成比较使用相同入口，以隔离索引/检索/契约变化。指标衡量进入上下文的文本；不含模型推理、工具协议开销或模型自动缓存，也不是 LLM 命中率评测。`filesRead` 指呈现给读取者的逻辑文件，搜索工具内部另读取两份元数据。

可只读检查已有 Node v4 样本：

```sh
node scripts/benchmark-retrieval.mjs --skill /path/to/api-docs
```

样本模式在内存投影新索引、入口和重复参数；原始 OpenAPI 不可用时，不声称完整重新生成，也不补推请求/响应引用角色。用户样本及其契约不写入仓库或发布包。

## 实际样本结果（2026-10-10）

本地真实样本为 5 份文档、378 个接口、454 个 Schema。只读投影结果：

| 指标 | 优化前 | 优化后 |
| --- | ---: | ---: |
| 索引字节 | 142,205 | 88,559 |
| 索引 token | 48,466 | 25,731 |
| Skill 入口 token | 508 | 485 |
| “用户”查询读取 token | 19,548 | 2,629 |
| “航线”查询读取 token | 23,431 | 3,348 |
| “上传”查询读取 token | 3,423 | 2,972 |
| “登录”查询读取 token | 3,126 | 2,600 |

索引 token 减少 46.9%。五个代表查询（含一个精确路由）均在第一页找到预设目标。宽词搜索的候选总量并未隐藏或截断，收益来自接口词排序与分页返回。此结果不表示任意问题都能获得相同比例的节省；确定性合成基准和完整契约回归共同防止用丢信息换取缩短输出。
