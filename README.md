# openapi-skill

**简体中文** | [English](README.en.md)

将运行中 Spring Boot 服务的 OpenAPI 文档转换为前端开发可使用的 Skill ZIP。服务启动后访问一个只读接口，
即可下载包含接口目录、请求响应契约和 Schema 引用的完整 Skill；不再为 OpenAPI Skill 修改 Maven phase、启动第二个
应用进程、通过 HTTP 抓取 `/v3/api-docs`，也不在构建目录生成中间文件。

## 功能与边界

- **纯运行时下载**：加入 Starter 后自动提供 `GET /openapi-skill/skill.zip`，每次请求基于当前运行实例生成。
- **自动发现**：直接复用 SpringDoc 最终文档资源；自动枚举 `GroupedOpenApi`，无需重复配置 OpenAPI URL。
- **可配置输出**：运行时默认一应用一 Skill；Node CLI 可将显式配置的多个服务汇总为一个项目 Skill。
- **保留契约**：保留参数、请求体、响应、媒体类型、认证定义和 Schema 数据，提供语义化接口 ID、机器索引和本地引用导航。
- **无磁盘副作用**：生成结果先完整校验，再确定性地内存打包；相同契约得到相同 ZIP 字节。
- **本地转换**：核心不调用 LLM、业务接口或外部引用地址；源文档自由文本与可信 Skill 指令分离。
- **明确输入**：接受 `openapi: 3.0.x` 与 `3.1.x` 的 JSON（根标记写成其他版本一律拒绝）；生产文档来源限定为 SpringDoc / NextDoc4j。Java 包扫描和文档导出由文档生产工具负责。

当前不支持 YAML、Swagger 2.0、其他 OpenAPI 版本、外部引用、全量 OpenAPI 规范校验、自动跨项目安装/同步、
WebFlux 或跨服务运行时汇总。仓库中的运行时集成证据来自 SpringDoc WebMVC 测试服务。

## Vue 3 / Node.js 项目生成 Skill

`openapi-skill-node` 当前源码版本与 npm `latest` 均为 `openapi-skill@2.1.2`。
它推荐一个前端项目只生成一份接口文档
Skill，并使用按 OpenAPI `tags` 分组的分组索引 `context.md`、每个 tag 一个可读名称的接口文件（中文 tag 名直接保留）、
无冲突纯语义文件名、预计算引用闭包和集中 conventions；
JSONL 仅保留为机器校验索引。多个微服务、每个服务的
多个文档分组以及第三方服务都组织在同一个自包含目录中。默认 Skill 名为
`api-docs`，输出到 Vue 项目根目录的 `.agents/skills/api-docs/`。

```shell
npm install --save-dev openapi-skill
```

在项目根目录创建 `openapi-skill.config.json`：

```json
{
  "keywords": ["接口文档", "前后端联调"],
  "services": [
    {
      "serviceId": "account-service",
      "sourceType": "internal",
      "keywords": ["用户", "账号"],
      "documents": [
        {
          "id": "account",
          "url": "http://127.0.0.1:18080/v3/api-docs/account",
          "keywords": ["登录", "用户资料"]
        }
      ]
    },
    {
      "serviceId": "logistics-provider",
      "sourceType": "third-party",
      "keywords": ["物流", "快递"],
      "documents": [
        {
          "id": "shipping",
          "url": "https://api.example.com/openapi.json",
          "keywords": ["运单", "轨迹"]
        }
      ]
    }
  ]
}
```

将 `"skill:generate": "openapi-skill"` 加入 `package.json#scripts`，执行 `npm run skill:generate`。
根级、服务级和文档级 `keywords` 分别用于发现项目 Skill、选择服务和定位文档；`sourceType` 支持
`internal`（默认）与 `third-party`。生成结果物理包含所有服务的引用文件，通过 Skill 内的相对 Markdown
链接分层导航，不依赖文件系统符号链接或其他已安装 Skill。

工具会先下载和校验全部服务的全部文档，再一次性替换完整 `api-docs` 目录。任一成员失败时保留上一份
完整结果，不发布缺服务的部分 Skill。`skillName`、`output` 和 `timeoutMs` 均可在根级覆盖；旧版
`serviceId + skillName + documents` 单服务配置继续兼容。完整配置和迁移示例见
[Node 包中文 README](openapi-skill-node/README.md)；[English](openapi-skill-node/README.en.md)。

## 版本与环境

改名后的首个版本为 `1.0.0`，npm 包与 Maven Central 制品均已由维护者手动发布。已发布的 `2.0.0` 把生成产物布局
从 `openapi-skill-core/1`、`openapi-skill-core/2` 升级为 `openapi-skill-core/3`，npm 与 Maven Central 两侧均已上线。
Maven 源码线当前为 `2.1.0-SNAPSHOT`，新增 OpenAPI 3.0.x 输入支持；该改动不改变现有 3.1 输入的产物。
对于 SpringDoc 应用，推荐使用运行时 Starter。

| 构件 | 用途 |
| --- | --- |
| `io.github.fyuanz:openapi-skill:2.0.0` | 父 POM |
| `io.github.fyuanz:openapi-skill-core:2.0.0` | 离线转换与安全输出 |
| `io.github.fyuanz:openapi-skill-spring-boot-starter:2.0.0` | 运行时自动发现与 ZIP 下载 |

使用 JDK 17 和 Maven；已验证环境为 Maven 3.9.16 / JDK 17.0.19。仓库集成验证脚本使用 PowerShell。示例服务使用 Spring Boot 3.5.9 和 springdoc 2.8.15。

## 快速体验

克隆仓库后，在仓库根目录执行：

```shell
git clone https://github.com/fyuanz/openapi-skill.git
cd openapi-skill
mvn -B install
mvn -B -f testbeds/springdoc-multi-package/pom.xml clean verify
```

第一条命令将当前源码安装到本地 Maven 仓库，第二条只执行普通测试和打包，不包含 OpenAPI Skill 的应用启停、OpenAPI 抓取或文件生成。
测试会在随机端口验证运行时 ZIP 接口，详见[测试服务说明](testbeds/springdoc-multi-package/README.md)。

手动体验时启动应用：

```shell
mvn -B -f testbeds/springdoc-multi-package/pom.xml spring-boot:run
```

随后下载 `http://127.0.0.1:18080/openapi-skill/skill.zip`。该样例 ZIP 包含 account/business 两组、4 个接口和
7 个文档内 Schema。

## 推荐：接入运行时 Starter

目标 Spring Boot WebMVC 服务已有 SpringDoc 且输出受支持的 OpenAPI `3.0.x` / `3.1.x` 时，只增加依赖：

```xml
<dependency>
    <groupId>io.github.fyuanz</groupId>
    <artifactId>openapi-skill-spring-boot-starter</artifactId>
    <version>1.0.0</version>
</dependency>
```

无需 OpenAPI Skill Maven plugin、execution、phase、OpenAPI URL、文档目录或输出目录。项目不再提供 Maven
构建期兼容插件。应用启动后访问
`GET /openapi-skill/skill.zip` 即可下载。Starter 自动执行：

- 从 `GroupedOpenApi` Bean 枚举与 Swagger UI 对应的分组；无分组时使用默认文档。
- 调用 `MultipleOpenApiWebMvcResource` / `OpenApiWebMvcResource` 在进程内取得扫描 Controller 后的最终 JSON。
- 将当前文档交给 core 转换和校验，在内存中生成带 `<skillName>/` 顶层目录的确定性 ZIP。
- 用 `spring.application.name` 自动派生安全的 serviceId，Skill 名默认为 `<serviceId>-api`。

直接注入业务代码中的基础 `OpenAPI` Bean 并不等于完整文档：它通常只有手工定义的 Info、Components、Servers，
而 `paths` 是 SpringDoc 资源在运行时扫描和组装的；`GroupedOpenApi` 同样只是分组规则。因此 Starter 使用最终资源，
但不会对本机发 HTTP 请求。

以下覆盖项全部可选：

```properties
openapi.skill.runtime.enabled=true
openapi.skill.runtime.path=/openapi-skill/skill.zip
openapi.skill.runtime.service-id=my-service
openapi.skill.runtime.skill-name=my-service-api
```

下载接口沿用应用已有的 Spring Security 规则；受限契约应显式保护该路径。完整说明见
[Starter README](openapi-skill-spring-boot-starter/README.md)。

## 在前端项目中使用

下载 ZIP 后，将其中的**整个 Skill 目录**解压到前端项目的 `.agents/skills/`，保留所有引用文件：

```text
<frontend-project>/.agents/skills/my-service-api/
├── SKILL.md
└── references/
    ├── catalog.md
    ├── source.json
    └── documents/
        └── <文档>
            ├── context.md        # 分组索引，先读这里
            ├── groups/           # 每个 OpenAPI tag 一个文件，文件名即 tag
            ├── operations/
            └── schemas/
```

然后在前端项目中尝试以下任务，并确认所用 Agent 实际发现并使用了该 Skill：

```text
使用 my-service-api Skill，找到创建订单接口，解释必填字段，
并按项目现有请求封装生成调用代码。标明服务与文档分组，缺失的契约信息不要猜测。
```

使用仓库样例时，将名称替换为 `springdoc-multi-package-api`。样例描述虚构测试服务，其服务器地址和认证元数据不代表业务生产环境。

后端接口变化后重新下载并整体替换旧 Skill，避免残留已删除接口。运行时端点不写 `target/`，也不会自动同步前端副本。

## 运行时故障排查

| 现象 | 检查方式 |
| --- | --- |
| 下载接口 404 | 确认 Starter 依赖已进入运行时 classpath，且 `openapi.skill.runtime.enabled` 未设为 `false` |
| 下载接口 500 | 检查 SpringDoc 是否启用、最终 JSON 是否为受支持的 OpenAPI `3.0.x` / `3.1.x`，以及本地 `$ref` 是否完整 |
| ZIP 名称不符合预期 | 设置 `spring.application.name`，或覆盖 `openapi.skill.runtime.service-id` / `skill-name` |
| 有 Spring Security 时 401/403 | 按项目安全策略授权下载路径；不要为了下载公开受限 API 文档 |

运行时生成没有旧文件回退：请求成功即返回一份完整校验后的 ZIP，请求失败则返回服务错误且不产生半成品。

## 开发与验证

从仓库根目录运行：

```shell
mvn -B clean test
mvn -B -f testbeds/springdoc-multi-package/pom.xml test
```

运行时集成验证独立于根单元测试：

```powershell
powershell -NoProfile -File testbeds/springdoc-multi-package/verify-generated-integration.ps1
```

SpringDoc 脚本验证普通构建中没有应用启停、HTTP 抓取或 OpenAPI Skill Maven goal，并在随机真实端口下载、检查 ZIP。

`1.0.0` 增加运行时 Starter 单文档/多分组测试和 6 项测试服务验证；最新结果见
[任务记录](docs/codex/TASKS.md)。Skill 使用效果仍由用户人工校验后反馈。

## 项目结构与文档

| 路径 | 内容 |
| --- | --- |
| [openapi-skill-core](openapi-skill-core/) | 输入校验、契约转换、安全发布 |
| [openapi-skill-spring-boot-starter](openapi-skill-spring-boot-starter/) | 运行时 SpringDoc 发现、转换与 ZIP 下载 |
| [SpringDoc 测试服务](testbeds/springdoc-multi-package/) | 多包、多分组示例与运行时验证 |
| [设计文档](docs/openapi-skill-design.md) | 运行时与 Node 项目 Skill 主链路 |
| [发布与使用](docs/maven-central.md) | Maven Central 配置与维护者发布流程 |
| [任务状态](docs/codex/TASKS.md) | 已完成工作、验证证据与后续计划 |

## 许可证

[MIT](LICENSE)
