# vue-ts-consumer — 闭环验证报告

本文件记录 2026-09-14 第一次「真实前端消费端」闭环测试的结果与发现。它是**测试证据**，不是产品文档。

## 闭环链路

```
testbeds/springdoc-multi-package  (Spring Boot 3.5.9 + springdoc 2.8.15, :18080)
        │  GET /v3/api-docs/account   (account 组, 2 operations)
        │  GET /v3/api-docs/business  (business 组, 2 operations)
        ▼
smartdoc-agent-node  @fyuanz/smartdoc-agent@1.3.0  (本地 tgz 安装)
        │  npm run skill:generate
        ▼
testbeds/vue-ts-consumer/.agents/skills/springdoc-multi-package-api/   (19 files)
        │  SKILL.md → catalog → context → operations → schemas
        ▼
Vue 3 + TS 前端  src/api/client.ts  (5 个接口的真实调用)
        │  Vite dev proxy  /api/*  →  :18080
        ▼
真实 HTTP 调用 → 与文档契约逐项对照
```

## 执行证据

| 步骤 | 命令 | 结果 |
| --- | --- | --- |
| 依赖安装 | `mvn -B -DskipTests install` | BUILD SUCCESS（4 模块，1.2.0） |
| 启动后端 | `spring-boot:run`（固定 `--server.port=18080`） | `/v3/api-docs/account` 200、`/v3/api-docs/business` 200 |
| 生成 Skill | `npm run skill:generate` | 19 files，commit 到 `.agents/skills/springdoc-multi-package-api` |
| 类型与构建 | `npm run build`（`vue-tsc -b && vite build`） | 通过，71.74 kB JS / 1.43 kB CSS |
| 开发服务器 | `npm run dev` | `http://localhost:15173/` 200 |
| 接口联调 | Vite 代理下的 5 个接口 | 见下表 |

### 接口逐项对照（全部经 Vite 代理 `:15173` → `:18080`）

| # | 调用 | 期望（来自 Skill 契约） | 实测 | 结论 |
| --- | --- | --- | --- | --- |
| 1 | `GET /users?keyword=示例` | 200 + `UserView[]` | 200 + 1 条，字段 `id/name/address/children` 齐全 | 一致 |
| 2 | `GET /users?keyword=zzz` | 200 + 空数组 | 200 + `[]` | 一致 |
| 3 | `GET /users/1` + `X-Request-Id` | 200 + `UserView` | 200 + 示例用户 | 一致 |
| 4 | `GET /users/999` | 404 + `ApiError` | 404 + `{"code":"NOT_FOUND","message":"未找到示例资源"}` | 一致 |
| 5 | `POST /orders` 合法体 | 201 + 回显请求体 | 201 + 原样回显 | 一致 |
| 6 | `POST /orders` 非法体 | 400 + `ApiError` | 400 + `{"code":"VALIDATION_ERROR",...}` | 一致 |
| 7 | `POST /files` multipart | 200 + `{"size":N}` | 200 + `{"size":5}`（5 字节探针，直连与代理均通过） | 一致 |

`source.json` 中两份文档的 SHA-256（account `686c1b8b…6d87`、business `ae7e7d84…290c`）与 `docs/codex/TASKS.md`
记录的历史值完全一致，说明本次运行时导出与既有契约快照是同一份数据。

## 独立前向可用性审计

把生成的 Skill 交给一个**独立只读 agent**，要求它只用 Skill 自身文件回答 10 个前端集成问题，并与真实契约对照。
结论：**5 个操作全部可从 Skill 写出正确的 TypeScript 客户端**，导航无错链（catalog 的每个链接都命中正确文件）。
但审计指出 3 处真实缺口。

### 缺口 1：跨 document 的同名 schema 未声明「独立 vs 共享」（审计判定为唯一实质缺口）

`Address` 在 account 与 business 下各有一份，**文件内容逐字节相同**（同 sha 文件名
`7c8570e5…50d2.md`），但 Skill 未说明这是「同一逻辑定义的两次导出」还是「碰巧一致的两份独立定义」。
`SKILL.md` 只说「同名定义保留在其源文档内」，读者必须自行 diff 才能判断。
影响：前端无法确定应生成一个共享 `Address` 类型还是每分组各一个。

**核实结论：这是 OpenAPI 语义本身的问题，不是生成缺陷。** 两个分组是各自独立的 OpenAPI 文档，
`Address` 在各自 `components.schemas` 下确实是两份独立定义；设计边界明确不做语义合并
（见 `docs/codex/DECISIONS.md`「no semantic merge」）。生成器忠实反映了这一点。
但**这个事实对读者不可见**，值得在 Skill 中显式说明，否则每次都要靠人肉 diff。

### 缺口 2：`security: null` 的含义未在 Skill 内说明

审计报告：「`bearerAuth` 仅出现在 `POST /orders`，其余操作 `security: null` — Skill 未明说 `null` 是
『无需鉴权』还是『继承未知』，此处必须猜。」

**核实结论：数据正确，可读性不足。**
- 源头文档确实**没有**根级 `security` 字段（实测 `has root security: false`），
  `GET /users`、`GET /users/{id}`、`POST /files` 的 operation 上也没有 `security`。
- `SkillGenerator.inherited()` 逐层检查 `has(key)`，未命中则返回 `null`，因此 `null` 表示
  **「文档未声明」**，而不是「明确要求无鉴权」。
- `SKILL.md` 已有句子「An absent server or security fact is unknown; an explicit empty override stays empty」，
  但审计 agent 读到 operation 文件里的 `"security": null` 时仍未能把它与这句话联系起来。

即：语义约定存在，但**离使用点太远**——读者在 operation 文件里看到 `null`，不会回头翻 `SKILL.md` 的这句话。

### 缺口 3：`POST /files` 的必填性不可判定

`requestBody` 无 `required` 字段，`UploadReceipt` / `ApiError` 无 `required` 列表。Skill 未说明
「无 required」等于「无约束」还是「信息缺失」。属同一类问题：**OpenAPI 缺省语义未在 Skill 内显式化**。

### 非缺口（已核实为审计误解或噪音）

- 导航误导：无。所有链接命中。
- tag 文件：内容确实很薄（仅 `{name}` + 操作列表），信息量低，但它是合法索引页，非缺陷。
- 第 4 问的 `minimum: 1` 需人肉读 JSON：属正常契约数据读取，非缺陷。

## 结论与后续

**闭环成立**：前端通过 npm 包从运行中的服务生成 Skill，并据真实契约写出类型化客户端，7 个调用场景全部与文档一致。
这补齐了此前唯一未验证的「真实消费现场」空白。

**3 处缺口属同一根因**：生成器忠实导出了 OpenAPI 数据，但没有把 OpenAPI 的**缺省语义**
（`security` 缺失 = 未知、`required` 缺失 = 未声明、跨文档同名 schema = 独立定义）翻译成读者可见的说明。
它们不影响数据正确性，只影响首次集成的效率。

建议作为**独立后续任务**评估（未在本轮实施）：在 `SKILL.md` 或 per-operation 文件中，
用一句话把上述缺省语义显式化。任何改动都会改变生成产物，需要新的版本号与标签，
且必须走 core 的测试优先流程。

## 更新（2026-09-14，后续修复）

上述 3 处缺口已在 `1.3.0-SNAPSHOT` 源码中修复并通过全量验证（Java reactor 80 tests + Node 7 tests，零失败）：

- **缺口 1/2/3 的共同修复**：生成器在每个 operation 文件末尾产出「How to read the defaults above」小节，
  逐条说明 `security`/`servers` 为 `null` 是「文档未声明」而非「无需鉴权」、缺失 `required` 是「未声明约束」、
  同名 schema 保持 document-local、仅显式空值才是声明式覆盖；`SKILL.md` 正文同步携带该指引。
- **description 重构**（顺带增强）：`SKILL.md` description 升级为双语动作触发式——查找/解释/实现/调试 +
  finding/explaining/implementing/debugging，按 catalog 定位接口，核对参数、请求体、响应、状态码、Schema、
  鉴权与错误，生成或修改前端请求代码；分组列表经 `boundedList` 截断，32 文档最坏情况下仍是单行 YAML 安全值
  且 ≤1024 字符。不可信 API 源文本（标题、tag、summary）依旧不进入模板。
- **本 testbed 已重新验证**：用重打包的 `@fyuanz/smartdoc-agent@1.3.0` tarball 重装并重新生成 Skill（19 文件），
  新 description 为 587 字符单行，4 个 operation 文件全部带语义小节，account/business SHA-256 摘要与
  历史记录一致。
- 领域同义词（如 billing 的 账单/计费/发票）属不可信源文本，不能进 description；用户可配置的 description
  override 作为延后项记录在 DECISIONS.md。
