# openapi-skill

**简体中文** | [English](README.en.md)

将 OpenAPI 文档转换为 AI 编程助手可读取的 API 文档 Skill，帮助 Agent 在编写调用代码、联调接口和理解业务 API 时，查阅真实的参数、请求、响应及 Schema。支持通过 Node.js CLI 在项目中生成文档，也支持通过 Spring Boot Starter 下载运行中服务的 Skill ZIP。

## 主要功能

- **面向 Agent 的接口文档**：提供可搜索的接口索引，按需读取接口契约及相关 Schema。
- **保留接口信息**：包含参数、请求体、响应、媒体类型、认证要求和示例，并标明服务与文档归属。
- **多服务汇总**：Node CLI 可将多个微服务和第三方 API 汇总为一份项目 Skill。
- **运行时导出**：Spring Boot Starter 自动发现 SpringDoc 文档与分组，通过 HTTP 接口提供 ZIP 下载。
- **本地转换**：转换过程不依赖 LLM，不调用业务接口，也不访问外部引用地址。

## 目录

- [选择使用方式](#选择使用方式)
- [快速开始：Node.js](#快速开始nodejs)
- [快速开始：Spring Boot](#快速开始spring-boot)
- [在 Agent 中使用](#在-agent-中使用)
- [支持范围](#支持范围)
- [常见问题](#常见问题)
- [文档与项目结构](#文档与项目结构)
- [本地开发与验证](#本地开发与验证)
- [许可证](#许可证)

## 选择使用方式

| 你的需求 | 使用方式 | 环境要求 |
| --- | --- | --- |
| 在前端或其他项目中，从 OpenAPI 地址或本地文件生成 Skill | **Node CLI** | Node.js 20+ |
| 汇总多个服务的文档，或分发给多个 Agent | **Node CLI** | Node.js 20+ |
| 从运行中的 Spring Boot 服务下载 Skill ZIP | **Spring Boot Starter** | JDK 17+、Spring Boot WebMVC、SpringDoc |
| 在自己的 Java 工具中集成文档转换 | **Java Core** | JDK 17+ |

两种生成方式可独立使用。Node CLI 不要求后端安装 Starter；Starter 不要求安装 Node.js。

## 快速开始：Node.js

### 1. 安装

在需要使用接口文档的项目中执行：

```shell
npm install --save-dev openapi-skill
```

### 2. 配置文档来源

在项目根目录创建 `openapi-skill.config.json`：

```json
{
  "services": [
    {
      "serviceId": "my-service",
      "documents": [
        { "id": "public", "url": "./openapi.json" }
      ]
    }
  ]
}
```

将 `./openapi.json` 替换为实际的 OpenAPI JSON 文件路径，也可使用 HTTP(S) 地址，例如 `http://localhost:8080/v3/api-docs`。相对路径以运行命令的目录为基准。

### 3. 生成

```shell
npx openapi-skill
```

默认生成到 `.agents/skills/api-docs/`。API 文档更新后，重新运行即可。

如需多个服务，在 `services` 中添加条目；如需分发给多个 Agent，可在配置根级设置：

```json
{
  "output": [".codex/skills", ".trae/skills"]
}
```

上面是需要加入完整配置的字段片段。每个输出父目录下都会生成同名的 `api-docs/`。

完整配置、npm 脚本、错误处理和库 API 见 [Node 使用指南](openapi-skill-node/README.md)。

## 快速开始：Spring Boot

Starter 为已有 SpringDoc 的 WebMVC 应用提供 `GET /openapi-skill/skill.zip`，自动收录文档分组，无分组时使用默认文档。

以下示例使用当前仓库的 **`2.1.1-SNAPSHOT` 源码版本**，需要先安装到本地 Maven 仓库；它不是 Maven Central 发布版的安装命令。仓库测试应用使用 Spring Boot 3.5.9 和 SpringDoc 2.8.15。

### 1. 安装当前源码

```shell
git clone https://github.com/fyuanz/openapi-skill.git
cd openapi-skill
mvn -B install
```

### 2. 添加依赖

在已有 SpringDoc WebMVC 配置的应用中添加：

```xml
<dependency>
    <groupId>io.github.fyuanz</groupId>
    <artifactId>openapi-skill-spring-boot-starter</artifactId>
    <version>2.1.1-SNAPSHOT</version>
</dependency>
```

### 3. 启动并下载

启动你的应用后，访问其 `/openapi-skill/skill.zip` 路径。

也可以直接运行仓库自带的示例服务：

```shell
mvn -B -f testbeds/springdoc-multi-package/pom.xml spring-boot:run
```

启动完成后，在浏览器打开 [示例 Skill 下载地址](http://127.0.0.1:18080/openapi-skill/skill.zip)。

### 可选配置

| 配置项 | 默认值或行为 |
| --- | --- |
| `openapi.skill.runtime.enabled` | `true` |
| `openapi.skill.runtime.path` | `/openapi-skill/skill.zip` |
| `openapi.skill.runtime.service-id` | 从 `spring.application.name` 派生 |
| `openapi.skill.runtime.skill-name` | `<serviceId>-api` |

每次下载都从当前运行实例生成并校验完整 ZIP，文件在内存中打包。下载路径沿用应用的 Spring Security 规则，请按项目的文档访问权限配置。

## 在 Agent 中使用

Node CLI 已将 Skill 写入输出目录。使用 Starter 时，将 ZIP 中的**整个 Skill 目录**解压到使用方项目的 `.agents/skills/` 或所用 Agent 的 Skill 目录，保留所有引用文件。

当前源码生成的主要内容如下：

```text
<skillName>/
|-- SKILL.md
+-- references/
    |-- index.md
    |-- conventions.md
    |-- source.json
    |-- operations.jsonl
    |-- schemas.jsonl
    |-- operations/
    |-- schemas/
    +-- refs/
```

| 内容 | 用途 |
| --- | --- |
| `SKILL.md` | Skill 入口与阅读指引 |
| `references/index.md` | 搜索接口并直接打开对应契约 |
| `operations/` | 接口参数、请求、响应与相关信息 |
| `schemas/`、`refs/` | 按需查阅的 Schema 与引用契约 |
| 其他元数据与索引 | 来源记录、使用约定及工具处理 |

确认 Agent 已加载该 Skill 后，可以这样提问：

```text
使用 api-docs Skill，找到创建订单接口，说明必填字段，
并按项目现有请求封装生成调用代码。标明服务与文档分组，不要猜测缺失信息。
```

将 `api-docs` 替换为实际 Skill 名称。Starter 默认是 `<serviceId>-api`，仓库示例为 `springdoc-multi-package-api`。

接口变更后，重新生成或下载并整体替换旧 Skill。Starter 不会自动同步已下载到其他项目中的副本。

## 支持范围

以下说明针对当前源码；已发布版本的输入范围和生成布局可能不同。

| 项目 | 范围 |
| --- | --- |
| 输入格式 | OpenAPI 3.0.x / 3.1.x JSON |
| Node 文档来源 | HTTP(S) 地址或普通本地文件 |
| Starter 文档来源 | 当前应用的 SpringDoc WebMVC 最终文档资源 |
| `$ref` | 文档内引用；不支持外部文件、远程或跨文档引用 |
| 多服务 | Node 显式配置汇总；Starter 每个应用独立导出 |
| 不支持 | YAML、Swagger 2.0、WebFlux、全量 OpenAPI 规范校验 |

服务与文档保持独立边界，不合并 OpenAPI 对象，也不推断网关前缀。Node 的输入大小、文档数量和输出目录限制见 [Node 使用指南](openapi-skill-node/README.md#支持范围与限制)。

## 常见问题

| 问题 | 处理方式 |
| --- | --- |
| Node 找不到配置或本地文件 | 检查当前目录、配置文件位置及文档相对路径 |
| Node 下载或校验失败 | 按诊断检查来源；需要更多信息时使用 `npx openapi-skill --debug` |
| Starter 下载接口返回 404 | 确认依赖进入运行时 classpath，且未禁用 `openapi.skill.runtime.enabled` |
| Starter 下载接口返回 500 | 检查 SpringDoc 是否启用、文档版本及 `$ref` 是否完整 |
| 下载接口返回 401/403 | 检查应用对下载路径的访问授权 |
| Agent 找不到 Skill | 检查 Agent 使用的 Skill 目录及 `SKILL.md` 是否随完整目录保留 |

Node 在文档读取、校验或生成失败时保留已有 Skill；多个输出目录独立更新，具体结果见 CLI 诊断。Starter 请求失败时返回错误，不提供不完整 ZIP。

## 文档与项目结构

| 路径 | 内容 |
| --- | --- |
| [Node 使用指南](openapi-skill-node/README.md) | CLI、配置参考、库 API 与升级说明 |
| [Java Core](openapi-skill-core/) | OpenAPI 输入校验与 Skill 转换 |
| [Spring Boot Starter](openapi-skill-spring-boot-starter/) | SpringDoc 集成与运行时 ZIP 下载 |
| [SpringDoc 示例](testbeds/springdoc-multi-package/) | 可启动的多分组应用与集成测试 |
| [Vue / TypeScript 示例](testbeds/vue-ts-consumer/README.md) | 前端项目接入示例 |
| [设计文档](docs/openapi-skill-design.md) | 架构与生成流程 |
| [发布指南](docs/maven-central.md) | Maven Central 配置与维护者发布流程 |

## 本地开发与验证

在仓库根目录执行。Java 需要 JDK 17 和 Maven；Node 需要 Node.js 20+。

**Node 构建与测试：**

```shell
npm ci --prefix openapi-skill-node
npm test --prefix openapi-skill-node
```

**Java 构建、测试及本地安装：**

```shell
mvn -B clean install
mvn -B -f testbeds/springdoc-multi-package/pom.xml test
```

**额外的运行时集成验证（需要 PowerShell）：**

```powershell
powershell -NoProfile -File testbeds/springdoc-multi-package/verify-generated-integration.ps1
```

集成验证检查运行时 ZIP 下载及其内容，详细步骤见 [SpringDoc 示例说明](testbeds/springdoc-multi-package/README.md)。

## 许可证

[MIT](LICENSE)
