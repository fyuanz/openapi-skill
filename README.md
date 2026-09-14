# SmartDoc-Agent

**简体中文** | [English](README.en.md)

将 API 文档转换为前端开发可使用的 Skill：每个服务的一份或多份 OpenAPI JSON，生成一套包含接口目录、请求响应契约和 Schema 引用的文档，供编码 Agent 按需查阅。

SmartDoc-Agent 通过 Maven 接入构建，在配置的阶段读取文档并更新 Skill。生成或更新失败会输出警告；已有的完整 Skill 在可恢复的失败场景中保留，业务编译保持自身的成功/失败语义。

## 功能与边界

- **一服务一 Skill**：同一服务的多个文档分组一起生成；不同服务独立更新，同名接口和 Schema 按文档隔离。
- **保留契约**：保留参数、请求体、响应、媒体类型、认证定义和 Schema 数据，提供接口、标签和本地引用导航。
- **安全更新**：完整校验、暂存、替换，以及超时、锁和失败恢复；成功更新会移除已删除接口或分组的旧文件。
- **本地转换**：核心不调用 LLM、业务接口或外部引用地址；源文档自由文本与可信 Skill 指令分离。
- **明确输入**：当前仅接受 `openapi: 3.1.0` 的 JSON；生产文档来源限定为 SpringDoc / NextDoc4j。Java 包扫描和文档导出由文档生产工具负责。

当前不支持 YAML、Swagger 2.0、其他 OpenAPI 版本、外部引用、全量 OpenAPI 规范校验、自动跨项目安装/同步、下载服务或 CLI。NextDoc4j 是允许的 JSON 来源；仓库中的运行时集成证据来自 SpringDoc 测试服务。

## 版本与环境

`1.0.0` 已发布到 Maven Central，无需为这些构件添加额外仓库。

| 构件 | 用途 |
| --- | --- |
| `io.github.fyuanz:smart-doc-agent:1.0.0` | 父 POM |
| `io.github.fyuanz:smartdoc-agent-core:1.0.0` | 离线转换与安全输出 |
| `io.github.fyuanz:smartdoc-agent-maven-plugin:1.0.0` | Maven `generate-skill` 目标 |

使用 JDK 17 和 Maven；已验证环境为 Maven 3.9.16 / JDK 17.0.19。仓库集成验证脚本使用 PowerShell。示例服务使用 Spring Boot 3.5.9 和 springdoc 2.8.15。

## 快速体验

克隆仓库后，在仓库根目录执行：

```shell
git clone https://github.com/fyuanz/smart-doc.git
cd smart-doc
mvn -B install
mvn -B -f testbeds/springdoc-multi-package/pom.xml clean verify
```

第一条 Maven 命令成功后再执行第二条。测试服务会自动启动、导出 `account` / `business` 两组文档、停止，然后生成 Skill，无需提前手动启动应用。默认 HTTP 端口为 `18080`，JMX 端口为 `9001`，运行前应确保可用；动态端口构建方式见[测试服务说明](testbeds/springdoc-multi-package/README.md)。

成功后，日志包含 `SmartDoc [springdoc-multi-package] SUCCESS`，完整产物位于：

```text
testbeds/springdoc-multi-package/target/generated-resources/smartdoc/springdoc-multi-package-api/
```

该样例包含 19 个文件、4 个接口和 7 个文档内 Schema。**Maven 的 `BUILD SUCCESS` 不代表 Skill 已更新**，还需查看 SmartDoc 日志及本次更新状态，详见下方故障排查。

## 接入自己的 Maven 服务

先配置 SpringDoc / NextDoc4j，将本次构建的 OpenAPI JSON 导出到一个明确的目录。然后在该服务唯一负责生成 Skill 的模块中，将下列插件放入 `build/plugins`：

```xml
<plugin>
    <groupId>io.github.fyuanz</groupId>
    <artifactId>smartdoc-agent-maven-plugin</artifactId>
    <version>1.0.0</version>
    <inherited>false</inherited>
    <executions>
        <execution>
            <id>update-generated-skill</id>
            <phase>verify</phase>
            <goals><goal>generate-skill</goal></goals>
        </execution>
    </executions>
    <configuration>
        <serviceId>my-service</serviceId>
        <skillName>my-service-api</skillName>
        <documentsDirectory>${project.build.directory}/generated-openapi</documentsDirectory>
        <requireCurrentBuildDocuments>true</requireCurrentBuildDocuments>
    </configuration>
</plugin>
```

**此配置只消费 JSON，不负责启动应用或导出文档。** 插件没有默认生命周期阶段，必须显式绑定在文档生产步骤之后。完整的 SpringDoc 启动、导出和停止配置见[示例 POM](testbeds/springdoc-multi-package/pom.xml)。

示例的执行顺序是：`package` → 启动应用 → `integration-test` 导出 JSON → 停止应用 → `verify` 更新 Skill。因此应运行 `mvn verify`；普通 `mvn compile` 和 `mvn package` 不会执行该运行时链路。每次执行配置的目标都会尝试更新，内容未变化也不会跳过。独立 IDE 编译不在支持范围内。

| 参数 | 含义与默认值 |
| --- | --- |
| `serviceId` | 必填，服务身份，用于来源与状态记录 |
| `skillName` | 必填，Skill 名称及最终目录名；每个服务使用独立输出 |
| `documentsDirectory` | 扫描目录顶层 JSON 文件，不递归；与 `documents` 二选一 |
| `documents` | 显式文档列表，每项指定 `id` 和 `path`；每份列出的文档都必须存在 |
| `outputDirectory` | 默认 `${project.build.directory}/generated-resources/smartdoc`，实际输出为其下的 `<skillName>/` |
| `timeoutSeconds` | 读取和转换任务的超时秒数，默认 `30`，必须大于 0 |
| `requireCurrentBuildDocuments` | 默认 `false`；启用后，每份文档必须在当前 Maven 会话开始后被重写，读取期间大小和修改时间必须稳定 |

身份名称使用小写字母、数字及单个连字符分隔，最长 63 个字符，并避开 Windows 保留名称，例如 `my-service-api`。目录模式以文件名去除 `.json` 后作为文档 ID，推荐 `account.json`、`business.json`。

目录中实际发现的文件构成本次完整输入集；目录不存在或为空时记录 `SKIPPED`。若某个分组必须存在，使用显式 `documents` 配置替换 `documentsDirectory`：

```xml
<documents>
    <document>
        <id>account</id>
        <path>${project.build.directory}/generated-openapi/account.json</path>
    </document>
    <document>
        <id>business</id>
        <path>${project.build.directory}/generated-openapi/business.json</path>
    </document>
</documents>
```

文档生成工具、责任模块、分组和 Maven 阶段均由目标项目明确配置。生成文件建议开启当前构建检查；仓库中的静态权威 JSON 测试路径可关闭该检查并绑定 `compile`，但不能据此证明运行时文档与当前源码同步。

## 在前端项目中使用

将生成的**整个 Skill 目录**复制到前端项目的 `.agents/skills/`，保留所有引用文件：

```text
<frontend-project>/.agents/skills/my-service-api/
├── SKILL.md
└── references/
    ├── catalog.md
    ├── source.json
    └── documents/
```

相邻的 `.smartdoc/` 是构建状态目录，无需复制。然后在前端项目中尝试以下任务，并确认所用 Agent 实际发现并使用了该 Skill：

```text
使用 my-service-api Skill，找到创建订单接口，解释必填字段，
并按项目现有请求封装生成调用代码。标明服务与文档分组，缺失的契约信息不要猜测。
```

使用仓库样例时，将名称替换为 `springdoc-multi-package-api`。样例描述虚构测试服务，其服务器地址和认证元数据不代表业务生产环境。

后端重建只更新生成目录，不会自动同步前端副本。重新复制时应整体替换旧 Skill，避免残留已删除接口。默认生成目录位于 `target/`，会被 `mvn clean` 删除。

## 更新状态与故障排查

默认状态路径为 `target/generated-resources/smartdoc/.smartdoc/status/<serviceId>.json`，位于服务责任模块下。该文件记录进入更新器的最近一次尝试；配置错误或空目录跳过可能只输出日志，不能把旧状态当成本次成功。

| 现象 | 检查方式 |
| --- | --- |
| `SUCCESS` | 本次完整 Skill 已发布；检查输出位置和来源信息 |
| `SKIPPED` | 检查输入目录及顶层 JSON 文件；必要时改为显式必需文档列表 |
| `FAILED` / `CONFIG` | 检查名称、配置、JSON 版本、本地引用、输出权限和同次构建文档时间 |
| `TIMED_OUT` / `LOCKED` | 检查输入规模、超时配置，以及是否有任务同时写同一 Skill |
| Maven 成功但 Skill 未变 | 查看本次 SmartDoc 日志；失败时可能保留上次完整产物 |

可恢复的更新失败会保留或恢复旧 Skill；若恢复本身失败，会保留完整备份供恢复。首次生成失败或 `clean` 后失败则可能没有旧产物。插件不会掩盖 Java 编译等业务构建错误，示例中 Spring Boot 启动失败也仍会导致 Maven 失败。

## 开发与验证

从仓库根目录运行：

```shell
mvn -B clean test
mvn -B -f testbeds/springdoc-multi-package/pom.xml test
```

两套真实 Maven 集成验证独立于根单元测试：

```powershell
powershell -NoProfile -File testbeds/maven-plugin-integration/verify.ps1
powershell -NoProfile -File testbeds/springdoc-multi-package/verify-generated-integration.ps1
```

集成脚本会安装当前插件并执行真实构建。SpringDoc 脚本包含抓取失败注入，最终故意留下 `FAILED` 状态和保留的旧 Skill；需要交付最新成功产物时，重新执行正常 `clean verify`。

最近发布验证（2026-09-11）：62 个核心/插件测试、5 个测试服务测试通过；静态多服务构建与运行时 SpringDoc 链路已验证。真实目标项目的部分模块构建、启动失败策略，以及前端实际发现与多服务使用仍待验收。

## 项目结构与文档

| 路径 | 内容 |
| --- | --- |
| [smartdoc-agent-core](smartdoc-agent-core/) | 输入校验、契约转换、安全发布 |
| [smartdoc-agent-maven-plugin](smartdoc-agent-maven-plugin/) | Maven 配置、目录发现、更新入口 |
| [SpringDoc 测试服务](testbeds/springdoc-multi-package/) | 多包、多分组示例与运行时验证 |
| [Maven 集成测试](testbeds/maven-plugin-integration/) | 多服务、重复/并行构建和失败隔离 |
| [设计文档](docs/smartdoc-agent-design.md) | v3.5 产品范围与验收边界 |
| [发布与使用](docs/maven-central.md) | Maven Central 配置与维护者发布流程 |
| [任务状态](docs/codex/TASKS.md) | 已完成工作、验证证据与后续计划 |

## 许可证

[MIT](LICENSE)
