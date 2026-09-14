# SmartDoc-Agent

**简体中文** | [English](README.en.md)

将运行中 Spring Boot 服务的 OpenAPI 文档转换为前端开发可使用的 Skill ZIP。服务启动后访问一个只读接口，
即可下载包含接口目录、请求响应契约和 Schema 引用的完整 Skill；不再为 SmartDoc 修改 Maven phase、启动第二个
应用进程、通过 HTTP 抓取 `/v3/api-docs`，也不在构建目录生成中间文件。

## 功能与边界

- **纯运行时下载**：加入 Starter 后自动提供 `GET /smartdoc/skill.zip`，每次请求基于当前运行实例生成。
- **自动发现**：直接复用 SpringDoc 最终文档资源；自动枚举 `GroupedOpenApi`，无需重复配置 OpenAPI URL。
- **可配置输出**：运行时默认一应用一 Skill；已发布的 Maven 插件仍支持全部服务的完整汇总及两者共存。
- **保留契约**：保留参数、请求体、响应、媒体类型、认证定义和 Schema 数据，提供接口、标签和本地引用导航。
- **无磁盘副作用**：生成结果先完整校验，再确定性地内存打包；相同契约得到相同 ZIP 字节。
- **本地转换**：核心不调用 LLM、业务接口或外部引用地址；源文档自由文本与可信 Skill 指令分离。
- **明确输入**：当前仅接受 `openapi: 3.1.0` 的 JSON；生产文档来源限定为 SpringDoc / NextDoc4j。Java 包扫描和文档导出由文档生产工具负责。

当前不支持 YAML、Swagger 2.0、其他 OpenAPI 版本、外部引用、全量 OpenAPI 规范校验、自动跨项目安装/同步、
WebFlux 或跨服务运行时汇总。仓库中的运行时集成证据来自 SpringDoc WebMVC 测试服务。

## Vue 3 / Node.js 项目生成 Skill

`smartdoc-agent-node` 提供 TypeScript npm 包 `@fyuanz/smartdoc-agent`。在本地后端启动后，它会下载配置的多个
OpenAPI JSON，并生成一份完整 Skill；默认写入 Vue 项目根目录的 `.agents/skills/<skillName>/`。

```shell
npm install --save-dev @fyuanz/smartdoc-agent
```

在项目根目录创建 `smartdoc-agent.config.json`：

```json
{
  "serviceId": "my-service",
  "skillName": "my-service-api",
  "documents": [
    { "id": "account", "url": "http://127.0.0.1:18080/v3/api-docs/account" },
    { "id": "business", "url": "http://127.0.0.1:18080/v3/api-docs/business" }
  ]
}
```

将 `"skill:generate": "smartdoc-agent"` 加入 `package.json#scripts`，执行 `npm run skill:generate`。
配置项 `output` 可覆盖输出父目录，`timeoutMs` 可覆盖默认 30 秒超时。完整说明见
[Node 包 README](smartdoc-agent-node/README.md)。

## 版本与环境

当前正式版本为 `1.2.0`。它新增运行时 Starter，并继续提供 Maven 构建期的单服务/汇总兼容能力；
对于 SpringDoc 应用，推荐使用运行时 Starter。

| 构件 | 用途 |
| --- | --- |
| `io.github.fyuanz:smart-doc-agent:1.2.0` | 父 POM |
| `io.github.fyuanz:smartdoc-agent-core:1.2.0` | 离线转换与安全输出 |
| `io.github.fyuanz:smartdoc-agent-maven-plugin:1.2.0` | Maven `generate-skill` 目标 |
| `io.github.fyuanz:smartdoc-agent-spring-boot-starter:1.2.0` | 运行时自动发现与 ZIP 下载 |

使用 JDK 17 和 Maven；已验证环境为 Maven 3.9.16 / JDK 17.0.19。仓库集成验证脚本使用 PowerShell。示例服务使用 Spring Boot 3.5.9 和 springdoc 2.8.15。

## 快速体验

克隆仓库后，在仓库根目录执行：

```shell
git clone https://github.com/fyuanz/smart-doc.git
cd smart-doc
mvn -B install
mvn -B -f testbeds/springdoc-multi-package/pom.xml clean verify
```

第一条命令安装当前 Snapshot，第二条只执行普通测试和打包，不包含 SmartDoc 的应用启停、OpenAPI 抓取或文件生成。
测试会在随机端口验证运行时 ZIP 接口，详见[测试服务说明](testbeds/springdoc-multi-package/README.md)。

手动体验时启动应用：

```shell
mvn -B -f testbeds/springdoc-multi-package/pom.xml spring-boot:run
```

随后下载 `http://127.0.0.1:18080/smartdoc/skill.zip`。该样例 ZIP 包含 account/business 两组、4 个接口和
7 个文档内 Schema。

## 推荐：接入运行时 Starter

目标 Spring Boot WebMVC 服务已有 SpringDoc 且输出精确 OpenAPI 3.1.0 时，只增加依赖：

```xml
<dependency>
    <groupId>io.github.fyuanz</groupId>
    <artifactId>smartdoc-agent-spring-boot-starter</artifactId>
    <version>1.2.0</version>
</dependency>
```

无需 SmartDoc Maven plugin、execution、phase、OpenAPI URL、文档目录或输出目录。应用启动后访问
`GET /smartdoc/skill.zip` 即可下载。Starter 自动执行：

- 从 `GroupedOpenApi` Bean 枚举与 Swagger UI 对应的分组；无分组时使用默认文档。
- 调用 `MultipleOpenApiWebMvcResource` / `OpenApiWebMvcResource` 在进程内取得扫描 Controller 后的最终 JSON。
- 将当前文档交给 core 转换和校验，在内存中生成带 `<skillName>/` 顶层目录的确定性 ZIP。
- 用 `spring.application.name` 自动派生安全的 serviceId，Skill 名默认为 `<serviceId>-api`。

直接注入业务代码中的基础 `OpenAPI` Bean 并不等于完整文档：它通常只有手工定义的 Info、Components、Servers，
而 `paths` 是 SpringDoc 资源在运行时扫描和组装的；`GroupedOpenApi` 同样只是分组规则。因此 Starter 使用最终资源，
但不会对本机发 HTTP 请求。

以下覆盖项全部可选：

```properties
smartdoc.runtime.enabled=true
smartdoc.runtime.path=/smartdoc/skill.zip
smartdoc.runtime.service-id=my-service
smartdoc.runtime.skill-name=my-service-api
```

下载接口沿用应用已有的 Spring Security 规则；受限契约应显式保护该路径。完整说明见
[Starter README](smartdoc-agent-spring-boot-starter/README.md)。

## 微服务：独立 Skill 与完整汇总共存

下面是 `1.2.0` Maven 插件的兼容能力，适用于仍需离线静态 JSON 或构建期跨服务汇总的项目。
新接入若只需当前应用的 Skill ZIP，优先使用上面的运行时 Starter。

| `outputMode` | 输出 |
| --- | --- |
| `service`（默认） | 单个服务或 `services` 清单中的独立 Skill |
| `aggregate` | 仅一份包含全部配置服务的完整 Skill |
| `both` | 全部独立服务 Skill，加一份完整汇总 Skill |

在唯一协调模块的 `build/plugins` 中配置下面的插件。它必须在两个服务的文档都导出之后运行；通过显式 Maven 模块依赖保证顺序，不能仅把配置放到先执行的父 POM。服务清单不能与顶层单服务 `serviceId`、`skillName`、`documentsDirectory`、`documents` 混用。

```xml
<plugin>
    <groupId>io.github.fyuanz</groupId>
    <artifactId>smartdoc-agent-maven-plugin</artifactId>
    <version>1.2.0</version>
    <inherited>false</inherited>
    <executions>
        <execution>
            <id>update-service-skills</id>
            <phase>verify</phase>
            <goals><goal>generate-skill</goal></goals>
        </execution>
    </executions>
    <configuration>
        <outputMode>both</outputMode>
        <aggregateId>platform</aggregateId>
        <aggregateSkillName>platform-api</aggregateSkillName>
        <requireCurrentBuildDocuments>true</requireCurrentBuildDocuments>
        <services>
            <service>
                <serviceId>orders</serviceId>
                <skillName>orders-api</skillName>
                <documentsDirectory>${project.basedir}/../orders-service/target/generated-openapi</documentsDirectory>
            </service>
            <service>
                <serviceId>billing</serviceId>
                <skillName>billing-api</skillName>
                <documentsDirectory>${project.basedir}/../billing-service/target/generated-openapi</documentsDirectory>
            </service>
        </services>
    </configuration>
</plugin>
```

每项服务也可用前述 `documents` 显式列表替代目录。清单支持 1–32 个服务；`aggregateId` 用于汇总所有权/状态，`aggregateSkillName` 用于汇总目录名，均须与成员身份/输出名称分离。只修改 `outputMode` 即可切换；`service` 模式忽略保留的汇总身份配置。

默认生成：

```text
target/generated-resources/smartdoc/
├── orders-api/             # 独立订单服务 Skill
├── billing-api/            # 独立账单服务 Skill
└── platform-api/           # 唯一完整汇总 Skill
    ├── SKILL.md
    └── references/
        ├── catalog.md
        ├── source.json
        └── services/
            ├── orders/references/
            └── billing/references/
```

汇总目录可以单独复制使用，包含全部接口和引用文件。索引先按服务导航，再选择分组/接口；同名 Schema、路径和认证定义保持隔离，不拼接为一份 OpenAPI，也不猜测网关地址。

- **清单内服务全部必需**：任一成员输入为空、缺失、无效或过期时，汇总失败并保留旧完整结果，不发布缺服务的汇总。
- **独立失败边界**：`both` 中正常服务仍可更新；只有本次成功更新的全部成员才进入汇总。汇总发布失败不撤销单服务结果，多个输出不是一个跨服务事务。
- **超时和规模**：`aggregate` 的全部读取/转换/组装共用一次 `timeoutSeconds`；`both` 对每个服务任务和最后汇总组装分别计时。汇总准备结果和最终产物均受 10000 文件、64 MiB 总量限制。
- **模式切换和删除**：关闭某种输出不会删除已有目录；移除服务后，下一次成功汇总清理其内部引用，但不删除该服务独立 Skill。
- **构建协调**：`both` 由协调模块统一生成独立输出，避免另设重复写入者。已有各服务独立入口时，可另设一个 `aggregate` 入口。只构建单个服务、未执行协调模块时，汇总不会更新。跨仓库输入须先准备为本地 JSON，本工具不自动采集或调度。
- **当前构建检查**：此示例要求所有 JSON 在同次 Maven 会话内重写。静态测试输入可关闭该检查；目录/服务就绪责任仍由调用者承担。

可运行的配置与显式模块依赖见 [skill-set POM](testbeds/maven-plugin-integration/skill-set/pom.xml)。在仓库根目录执行下列脚本，可验证并行构建顺序、三种模式、共存、重复生成及失败保留：

```powershell
powershell -NoProfile -File testbeds/maven-plugin-integration/verify-aggregate.ps1
```

## 在前端项目中使用

下载 ZIP 后，将其中的**整个 Skill 目录**解压到前端项目的 `.agents/skills/`，保留所有引用文件：

```text
<frontend-project>/.agents/skills/my-service-api/
├── SKILL.md
└── references/
    ├── catalog.md
    ├── source.json
    └── documents/
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
| 下载接口 404 | 确认 Starter 依赖已进入运行时 classpath，且 `smartdoc.runtime.enabled` 未设为 `false` |
| 下载接口 500 | 检查 SpringDoc 是否启用、最终 JSON 是否为精确 OpenAPI 3.1.0，以及本地 `$ref` 是否完整 |
| ZIP 名称不符合预期 | 设置 `spring.application.name`，或覆盖 `smartdoc.runtime.service-id` / `skill-name` |
| 有 Spring Security 时 401/403 | 按项目安全策略授权下载路径；不要为了下载公开受限 API 文档 |

运行时生成没有旧文件回退：请求成功即返回一份完整校验后的 ZIP，请求失败则返回服务错误且不产生半成品。
旧 Maven 插件的状态、锁、恢复与警告语义仍见[插件说明](smartdoc-agent-maven-plugin/README.md)。

## 开发与验证

从仓库根目录运行：

```shell
mvn -B clean test
mvn -B -f testbeds/springdoc-multi-package/pom.xml test
```

运行时和旧 Maven 插件集成验证独立于根单元测试：

```powershell
powershell -NoProfile -File testbeds/maven-plugin-integration/verify.ps1
powershell -NoProfile -File testbeds/springdoc-multi-package/verify-generated-integration.ps1
```

SpringDoc 脚本验证普通构建中没有应用启停、HTTP 抓取或 SmartDoc Maven goal，并在随机真实端口下载、检查 ZIP。
Maven 插件脚本继续验证旧兼容入口。

`1.2.0` 增加运行时 Starter 单文档/多分组测试和 6 项测试服务验证；最新结果见
[任务记录](docs/codex/TASKS.md)。Skill 使用效果仍由用户人工校验后反馈。

## 项目结构与文档

| 路径 | 内容 |
| --- | --- |
| [smartdoc-agent-core](smartdoc-agent-core/) | 输入校验、契约转换、安全发布 |
| [smartdoc-agent-spring-boot-starter](smartdoc-agent-spring-boot-starter/) | 运行时 SpringDoc 发现、转换与 ZIP 下载 |
| [smartdoc-agent-maven-plugin](smartdoc-agent-maven-plugin/) | Maven 配置、目录发现、更新入口 |
| [SpringDoc 测试服务](testbeds/springdoc-multi-package/) | 多包、多分组示例与运行时验证 |
| [Maven 集成测试](testbeds/maven-plugin-integration/) | 多服务、重复/并行构建和失败隔离 |
| [设计文档](docs/smartdoc-agent-design.md) | v3.7 运行时主链路与兼容边界 |
| [发布与使用](docs/maven-central.md) | Maven Central 配置与维护者发布流程 |
| [任务状态](docs/codex/TASKS.md) | 已完成工作、验证证据与后续计划 |

## 许可证

[MIT](LICENSE)
