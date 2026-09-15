# smartdoc-agent

**简体中文** | [English](README.en.md)

从一个或多个 OpenAPI 3.1.0 JSON 地址生成一份 Codex Skill。本包使用 TypeScript 编写，可以作为 Vue 3 或其他 Node.js 项目的开发依赖，也可以作为库调用。

## 安装与配置

```shell
npm install --save-dev smartdoc-agent
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

添加 npm 脚本，并在本地 API 服务启动后执行：

```json
{
  "scripts": {
    "skill:generate": "smartdoc-agent"
  }
}
```

```shell
npm run skill:generate
```

默认输出目录是 `<project>/.agents/skills/<skillName>/`。可将 `output` 设置为绝对路径或相对于项目根目录的路径，以更改输出父目录。`timeoutMs` 默认为 30000。配置也可以写在 `package.json#smartdocAgent` 中，或通过 `smartdoc-agent --config <path>` 指定配置文件。

发布前会先下载全部已配置文档。每个 URL 必须使用 HTTP(S)、成功返回 JSON，并且包含精确的 `openapi: 3.1.0`。下载或校验失败时，不会替换此前有效的 Skill。重定向和外部 `$ref` 会被拒绝。

## 库 API

本包导出 `run`、`loadConfig`、`generateSkill` 和 `publishSkill` 及其 TypeScript 类型。需要 Node.js 20 或更高版本。
