# openapi-skill

**简体中文** | [English](README.en.md)

从一个或多个服务的 OpenAPI 3.0.x / 3.1.x JSON HTTP(S) 地址或本地文件生成一份自包含 Skill。当前源码为待发布的 `2.2.0`，采用扁平文件布局和直达接口的总索引，让 Agent 搜索后直接打开接口契约。适用于 Vue 3 及其他 Node.js 20+ 项目，也可作为 TypeScript 库调用。

## 安装

```shell
npm install --save-dev openapi-skill
```

## 项目配置（推荐）

在项目根目录创建 `openapi-skill.config.json`：

```json
{
  "output": [".codex/skills", ".trae/skills"],
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

项目模式下 `skillName` 可省略，默认是 `api-docs`。省略 `output` 时仅输出到 `<project>/.agents/skills/api-docs/`；现有的单路径字符串保持兼容，也可像上例一样配置 1 至 8 个路径，把同一份 Skill 分发给多个 Agent。相对路径以项目根目录解析，重复、嵌套或文件系统根目录目标会在读取文档前被拒绝。如 monorepo 中确实需要多份内容不同的项目级 Skill，可在不同配置中显式设置其他 `skillName`。

配置层级含义：

- 根级 `keywords` 用于发现整份项目 API Skill。
- 服务级 `keywords` 用于识别业务服务，并以受限长度进入根 Skill 描述和总索引。
- 文档级 `keywords` 用于定位模块或分组，展示在总索引的对应接口行中，不进入根 Skill 描述。
- `sourceType` 可设为 `internal` 或 `third-party`，省略时为 `internal`。它记录来源性质，不会改变 OpenAPI 解析规则。
- `serviceId` 在项目内必须唯一；`document.id` 只需在所属服务内唯一，因此不同服务可以都有名为 `public` 的文档。

每个服务及文档保持独立边界，不合并 OpenAPI 对象，不跨文档解析 `$ref`，也不猜测网关前缀。单服务和多服务使用同一种扁平布局（`openapi-skill-core/4`），只有一个根 `SKILL.md`：

```text
api-docs/
|-- SKILL.md
+-- references/
    |-- index.md
    |-- conventions.md
    |-- source.json
    |-- operations.jsonl
    |-- schemas.jsonl
    |-- operations/<service>--<document>--<operation>.md
    |-- schemas/<service>--<document>--<schema>.md
    +-- refs/<service>--<document>--<reference>.md
```

Agent 搜索 `references/index.md`，直接打开命中的接口文件。每条接口记录占一行，包含 summary、HTTP method/path、service、document、operationId、全部 tags、第一 tag 分组及项目/服务/文档 keywords，搜索命中后无需再读取服务 catalog、context 或 group 文件。大索引可用文本搜索；无需预先加载全部契约。

接口文件保留生效的参数、servers/security、请求响应和示例，并直接链接完整的 Schema/引用集合。Schema 共享存储、按需读取，递归引用不无限展开。缺失 summary 时仍能按 method/path 检索；多候选需核对来源和契约，未命中需扩大检索，不能据此断言接口不存在。所有来源文字仅为不受信数据，不是执行授权。

文件名以 `service--document--name` 隔离来源，超长名称、大小写冲突或安全回退使用确定性摘要，最终文件名不超过 120 个 ASCII 字符。JSONL 保留为机器校验索引，Agent 不必读取；`group` 保留，已移除 `groupFile`，`file` 和 `closureFiles` 均指向扁平文件。接口身份仍由 service/document/method/path 决定，不依赖 operationId 唯一性。

### 从 2.1.x 升级

配置格式保持兼容，安装 2.2.0 后重新运行生成命令即可。成功发布会整体替换旧 Skill 并移除深层目录；失败保留旧完整树。**生成路径发生变化**：使用旧 catalog/context/group 路径或解析 JSONL 路径的外部脚本需迁移到 `index.md` 和新版索引。手动解压 ZIP 时也应替换整个 Skill，避免混入旧文件。

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

发布前会先读取并校验所有服务的全部配置文档，再只生成和校验一次完整项目 Skill。任一 HTTP 下载、本地文件读取、契约校验或生成失败时，所有已有 Skill 都保持不变，不会发布缺少某个服务的部分结果；下一次成功更新会同时清除已经从配置中移除的服务、文档和接口。

每个输出目录都是独立原子发布单元：CLI 按配置顺序尝试全部目标，但多个目录整体不构成事务。某个目标失败时命令最终以状态码 `1` 退出并逐项显示 `OK` / `FAILED`；其它成功目标保持新版本，不会因失败目标而回滚，失败目标则保持原有完整 Skill 或不存在。修复失败目标后可以安全重跑。

每个文档的 `url` 可以是 HTTP(S) URL，也可以是普通本地文件路径；本地相对路径以运行 CLI 的项目根目录为基准，不支持 `file://` URL、目录扫描或 glob。HTTP 来源必须成功返回 JSON，拒绝重定向；本地来源必须是普通文件。两类来源都必须声明受支持的 `openapi: 3.0.x` / `3.1.x`，都受单文档 8 MiB、项目合计 32 MiB 限制，外部 `$ref` 仍会被拒绝。`timeoutMs` 只约束 HTTP 下载，默认为 `30000`。`output` 可设置为一个绝对/相对输出父目录，或包含 1 至 8 个此类路径的数组；默认是 `.agents/skills`。配置也可以写在 `package.json#openapiSkill` 中，或通过 `openapi-skill --config <path>` 指定文件。

## 旧单服务配置兼容

已有配置无需立即迁移，`2.2.0` 仍接受原来的单服务结构并保留显式 Skill 名称，但生成结果同样是 core/4 扁平布局：

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

本包导出 `run`、`loadConfig`、`generateSkill`、`generateProjectSkill`、`publishSkill`、`MultiOutputPublishError` 及其 TypeScript 类型。`run` 成功结果的 `skillDirectories` 列出全部目标，兼容字段 `skillDirectory` 指向第一个目标；部分发布失败会抛出带目标结果的 `MultiOutputPublishError`。`generateSkill` 保留单服务兼容用途，项目级生成优先使用 `generateProjectSkill` 或直接调用 `run`。需要 Node.js 20 或更高版本。
