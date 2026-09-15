# SmartDoc-Agent 产品与架构设计

> 版本：3.8.0
> 日期：2026-09-15
> 状态：运行时 Starter 主链路已验证；Node 1.4.0 多服务 project Skill 通过 23 项测试，并在真实 Vue 消费者中完成打包与端到端生成验证，尚未发布

本版保留运行时下载主链路，并为前端/Node 项目增加一个自包含 API 文档 Skill：显式配置多个内部或第三方
服务及其文档，完整下载、生成并原子安装到项目。历史范围和被取代的构建期决策保留在
`codex/DECISIONS.md`。

## 1. 产品目标

运行中的 Spring Boot 服务提供一个类似 OpenAPI 文档端点的只读接口，将当前 SpringDoc 文档转换成可直接
安装的 Skill ZIP。接入方只增加 Starter 依赖；不配置 Maven execution/phase，不启动第二个应用进程，
不进行 HTTP 自请求，也不在构建目录落 OpenAPI 或 Skill 中间文件。

Vue 3 或其他 Node.js 项目可使用 `smartdoc-agent` CLI/库，显式配置一个或多个服务及每个服务的 OpenAPI URL，
在本项目生成一个 Skill。Skill 默认命名为 `api-docs`，服务内容全部物理包含在其中，不要求另外安装服务级
Skill，也不使用文件系统符号链接。

运行时链路支持 Java 17、Spring Boot WebMVC 3.5.x、SpringDoc 2.8.x；Node 包要求 Node.js 20+。两条链路
都只接受精确 `openapi: 3.1.0` JSON。转换过程不调用 LLM、业务接口或外部 `$ref`，不解析 Swagger UI HTML。

## 2. 运行时主流程

```text
GET /smartdoc/skill.zip
  → 从 SpringDoc 配置和 GroupedOpenApi Bean 发现当前文档分组
  → 在同一 JVM 内调用 OpenApiWebMvcResource / MultipleOpenApiWebMvcResource
  → 得到 SpringDoc 扫描 Controller 后的最终 OpenAPI JSON
  → core 分文档解析、保留契约和本地引用、生成完整 Skill 文件集
  → 完整校验后确定性地内存打包 ZIP
  → Content-Disposition 下载 <skillName>.zip
```

只有收到下载请求时才生成。普通 `compile`、`test`、`package`、`verify` 不因 SmartDoc 启停应用、抓取文档
或写生成目录。运行时生成失败只影响本次 HTTP 请求，不会影响此前构建，也不会返回半个 ZIP。

## 3. Node 项目 Skill 流程

推荐配置使用 `services`：

```json
{
  "skillName": "api-docs",
  "keywords": ["接口文档", "项目 API"],
  "services": [
    {
      "serviceId": "orders",
      "sourceType": "internal",
      "keywords": ["订单", "交易"],
      "documents": [
        {
          "id": "public",
          "url": "http://127.0.0.1:18080/v3/api-docs/orders",
          "keywords": ["创建订单", "订单查询"]
        }
      ]
    },
    {
      "serviceId": "shipping",
      "sourceType": "third-party",
      "keywords": ["物流"],
      "documents": [
        {
          "id": "tracking",
          "url": "https://shipping.example/openapi.json",
          "keywords": ["轨迹", "运单"]
        }
      ]
    }
  ]
}
```

省略 `skillName` 时使用 `api-docs`。`sourceType` 只允许 `internal` 或 `third-party`，默认 `internal`。项目、
服务和文档均可配置关键词；关键词是用户明确提供的可信别名，不从 OpenAPI 标题、摘要或描述自动推导。
每层最多 16 个关键词，每个为 1-64 个可打印字符；生成前进行 trim、NFC 规范化、去重和稳定排序。

```text
读取并校验完整配置
  → 在一个共享超时和 32 MiB 项目预算内下载全部文档
  → 按 serviceId/documentId 独立解析 OpenAPI 3.1.0
  → 生成一个完整 project Skill 到 staging
  → 校验 provenance、路径、链接、边界和唯一根 SKILL.md
  → 原子替换 .agents/skills/<skillName>
```

任何服务或文档下载、解析、生成或发布失败，都保留上一份完整 Skill，不发布新旧混合结果。项目最多包含
32 个服务、合计 32 份文档、32 MiB 输入、10,000 个输出文件和 64 MiB 输出；每份文档仍最多 8 MiB。

生成目录为：

```text
<skillName>/
├── SKILL.md
└── references/
    ├── catalog.md
    ├── source.json
    └── services/
        └── <serviceId>/
            └── references/
                ├── catalog.md
                ├── source.json
                └── documents/<documentId>/...
```

根 `source.json` 使用 `smartdoc-agent-core/2`、`kind=project`，保存排序后的服务 provenance 和带
serviceId/sourceType 的扁平文档索引。每个服务的原始 core/1 provenance 同时保留在自己的 reference 子树。
根 catalog 通过相对 Markdown 链接进入服务 catalog；成员文件是物理包含，不是操作系统软链接。

旧的顶层 `serviceId` + `skillName` + `documents` 配置继续受支持，并保持 `smartdoc-agent-core/1` 单服务
格式；旧结构仍要求显式 `skillName`，且不能与 `services` 同时出现。

## 4. 为什么不直接注入 `OpenAPI` Bean

应用自定义的 `OpenAPI` Bean 通常是 SpringDoc 的基础输入，包含 `Info`、`Components`、`Servers` 等手工配置；
它不保证已经包含扫描 Controller、路由和注解后形成的完整 `paths`。`GroupedOpenApi` 也只是分组过滤规则，
不是该组最终文档。

因此 Starter 自动枚举 `GroupedOpenApi`，但从 SpringDoc 的最终 WebMVC 资源取 JSON：

- 有分组时按组名调用 `MultipleOpenApiWebMvcResource`，等价于各 `/v3/api-docs/{group}` 的内容。
- 无分组时调用 `OpenApiWebMvcResource`，等价于默认 `/v3/api-docs`。
- 使用当前请求派生的文档请求上下文，使 SpringDoc 的 server URL 计算保持原端点语义。
- 不经过网络栈，不依赖监听地址、端口、TLS 证书、反向代理 Host 或 Swagger UI 页面。

下载 Controller 标记为 OpenAPI hidden，避免 `/smartdoc/skill.zip` 递归进入生成的业务 Skill。

## 5. 最少配置契约

默认只需要依赖：

```xml
<dependency>
    <groupId>io.github.fyuanz</groupId>
    <artifactId>smartdoc-agent-spring-boot-starter</artifactId>
    <version>1.2.0</version>
</dependency>
```

`spring.application.name` 自动规范化为安全的 `serviceId`，默认 Skill 名为 `<serviceId>-api`。未设置应用名时
使用 `application`。分组名规范化为稳定 `documentId`；规范化冲突以数字后缀隔离。

以下配置全部可选：

| 配置 | 默认值 | 用途 |
| --- | --- | --- |
| `smartdoc.runtime.enabled` | `true` | 关闭运行时端点 |
| `smartdoc.runtime.path` | `/smartdoc/skill.zip` | 覆盖下载路径 |
| `smartdoc.runtime.service-id` | 从 `spring.application.name` 派生 | 覆盖服务身份 |
| `smartdoc.runtime.skill-name` | `<serviceId>-api` | 覆盖 ZIP、顶层目录和 Skill 名 |

身份仍使用小写字母、数字和连字符，最长 63 字符并避开 Windows 保留名。显式覆盖值不静默改写，非法值由
core 拒绝；自动派生值会安全规范化。

## 6. ZIP 与 Skill 内容

ZIP 文件名是 `<skillName>.zip`，内部有唯一顶层目录：

```text
<skillName>/
├── SKILL.md
└── references/
    ├── catalog.md
    ├── source.json
    └── documents/
        └── <documentId>/
            ├── context.md
            ├── operations/*.md
            ├── schemas/*.md
            └── tags/*.md
```

- `SKILL.md` 是固定受信模板；OpenAPI 自由文本只进入不受信 references。
- catalog 可按文档、method/path、operationId、摘要和 tag 找到接口。
- operation 保留参数覆盖、请求体/媒体类型、响应、servers、安全和原 JSON。
- Schema 保留字段、必填/可空、枚举、约束、组合、数组和本地引用。
- `source.json` 记录服务、Skill、完整分组、版本、摘要和数量。
- 本地 `$ref` 按源文档隔离；共享、多级、递归引用以链接表达，不跨文档猜测或合并。

core 的输入/输出、引用深度和文件数上限继续生效。文件按稳定路径排序，ZIP entry 使用固定时间；同一运行时
契约、身份和生成器版本得到相同 ZIP 字节。ZIP 在内存生成，不写 `target/`。

## 7. 服务、多分组与微服务边界

运行时 Starter 的所有 SpringDoc 分组共同组成当前应用的一份 Skill。一组失败则本次下载整体失败，不发布
缺组 ZIP。同名 Schema、路径和认证定义按 documentId 隔离。

每个微服务可独立加入 Starter 并提供自己的下载接口。跨服务运行时汇总需要一个可信协调服务、成员发现、
鉴权和新鲜度契约，本版 Starter 不自动远程抓取，也不把 Swagger UI 的外部 URL 清单当成授权。

Node project 模式解决的是不同边界：项目所有者显式列出允许下载的服务和文档 URL，CLI 在本地把这些输入
生成一个项目 Skill。它不进行服务发现，也不声称多个服务处于同一发布版本。所有成员只共享一次原子生成，
OpenAPI 语义、servers、安全定义、同名 Schema 和 `$ref` 始终按 serviceId/documentId 隔离。内部服务和第三方
服务使用同一生成逻辑，`sourceType` 只记录来源边界和导航语义。

已发布 Maven 插件的显式本地 JSON `aggregate` / `both` 能力继续作为兼容入口；它与 Node project 模式拥有
不同的配置、采集和发布生命周期。

## 8. 安全与运行边界

- 下载接口沿用应用的 Spring Security 过滤链；SmartDoc 不绕过认证。受限契约必须显式限制访问。
- Starter 只调用同一应用上下文中的 SpringDoc 资源，不接受请求参数形式的任意 URL，因而不引入 SSRF 入口。
- Node CLI 只访问项目配置中逐项声明的 HTTP(S) URL，拒绝重定向；配置文件属于受信项目配置，不提供网页
  请求参数、Swagger UI URL 清单或注册中心驱动的任意抓取。
- API 文档必须由应用明确启用；最终 JSON 不是精确 3.1.0、含悬空/外部引用或超过上限时请求失败。
- Node project Skill 在内存和 staging 中都校验路径、大小写碰撞、链接、provenance、唯一入口和文件上限；
  读取已有输出时拒绝符号链接及其他特殊文件。用户关键词经过独立的字符、长度和数量约束。
- 当前将完整 Skill 和 ZIP 保存在单次请求内存中，适合 core 已有 64 MiB 输出上限；不提供包仓库或长期缓存。
- 当前适配 Servlet/WebMVC；WebFlux、独立 management port 文档资源和不同 SpringDoc 主版本需要单独验证。

## 9. Maven 插件兼容边界

`smartdoc-agent-maven-plugin` 不删除，继续服务两类已有场景：

1. 版本控制的静态权威 OpenAPI JSON，需要离线生成目录。
2. 显式协调的跨服务 `aggregate` / `both`，成员 JSON 已安全准备到本地。

它不再是 SpringDoc 运行时应用的推荐接入。旧测试继续验证安全发布、失败保留、并行隔离和汇总；新的 SpringDoc
测试服务已删除 Boot `start/stop`、springdoc Maven capture 和 SmartDoc goal 配置，证明主链路不侵入构建。

## 10. 工程边界

| 模块 | 职责 | 当前状态 |
| --- | --- | --- |
| `smartdoc-agent-core` | OpenAPI 3.1.0 解析、契约/引用渲染、文件集校验和旧目录安全发布 | 63 项测试通过 |
| `smartdoc-agent-spring-boot-starter` | Spring Boot 自动配置、SpringDoc 最终文档发现、运行时转换和 ZIP 下载 | 2 项单/多文档测试通过 |
| `smartdoc-agent-maven-plugin` | 离线文件输入、构建期兼容、独立/汇总输出 | 15 项测试通过 |
| `smartdoc-agent-node` | 显式 URL 下载、core/1 单服务兼容、core/2 多服务 project Skill 和本地原子发布 | 1.4.0 源码；23 项测试通过；真实消费者端到端生成已验证；未发布 |
| `testbeds/springdoc-multi-package` | Swagger UI、两分组真实 HTTP 下载和无构建侵入验证 | 6 项测试通过 |

core 仍不依赖 Spring Boot、SpringDoc、Maven 或 HTTP。运行时适配被隔离在 Starter 模块，SpringDoc 2.8.x
兼容性变化不会污染转换逻辑。Java 最新 Central 版本为 `1.2.0`，Java 开发源码为 `1.3.0-SNAPSHOT`；Node
开发源码为 `1.4.0` 且尚未发布。已发布版本保持不可变。

## 11. 暂不实现

- WebFlux 和其他 SpringDoc/OpenAPI 版本适配。
- 未经项目显式配置的 URL 采集、重定向、外部 `$ref`、Swagger UI HTML 解析。
- Starter 跨服务运行时汇总、注册中心发现、网关、包仓库和对象存储。
- 跨项目自动同步、全局版本协调、锁文件和漂移管理。
- RAG、搜索、AI enrichment、聊天、生成 API 客户端或其他知识源。

实施状态和验证证据维护在 [TASKS.md](codex/TASKS.md)，技术取舍维护在
[DECISIONS.md](codex/DECISIONS.md)。
