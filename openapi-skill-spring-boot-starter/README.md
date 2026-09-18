# OpenAPI Skill Spring Boot Starter

在 Spring Boot 应用运行期间，从 SpringDoc 的最终文档资源生成当前 API Skill，并通过只读 HTTP 接口下载 ZIP。
它不启动第二个应用进程、不向本机发送 HTTP 请求，也不在 Maven 生命周期中抓取或生成文件。

改名后的首个版本 `1.0.0` 与破坏性的 `2.0.0`（生成布局由 `openapi-skill-core/1` 升级为按 tag 分组的
`openapi-skill-core/3`）均已发布到 Maven Central。源码线当前为 `2.1.0-SNAPSHOT`，新增 OpenAPI 3.0.x 输入支持。
下面示例固定使用已发布的 `1.0.0`：

```xml
<dependency>
    <groupId>io.github.fyuanz</groupId>
    <artifactId>openapi-skill-spring-boot-starter</artifactId>
    <version>1.0.0</version>
</dependency>
```

应用已有 SpringDoc WebMVC 配置并输出精确 OpenAPI 3.1.0 时，无需 OpenAPI Skill 配置。启动后访问：

```text
GET /openapi-skill/skill.zip
```

Starter 使用 `GroupedOpenApi` 枚举与 Swagger UI 相同的本地分组，再调用
`MultipleOpenApiWebMvcResource` 获取各组最终 JSON；没有分组时调用 `OpenApiWebMvcResource` 获取默认文档。
注入的基础 `OpenAPI` Bean 和 `GroupedOpenApi` 规则本身不等于扫描 Controller 后的最终文档。

服务身份默认从 `spring.application.name` 转成安全的小写名称，Skill 名默认为 `<serviceId>-api`。
以下配置都可省略：

```properties
openapi.skill.runtime.enabled=true
openapi.skill.runtime.path=/openapi-skill/skill.zip
openapi.skill.runtime.service-id=my-service
openapi.skill.runtime.skill-name=my-service-api
```

每次请求都读取当前运行时 OpenAPI、转换并在内存中生成 ZIP，不写磁盘。ZIP 含顶层 `<skillName>/`，
可直接解压到消费项目的 `.agents/skills/`。相同运行时契约会产生相同 ZIP 字节。

下载接口使用应用现有的 Spring Security 规则；API 契约敏感时应显式限制该路径。当前实现支持 Servlet/WebMVC、
Spring Boot 3.5.x、SpringDoc 2.8.x 和精确 OpenAPI 3.1.0；WebFlux、跨服务远程汇总和包仓库不在此模块范围内。
