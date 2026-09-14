# 最小 Spring Boot 文档测试服务

单服务、四个 Java 包、两个显式 OpenAPI 分组。Java 17，Spring Boot 3.5.9，
springdoc WebMVC UI 2.8.15；版本组合参照 [springdoc 2.8.15 发布记录](https://github.com/springdoc/springdoc-openapi/releases/tag/v2.8.15)。
提供 Swagger UI 浏览接口；无数据库、注册中心、网关或 Knife4j，数据均为虚构，不持久化订单和上传文件。
Bearer 安全定义用于测试文档元数据，服务没有实现认证。

从仓库根目录运行（Maven 3.6.3+、JDK 17）：

```powershell
mvn -f testbeds/springdoc-multi-package/pom.xml test
mvn -f testbeds/springdoc-multi-package/pom.xml spring-boot:run
powershell -NoProfile -File testbeds/springdoc-multi-package/verify-generated-integration.ps1
```

手动启动默认仅监听 `127.0.0.1:18080`，用 Ctrl+C 停止。独立 POM 不依赖根工程或 core。
生成接入验证脚本会先把当前 SmartDoc 插件安装到本地 Maven 仓库，再为 HTTP/JMX 选择空闲端口；它不会
占用或停止手动运行的 `18080` 服务。

启动后打开 [Swagger UI](http://127.0.0.1:18080/swagger-ui.html)。通过页面顶部的
`Select a definition` 切换 `account`（用户接口）和 `business`（订单、文件接口），
展开接口即可查看参数、请求体、响应和 Schema，也可使用 `Try it out` 调用本地样例接口。
UI 使用现有两份分组 JSON；接入方式见 [springdoc 官方文档](https://springdoc.org/v2/)。

| 分组 | 文档地址 | 接口 |
| --- | --- | --- |
| account | http://127.0.0.1:18080/v3/api-docs/account | GET /users、GET /users/{id} |
| business | http://127.0.0.1:18080/v3/api-docs/business | POST /orders、POST /files |

`GET /users/1` 返回示例用户；其他编号返回 404。`GET /users?keyword=示例` 过滤名称。
`POST /orders` 接收 `{"userId":1,"quantity":2,"shippingAddress":{"city":"示例市","street":"示例路"}}`，
校验后以 201 回显；字段校验失败返回 400。`POST /files` 接收 multipart 的 `file` 字段，最多 1 MB。

测试包括真实随机端口 HTTP 文档获取，以及 MockMvc 接口/校验测试。断言精确 `3.1.0`、分组路径、
中文描述、参数位置、请求/响应、必填和最小值、共享与递归引用、multipart、鉴权定义。
两组全部断言通过后才写入 `target/openapi/`；测试关闭应用上下文，Surefire 限制测试进程 120 秒。
固定 `servers` 为默认演示地址，避免随机测试端口污染快照；自定义运行端口时它仍是默认演示地址。

刷新可提交的冻结输入（运行全部测试成功后复制，不自动提交 Git）：

```powershell
powershell -NoProfile -File testbeds/springdoc-multi-package/refresh-fixtures.ps1
```

`fixtures/account.json` 和 `fixtures/business.json` 供后续 core 离线测试使用；
`fixtures/metadata.json` 记录版本、来源端点、SHA-256、操作/Schema 数量和生产源码摘要。
普通 `test` 只更新 `target`，不会修改冻结输入。刷新后应一并审查两份 JSON 和 metadata 的差异。

`verify-generated-integration.ps1` 验证另一条独立链路：`pre-integration-test` 启动已编译应用，
springdoc Maven Plugin 1.5 在 `integration-test` 分别抓取两组 JSON，`post-integration-test` 停止应用，
SmartDoc 在 `verify` 扫描 `target/generated-openapi/`，检查发现的 JSON 属于本次 Maven 会话后发布 Skill。
脚本随后让抓取连接失败，确认旧 JSON
不会被当成本次结果，原 Skill 保持不变且 Maven 构建成功。
Skill 输出位于 `target/generated-resources/smartdoc/`，执行 `clean` 后不会保留。

这条运行时路径要求 `mvn verify`；普通 `compile` 和 `package` 不会到达集成测试阶段。Spring Boot
启动目标本身的失败仍会终止 Maven 构建，因此该样例是可复现的接入证据，不是默认生产配置。

## 生成可复制的 Skill

2026-09-11 的交付使用本测试项目。责任模块就是本目录的 `pom.xml`：
`serviceId=springdoc-multi-package`，`skillName=springdoc-multi-package-api`，
输入为 `target/generated-openapi/`，SmartDoc 在 `verify` 执行，且不向子模块继承。
2026-09-14 起，真实环境接入和前端/web 验收已从计划移除；本测试案例作为生成依据，Skill 由用户人工校验后反馈。
当前测试项目引用本地安装的 `1.1.0-SNAPSHOT`；微服务汇总及共存配置见[项目 README](../../README.md)。

只需生成成功产物时，从仓库根目录执行下面的 PowerShell 命令。先安装当前插件，再为测试应用选择
空闲 HTTP/JMX 端口，运行完整 Maven 链路；不需要提前手动启动应用。

```powershell
mvn -B install
if ($LASTEXITCODE -ne 0) { throw 'SmartDoc plugin build failed' }

function Get-SkillBuildPort {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
    try { $listener.Start(); return $listener.LocalEndpoint.Port } finally { $listener.Stop() }
}
$skillHttpPort = Get-SkillBuildPort
do { $skillJmxPort = Get-SkillBuildPort } while ($skillJmxPort -eq $skillHttpPort)
mvn -B -f testbeds/springdoc-multi-package/pom.xml clean `
    "-Dsmartdoc.application.port=$skillHttpPort" "-Dsmartdoc.springdoc.port=$skillHttpPort" `
    "-Dsmartdoc.jmx.port=$skillJmxPort" verify
if ($LASTEXITCODE -ne 0) { throw 'SpringDoc testbed build failed' }

$status = Get-Content -Raw -LiteralPath `
    'testbeds/springdoc-multi-package/target/generated-resources/smartdoc/.smartdoc/status/springdoc-multi-package.json' |
    ConvertFrom-Json
if ($status.outcome -ne 'SUCCESS') { throw "Skill update failed: $($status.message)" }
```

确认日志先出现 `export-account` 和 `export-business`，应用停止后再出现一次
`SmartDoc [springdoc-multi-package] SUCCESS`。Skill 更新失败不会使 Maven 失败，因此还要检查上述状态，
不能仅凭 `BUILD SUCCESS` 判断 Skill 已刷新。故障注入验证继续使用前面的
`verify-generated-integration.ps1`；它最后故意留下 FAILED 状态和保留的旧 Skill，交付前可用上述正常构建刷新。

完整产物目录：

```text
testbeds/springdoc-multi-package/target/generated-resources/smartdoc/springdoc-multi-package-api/
```

将整个 `springdoc-multi-package-api` 文件夹复制到前端项目的 `.agents/skills/`，保持以下结构；
其中整个 `references/`（包括 `source.json`）也需要一起复制。相邻的 `.smartdoc/` 是构建状态，不需要安装。

```text
<frontend-project>/.agents/skills/springdoc-multi-package-api/
├── SKILL.md
└── references/
    ├── catalog.md
    ├── source.json
    └── documents/
```

Codex 从项目的 `.agents/skills/` 发现本地 Skill，未刷新时可重启 Codex，参见
[官方 Skill 文档](https://learn.chatgpt.com/docs/build-skills)。可在前端项目中尝试：

```text
使用 springdoc-multi-package-api Skill，找到创建订单接口，解释必填字段，
并按项目现有请求封装生成调用代码；标明服务与分组，缺失的契约信息不要猜测。
```

产物含 account/business 两组、4 个接口和 7 个分组内 Schema。它描述测试服务；示例服务器地址和认证
元数据不代表真实业务环境。`clean` 会删除生成目录，复制到前端项目后的副本不会随此处重建自动更新。
