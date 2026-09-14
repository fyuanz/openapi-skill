# 最小 Spring Boot 运行时测试服务

单服务、四个 Java 包、两个显式 OpenAPI 分组。Java 17，Spring Boot 3.5.9，SpringDoc WebMVC UI
2.8.15；提供 Swagger UI 和 SmartDoc 运行时 Skill ZIP。无数据库、注册中心、网关或 Knife4j，数据均为虚构。

先在仓库根目录安装当前 `1.2.0`，再启动测试服务：

```powershell
mvn -B install
mvn -f testbeds/springdoc-multi-package/pom.xml spring-boot:run
```

服务默认只监听 `127.0.0.1:18080`。启动完成后可访问：

| 用途 | 地址 |
| --- | --- |
| Swagger UI | http://127.0.0.1:18080/swagger-ui.html |
| account OpenAPI | http://127.0.0.1:18080/v3/api-docs/account |
| business OpenAPI | http://127.0.0.1:18080/v3/api-docs/business |
| 当前 Skill ZIP | http://127.0.0.1:18080/smartdoc/skill.zip |

下载文件名为 `springdoc-multi-package-api.zip`，内部含同名顶层目录、`SKILL.md` 和完整 `references/`。
Starter 从 `spring.application.name=springdoc-multi-package` 自动得到 serviceId 和 Skill 名，自动枚举
`GroupedOpenApi` 的 account/business 分组；测试项目没有配置 OpenAPI URL、文档目录、Maven phase 或输出目录。

## 验证

```powershell
mvn -f testbeds/springdoc-multi-package/pom.xml test
powershell -NoProfile -File testbeds/springdoc-multi-package/verify-generated-integration.ps1
```

`OpenApiContractTest` 在随机真实 HTTP 端口验证 Swagger UI、两组 OpenAPI 和 ZIP 下载，检查 ZIP 中的 4 个接口、
7 个文档内 Schema、来源分组及 SmartDoc 接口不会出现在生成契约中。`SampleEndpointTest` 验证样例业务接口。
集成脚本还断言 Maven 日志没有执行 Spring Boot `start/stop`、SpringDoc Maven 抓取或 SmartDoc Maven goal，
并确认不会创建 `target/generated-openapi` 或 `target/generated-resources/smartdoc`。

因此普通 `compile`、`test`、`package`、`verify` 不再为了 SmartDoc 启动额外应用，也不生成临时 OpenAPI/Skill 文件。
只有用户在已启动服务上请求下载接口时才生成 ZIP。

## 冻结 core 测试输入

运行时迁移不删除用于 core 回归的脱敏固定输入。`OpenApiContractTest` 在两组契约断言通过后仍将副本写到
`target/openapi/`；下面的显式脚本才会更新可提交的 fixtures：

```powershell
powershell -NoProfile -File testbeds/springdoc-multi-package/refresh-fixtures.ps1
```

`fixtures/account.json`、`fixtures/business.json` 和 `fixtures/metadata.json` 供离线 core 测试使用。
普通构建不会修改这些已提交文件。

## 使用 ZIP

将 ZIP 中的整个 `springdoc-multi-package-api` 目录解压到前端项目：

```text
<frontend-project>/.agents/skills/springdoc-multi-package-api/
├── SKILL.md
└── references/
    ├── catalog.md
    ├── source.json
    └── documents/
```

示例服务器地址和 Bearer 定义只是测试元数据，不代表真实业务环境。下载端点沿用应用自身的安全规则；
真实项目若包含受限接口文档，应限制 `/smartdoc/skill.zip` 的访问权限。
