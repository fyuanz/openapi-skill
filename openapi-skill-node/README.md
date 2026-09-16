# openapi-skill

**简体中文** | [English](README.en.md)

从一个或多个服务的 OpenAPI 3.1.0 JSON 地址生成一份自包含的 Codex Skill。当前未发布的 `1.1.0` 源码默认按“一个项目一份接口文档 Skill”组织多个微服务、模块和第三方服务，并生成面向 LLM 的 context-first 导航。适用于 Vue 3 及其他 Node.js 20+ 项目，也可以作为 TypeScript 库调用。

## 安装

```shell
npm install --save-dev openapi-skill
```

## 项目配置（推荐）

在项目根目录创建 `openapi-skill.config.json`：

```json
{
  "keywords": ["接口文档", "前后端联调"],
  "services": [
    {
      "serviceId": "account-service",
      "sourceType": "internal",
      "keywords": ["用户", "账号", "权限"],
      "documents": [
        {
          "id": "account",
          "url": "http://127.0.0.1:18080/v3/api-docs/account",
          "keywords": ["登录", "注册", "用户资料"]
        },
        {
          "id": "permission",
          "url": "http://127.0.0.1:18080/v3/api-docs/permission",
          "keywords": ["角色", "RBAC"]
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
          "keywords": ["运单", "轨迹查询"]
        }
      ]
    }
  ]
}
```

项目模式下 `skillName` 可省略，默认是 `api-docs`，输出为 `<project>/.agents/skills/api-docs/`。如 monorepo 中确实需要多份项目级 Skill，可在根级显式设置其他 `skillName`。

配置层级含义：

- 根级 `keywords` 用于发现整份项目 API Skill。
- 服务级 `keywords` 用于识别业务服务，并以受限长度进入根 Skill 描述和服务目录。
- 文档级 `keywords` 用于在选定服务后定位模块或分组，保存在对应服务目录中，不会把所有细粒度词塞入根描述。
- `sourceType` 可设为 `internal` 或 `third-party`，省略时为 `internal`。它记录来源性质，不会改变 OpenAPI 解析规则。
- `serviceId` 在项目内必须唯一；`document.id` 只需在所属服务内唯一，因此不同服务可以都有名为 `public` 的文档。

每个服务及其文档保持独立边界，不会合并 OpenAPI 对象、跨文档解析 `$ref`，也不会猜测网关前缀。生成目录只包含一个根 `SKILL.md`，服务内容物理包含在 `references/services/<serviceId>/` 下，并通过相对 Markdown 链接导航；这里不使用文件系统符号链接，复制完整 `api-docs` 目录即可使用。

生成的服务 reference 根使用 `openapi-skill-core/2`。每份文档只有一个 `context.md`，其中列出全部接口的
method/path、摘要、tag、配置关键词和直接 Markdown 链接；LLM 从这个目录进入 operation，不需要读取或搜索
JSONL。`operations.jsonl`、`schemas.jsonl` 仍作为紧凑的机器校验索引保留。接口主键使用 service、document、
HTTP method 和 path，不依赖可缺失或重复的 SpringDoc `operationId`；后者仅作为导航别名。operation/schema
文件在无冲突时使用纯语义名，例如 `get-users-by-id.md`；只有大小写不敏感冲突或文件系统安全回退才追加
短摘要。每个 operation 还包含生成器预计算的完整直接/传递引用清单和递归边，LLM 不需要自行计算 `$ref`
闭包。

## 运行与原子更新

添加 npm 脚本，并在所有需要读取的 API 服务启动后执行：

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

发布前会先下载并校验所有服务的全部配置文档，再生成和校验完整项目 Skill，最后只进行一次目录替换。任一服务下载失败、返回无效契约或生成失败时，已有的整份 Skill 保持不变，不会发布缺少某个服务的部分结果；下一次成功更新会同时清除已经从配置中移除的服务、文档和接口。

每个 URL 必须使用 HTTP(S)、成功返回 JSON，并包含精确的 `openapi: 3.1.0`。重定向和外部 `$ref` 会被拒绝。`output` 可设置为绝对路径或相对于项目根目录的输出父目录；默认是 `.agents/skills`。`timeoutMs` 默认为 `30000`。配置也可以写在 `package.json#openapiSkill` 中，或通过 `openapi-skill --config <path>` 指定文件。

## 旧单服务配置兼容

已有配置无需立即迁移，`1.1.0` 仍接受原来的单服务结构并保留显式 Skill 名称：

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

根级单服务字段不能与 `services` 同时出现。新项目建议使用 `services`，这样以后增加微服务或第三方接口时不需要改变 Skill 入口。

## 库 API

本包导出 `run`、`loadConfig`、`generateSkill`、`generateProjectSkill`、`publishSkill` 及其 TypeScript 类型。`generateSkill` 保留单服务兼容用途，项目级生成优先使用 `generateProjectSkill` 或直接调用 `run`。需要 Node.js 20 或更高版本。
