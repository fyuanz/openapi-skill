# openapi-skill

**简体中文** | [English](README.en.md)

从一个或多个服务的 OpenAPI 3.0.x / 3.1.x JSON HTTP(S) 地址或本地文件生成一份自包含的 Codex Skill。`2.0.0` 已发布，默认按“一个项目一份接口文档 Skill”组织多个微服务、模块和第三方服务，并按 OpenAPI `tags` 分组生成面向 LLM 的导航（每个 tag 一个可读文件名的分组文件，中文 tag 名直接保留）。适用于 Vue 3 及其他 Node.js 20+ 项目，也可以作为 TypeScript 库调用。

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

本地导出的 OpenAPI JSON 可以直接写入同一个 `url` 字段；相对路径以运行 CLI 的项目根目录为基准：

```json
{
  "id": "account",
  "url": "./openapi/account.json"
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

生成的服务 reference 根使用 `openapi-skill-core/3`。每份文档只有一个 `context.md`，它是**分组索引**：列出该文档的
每个 tag 分组及其接口数；点进去是 `groups/<tag>.md`，文件名就是 OpenAPI 里的 tag 名（中文名直接保留），
每个 operation 一行 `- [语义化标题](../operations/<file>.md) — \`METHOD /path\``，并只出现在它的**第一个** tag
里。因此契约里找不到某个接口时，先检查该文档的其它分组。文档声明的 servers 与 security 事实写在服务
`catalog.md` 里，不再占必读的 context 篇幅。`operations.jsonl`、`schemas.jsonl` 仍作为紧凑的机器校验索引
保留（前者带 `group`/`groupFile` 列），LLM 导航不需要读取或搜索
JSONL。接口主键使用 service、document、
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

失败时，CLI 只向 stderr 输出一条稳定诊断并以状态码 `1` 退出，例如：

```text
ERROR user-service/account [PARSE/INVALID_JSON]: expected a colon (line 42, column 17)
```

JSON 语法错误会在能够可靠确定时给出一基行列号，且默认诊断不会回显 OpenAPI 正文、HTTP 请求头或远程 URL 的凭证、查询参数和片段。需要排查内部原因时可运行 `openapi-skill --debug`；它会在诊断后展开完整 stack 和 `cause` 链，也可与 `--config <path>` 按任意顺序组合。调试输出可能包含来源细节，请检查并脱敏后再粘贴到公开 issue。

发布前会先读取并校验所有服务的全部配置文档，再生成和校验完整项目 Skill，最后只进行一次目录替换。任一 HTTP 下载、本地文件读取、契约校验或生成失败时，已有的整份 Skill 保持不变，不会发布缺少某个服务的部分结果；下一次成功更新会同时清除已经从配置中移除的服务、文档和接口。

每个文档的 `url` 可以是 HTTP(S) URL，也可以是普通本地文件路径；本地相对路径以运行 CLI 的项目根目录为基准，不支持 `file://` URL、目录扫描或 glob。HTTP 来源必须成功返回 JSON，拒绝重定向；本地来源必须是普通文件。两类来源都必须声明受支持的 `openapi: 3.0.x` / `3.1.x`，都受单文档 8 MiB、项目合计 32 MiB 限制，外部 `$ref` 仍会被拒绝。`timeoutMs` 只约束 HTTP 下载，默认为 `30000`。`output` 可设置为绝对路径或相对于项目根目录的输出父目录；默认是 `.agents/skills`。配置也可以写在 `package.json#openapiSkill` 中，或通过 `openapi-skill --config <path>` 指定文件。

## 旧单服务配置兼容

已有配置无需立即迁移，`2.0.0` 仍接受原来的单服务结构并保留显式 Skill 名称，但生成结果同样是 core/3 布局：

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
