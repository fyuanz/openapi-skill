# openapi-skill

**简体中文** | [English](README.en.md)

将一个或多个服务的 OpenAPI 文档转换为 AI 编程助手可读取的 API 文档 Skill。生成内容包含接口索引、请求与响应契约及相关 Schema，帮助 Agent 在编写代码和联调接口时按需查阅项目 API。

## 主要功能

- **统一项目文档**：将多个微服务或第三方 API 收录到一份 Skill，保留服务和文档归属。
- **按需查阅接口**：通过索引定位接口，再读取参数、请求体、响应、认证要求和示例。
- **支持远程和本地来源**：读取 HTTP(S) 地址或本地 OpenAPI 3.0.x / 3.1.x JSON 文件。
- **分发给多个 Agent**：一次生成，输出到一个或多个 Skill 目录。
- **更新已有文档**：重新运行即可替换生成内容；读取或校验失败时保留已有 Skill。
- **CLI 与库 API**：可通过 npm 脚本使用，也可集成到 JavaScript / TypeScript 工具中。

## 目录

- [快速开始](#快速开始)
- [配置参考](#配置参考)
- [多服务与多输出目录](#多服务与多输出目录)
- [命令行用法](#命令行用法)
- [生成结果](#生成结果)
- [支持范围与限制](#支持范围与限制)
- [更新与故障排查](#更新与故障排查)
- [库 API](#库-api)
- [升级与兼容性](#升级与兼容性)
- [许可证](#许可证)

## 快速开始

需要 **Node.js 20 或更高版本**。

### 1. 安装

在需要使用 API 文档的项目中执行：

```shell
npm install --save-dev openapi-skill
```

### 2. 添加配置

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

将 `./openapi.json` 替换为实际的 OpenAPI JSON 文件路径，也可以使用服务地址，例如 `http://localhost:8080/v3/api-docs`。使用远程地址时，请先确保服务可访问。

### 3. 生成 Skill

在 `package.json` 的 `scripts` 中添加：

```json
{
  "scripts": {
    "skill:generate": "openapi-skill"
  }
}
```

```shell
npm run skill:generate
```

默认生成到 `.agents/skills/api-docs/`，入口为 `SKILL.md`。将输出目录设为所用 Agent 的 Skill 目录后，即可让它参考这些接口文档。API 文档更新后，重新运行同一命令。

## 配置参考

默认先读取项目根目录的 `openapi-skill.config.json`；未找到配置时，读取 `package.json` 中的 `openapiSkill` 字段。也可以通过 `--config <path>` 指定配置文件。

**路径基准**：配置文件路径、本地文档路径和相对输出路径均相对于运行命令的当前目录；使用库 API 时，相对于 `cwd`。指定其他目录下的配置文件不会改变这一基准。

### 项目字段

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `services` | 数组 | 必填 | 1–32 个服务，整个项目最多 32 份文档 |
| `skillName` | 字符串 | `api-docs` | 生成的 Skill 名称，也是输出子目录名 |
| `output` | 字符串或字符串数组 | `.agents/skills` | 输出父目录，支持 1 至 8 个绝对或相对路径 |
| `keywords` | 字符串数组 | `[]` | 用于发现整份项目 Skill 的关键词 |
| `timeoutMs` | 正整数 | `30000` | HTTP 下载阶段的共享超时预算，单位为毫秒；不限制本地文件读取 |

例如，`output: ".codex/skills"` 和 `skillName: "api-docs"` 对应 `.codex/skills/api-docs/`。输出父目录不能重复、互相嵌套或为文件系统根目录。

### 服务字段：`services[]`

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `serviceId` | 字符串 | 必填 | 项目内唯一的服务标识 |
| `documents` | 数组 | 必填 | 该服务的 OpenAPI 文档列表 |
| `sourceType` | 字符串 | `internal` | `internal` 或 `third-party`，仅标记来源性质 |
| `keywords` | 字符串数组 | `[]` | 服务关键词，出现在 Skill 描述和接口索引中 |

### 文档字段：`services[].documents[]`

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `id` | 字符串 | 必填 | 服务内唯一的文档标识；不同服务可使用相同文档标识 |
| `url` | 字符串 | 必填 | HTTP(S) 地址或普通本地文件路径 |
| `keywords` | 字符串数组 | `[]` | 模块或分组关键词，出现在接口索引中 |

标识命名：`skillName`、`serviceId` 和文档 `id` 使用小写字母、数字及单个连字符分隔，不超过 63 个字符，并避开 Windows 保留设备名。

## 多服务与多输出目录

以下示例将内部账号服务与第三方物流 API 放入同一份 Skill，并分发到两个 Agent 目录。请替换为实际来源：

```json
{
  "output": [".codex/skills", ".trae/skills"],
  "keywords": ["接口文档", "前后端联调"],
  "services": [
    {
      "serviceId": "account-service",
      "keywords": ["用户", "权限"],
      "documents": [
        {
          "id": "account",
          "url": "http://localhost:8080/v3/api-docs/account",
          "keywords": ["登录", "注册"]
        },
        {
          "id": "permission",
          "url": "./openapi/permission.json"
        }
      ]
    },
    {
      "serviceId": "logistics-provider",
      "sourceType": "third-party",
      "documents": [
        {
          "id": "shipping",
          "url": "https://api.example.com/openapi.json",
          "keywords": ["运单", "轨迹查询"]
        }
      ]
    }
  ]
}
```

生成目录分别为 `.codex/skills/api-docs/` 和 `.trae/skills/api-docs/`，两处内容相同。若需要多份内容不同的 Skill，可使用不同配置文件和 `skillName`。

## 命令行用法

安装后，可在项目中直接运行：

```shell
npx openapi-skill
npx openapi-skill --config ./config/api-docs.json
npx openapi-skill --config ./config/api-docs.json --debug
```

通过 npm 脚本传递参数：

```shell
npm run skill:generate -- --debug
```

| 参数 | 作用 |
| --- | --- |
| `--config <path>` | 指定配置文件 |
| `--debug` | 在错误诊断后输出完整堆栈和原因链 |

退出码：`0` 表示成功，`1` 表示生成或写入失败，`2` 表示命令行参数错误。

## 生成结果

```text
api-docs/
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

| 文件或目录 | 用途 |
| --- | --- |
| `SKILL.md` | Agent 的入口与阅读指引 |
| `references/index.md` | 按摘要、HTTP 方法、路径、标签或关键词检索接口 |
| `references/operations/` | 接口契约，包括参数、请求、响应、servers、security 和示例 |
| `references/schemas/`、`references/refs/` | 接口引用的 Schema 和其他契约，按需读取 |
| `references/conventions.md` | 文档使用约定 |
| `references/source.json` | 来源元数据 |
| `references/*.jsonl` | 供工具处理的机器索引 |

Agent 从总索引直接打开接口文件，再按链接读取相关 Schema。不同服务和文档的契约保持独立，不合并 OpenAPI 对象，也不推断网关前缀。

## 支持范围与限制

| 项目 | 支持范围 |
| --- | --- |
| 文档格式 | OpenAPI 3.0.x / 3.1.x JSON；不支持 YAML 或 Swagger 2.0 |
| 远程来源 | HTTP(S)，必须成功返回 JSON，不跟随重定向 |
| 本地来源 | 普通文件路径；不支持 `file://`、目录扫描或 glob |
| 引用 | 文档内 `$ref`；不支持外部文件、远程或跨文档引用 |
| 输入大小 | 每份文档最多 8 MiB，项目合计最多 32 MiB |
| 文档数量 | 项目合计最多 32 份 |
| 输出数量 | 1–8 个目录 |

## 更新与故障排查

### 更新已有 Skill

修改来源文档或配置后，重新运行 `npm run skill:generate`：

- 所有文档读取、校验和生成成功后，才开始替换输出。
- 成功更新会移除已不在配置中的服务、文档和接口。
- 每个输出目录作为独立原子更新单元。多目录写入出现部分失败时，成功目录保留新内容，不会因其他目录失败而回滚；失败目录通常保留原有内容，CLI 报告各目标的 `OK` / `FAILED` 并以 `1` 退出。
- 修复失败原因后可重新运行；如果错误报告回滚失败及备份路径，请先恢复备份。

`.openapi-skill/` 用于更新期间暂存和备份，空目录通常会自动清理。若其中保留了备份，请按错误提示处理。

### 定位错误

错误诊断会标明来源和失败阶段，例如：

```text
ERROR user-service/account [PARSE/INVALID_JSON]: expected a colon (line 42, column 17)
```

| 问题 | 检查项 |
| --- | --- |
| 找不到配置或本地文件 | 当前工作目录、`--config` 参数及文件路径 |
| 下载失败 | 服务是否可访问、地址是否直接返回 JSON、是否发生重定向 |
| JSON 解析失败 | 报错行列附近的 JSON 语法 |
| 契约校验失败 | OpenAPI 版本及是否包含外部 `$ref` |
| 输出失败 | 目录权限、文件占用及诊断中的备份路径 |

需要更多信息时使用 `--debug`。默认诊断会隐藏正文、请求头及远程 URL 中的凭证和查询参数；调试输出可能包含来源细节，分享前请脱敏。

## 库 API

本包提供 ESM 导出及 TypeScript 类型。使用 `run` 完成配置读取、文档加载、生成和写入：

```js
import { run } from 'openapi-skill';

const result = await run({
  cwd: process.cwd(),
  config: 'openapi-skill.config.json'
});

console.log(result.skillDirectories);
console.log(`Generated ${result.serviceCount} service(s)`);
```

`cwd` 默认为当前工作目录，`config` 可省略。成功结果包含：

| 字段 | 说明 |
| --- | --- |
| `skillDirectories` | 全部生成目录 |
| `skillDirectory` | 第一个生成目录，保留用于兼容 |
| `serviceCount`、`documentCount` | 服务数与文档数 |
| `fileCount` | 每个输出目录的生成文件数 |

其他导出用于自定义集成：

| 导出 | 用途 |
| --- | --- |
| `loadConfig` | 读取并解析配置 |
| `generateProjectSkill` | 从多个服务的文档生成文件集合 |
| `generateSkill` | 从旧单服务输入生成文件集合 |
| `publishSkill` | 将文件集合写入 Skill 目录 |
| `MultiOutputPublishError` | 输出写入失败时抛出的错误，`results` 包含各目标结果 |

## 升级与兼容性

### 从 2.1.x 升级到 2.2.0

配置格式保持兼容，升级后重新运行生成命令即可。2.2.0 的生成文件使用扁平布局：

- 通过 `references/index.md` 直接定位接口。
- 若自有脚本依赖旧 catalog/context/group 路径，需要调整。
- 若读取 JSONL，注意 `groupFile` 已移除，`file` 和 `closureFiles` 指向新版路径。
- 手动复制或解压生成内容时，请整体替换旧 Skill 目录。

### 旧单服务配置

仍支持以下配置，其中 `skillName` 必填：

```json
{
  "serviceId": "my-service",
  "skillName": "my-service-api",
  "documents": [
    { "id": "public", "url": "./openapi.json" }
  ]
}
```

根级 `serviceId`、`documents` 不能与 `services` 混用。新项目建议使用快速开始中的 `services` 结构。

## 许可证

[MIT](LICENSE)
