# vue-ts-consumer — 闭环验证报告

本文件记录 2026-09-14 第一次「真实前端消费端」闭环测试的结果与发现。它是**测试证据**，不是产品文档。

## 2026-09-18 复现性缺口：被 pin 的 tarball 与行尾

一次干净 clone 的验收暴露两个独立缺陷，本次一并修复。

**缺口 1 — 被 lock 引用的 tarball 不在版本控制里。**
`.gitignore:8` 忽略 `openapi-skill-node/*.tgz`，`git ls-files "*.tgz"` 返回空，而 `package.json`
与 `package-lock.json` 引用 `file:../../openapi-skill-node/openapi-skill-2.1.0.tgz`。
在**空 cacache** 的干净 clone 上实测，`npm ci` 失败：

```
npm warn tarball tarball data for openapi-skill@file:...openapi-skill-2.1.0.tgz ... seems to be corrupted. Trying again.
npm error code ENOENT  path F:\...\openapi-skill-node\openapi-skill-2.1.0.tgz
```

报错文案是 **"corrupted"**，真实原因却是**文件不存在**——这个误导会让人去查包内容而不是查路径。
更隐蔽的是**本机不暴露**：这台机器的 cacache 已有该 tarball，npm 按 lock 的 integrity 从缓存还原，
`npm ci` 静默通过。即**有缓存的机器全绿、新机器与 CI 全红**。

**缺口 2 — `npm pack` 不是跨行尾可复现的，根因是 `core.autocrlf=true`。**
从源码重建 tarball（`npm ci && npm run build && npm pack`，24 个条目）后比对：

| 来源 | 字节 | sha1 |
| --- | --- | --- |
| 仓库里被 lock 引用的 | 29,108 | `b155643989b6121e1c1b701affaffb71e7ac4be9` |
| 干净 clone 重建（默认 Git 设置） | 29,289 | `fc8762657b6e1f8b7fb4941c872f00ccedac60dc` |

解包逐文件 `cmp` 定位到差异**全部来自行尾**：`LICENSE`、`README.md`、`README.en.md`、
`dist/generator.js`（内嵌多行 `CONVENTIONS` 模板）、`package.json` 共 5 个文件，仓库侧 `\n`、
重建侧 `\r\n`；其余 19 个文件逐字节相同，181 B 的字节差恰是这些文件的行数之和。

根因链：`core.autocrlf=true`（来自 `C:/Program Files/Git/etc/gitconfig`，Git for Windows 的 system 级
默认）把 index 里的 LF 检出成 CRLF → `tsc` 输出保留 CRLF → `npm pack` 打包 CRLF → sha512 与 lock 不符。
`git ls-files --eol` 可确认：index 是 `i/lf`，主工作区恰好是 `w/lf`（这些文件由工具以 LF 写入，绕过了
git 的 CRLF 检出），而**任何真正 clone 出来的人拿到的是 CRLF**。在 CRLF 检出下按步骤诚实重建，
`npm ci` 报：

```
npm error code EINTEGRITY
npm error ... wanted sha512-OxRsp/7J... but got sha512-2kGADGxCWvR... (29289 bytes)
```

同一份源码、两个检出状态、两个不同的包。对照实验：`git clone -c core.autocrlf=false` 后重建，
tarball 与仓库里那个**逐字节相同**（29,108 B / `b1556439…`），证明 `npm pack` 本身是确定性的，
唯一的不可复现源是行尾。

**处置**：把被 pin 的 tarball 纳入版本控制（根 `.gitignore` 增加
`!openapi-skill-node/openapi-skill-2.1.0.tgz` 例外），fresh clone 直接 `npm ci` 可用。
**没有**改用 `.gitattributes` 强制 `eol=lf`：`fixtures/*.json` 的 sha256 是按 CRLF 字节记录在
`metadata.json` 里的（本次复算四条全部吻合），强制 LF 会连带作废这些快照记录与测试输入字节，
超出本次修复范围。行尾问题按上述证据留作独立切片。

## 2026-09-18 OpenAPI 3.0.x 接受集复验

- 安装本地打包的 `openapi-skill@2.1.0` tarball（24 个文件，29,108 B；shasum
  `b155643989b6121e1c1b701affaffb71e7ac4be9`）；`npm ci` 按手工更新的 lock 还原通过，Node 43 项测试通过。
- 用改动后的源码对同一批 testbed 文档重新生成，与已发布 2.0.0 生成的 24 文件树**逐字节相同**：整树 SHA-256 仍是
  `745f0e0ec44a9eda52fb0868c00c0600b193307b19e2b39f0966f752721148bc`。放宽根标记接受集并按输入记录方言，
  不改变任何 3.1.0 输入的产物，`openapi-skill-core/3` 布局与已发布哈希继续有效。
- 新增真实 3.0 快照 `fixtures/account-v30.json`、`fixtures/business-v30.json`，来自同一 SpringDoc 测试服务在
  `springdoc.api-docs.version=OPENAPI_3_0` 下的输出（根标记 `3.0.1`；2 operation / 3 schema 与 2 operation /
  4 schema）。Java core 与 Node 两侧都能生成同一布局（4 operation / 7 schema）。
- **方言差异属生产端行为**：同一批控制器在 3.0 下，`$ref` 的兄弟节点被生产端丢弃
  （`UserView.address.description`、`CreateOrder.shippingAddress.description` 在 3.1 存在、在 3.0 不存在）。
  转换器按字节搬运原文，不补回这些字段。

## 2026-09-16 core/3 tag 分组补充验证

- 安装本地未发布的 `openapi-skill@2.0.0` tarball（24 个文件，28,419 B；shasum
  `32eac2110ebe5a9893cc2a980062285ce0ed90fc`），Node 41 项测试及 Vue 严格类型/生产构建通过。
- 从两个真实 SpringDoc 分组重新生成 `openapi-skill-core/3` project Skill：24 个文件、2 份分组索引 `context.md`、
  3 个中文分组文件（`用户管理.md`、`订单管理.md`、`文件管理.md`）、4 个 operation、37 条相对链接 0 断链、
  0 个摘要后缀契约、可信导航 0 处 JSONL 引用。
- `verify-skill-tree.mjs` 已按 core/3 重写（文件数、分组文件、分组索引上下文、catalog 承载 servers/security、
  每个 operation 恰好被一个分组列出且为单行精简格式）。连续两次生成的整树 SHA-256 恒为
  `745f0e0ec44a9eda52fb0868c00c0600b193307b19e2b39f0966f752721148bc`。
- **跨实现比对**：从运行中的 testbed `GET /openapi-skill/skill.zip`（15,807 B）解出 Java 运行时产物，与本
  Node 工程内嵌的同一 service 子树逐文件比对 —— 文件集合与路径**完全一致（21 = 21）**，其中 6 个字节相同
  （`conventions.md`、`operations.jsonl`、`schemas.jsonl` 及 3 个分组文件），11 个在把 fenced JSON 重新序列化后
  相同，其余 4 个仅相差消费端配置的关键词/`sourceType` 与运行时默认 `skillName`。
- **已记录的已知差异**：Java（Jackson）与 Node（`JSON.stringify`）的 JSON 缩进风格不同，因此上面 11 个文件
  并非跨实现逐字节相同。该差异早于本次改造、只影响 Markdown 代码块内的排版、不影响任何被解析的值；对齐
  序列化器留作独立切片。
- **打包陷阱**：同版本号重新打包后，`package-lock.json` 仍钉着上一次的 integrity，`npm install` 会按 integrity
  从缓存恢复旧构建——消费者在修复后仍复现同一错误，直到清掉 lock 重装才真正用上新 tarball。

## 2026-09-16 P13 core/2 context-first 补充验证

- 安装本地未发布的 `openapi-skill@1.1.0` tarball（24 个文件，26.0 kB；shasum
  `2a2837a61ce3ddf5bb752f4620df12d0eaa3041c`），Node 30 项测试及 Vue 严格类型/生产构建通过。
- 从两个真实 SpringDoc 分组重新生成 `openapi-skill-core/2` project Skill。每个 document 只有一份完整且不拆分的
  `context.md`，其中每个 operation 恰好出现一次并有直接 Markdown 链接；可信 `SKILL.md` 不再要求搜索 JSONL。
- 普通 operation/schema 路径使用无摘要的纯语义文件名；只有真实大小写冲突或文件系统安全回退才追加短摘要。
- operation 页面包含生成器预计算、排序去重的直接/传递引用闭包和递归边。JSONL 仍保留为机器校验索引。
- 输出共 21 个文件、2 个 context、0 个普通摘要后缀契约、0 个断链。重复生成整树 SHA-256 均为
  `253e8c9d13c750817d9370f069a5375d3fe8baeff97eaf3bf6fb477f31b0f1e8`；本次只验证本地源码和消费链路，
  未发布 npm/Maven 包。

## 2026-09-16 openapi-skill 改名补充验证

- 安装本地 `openapi-skill@1.0.0` tarball（24 个条目，23,408 bytes），`npm run build` 成功。
- 从运行在 `127.0.0.1:18080` 的两个真实 SpringDoc 分组执行 `npm run skill:generate` 成功，输出 21 个文件。
- 输出为 `openapi-skill-core/1` project Skill；每个服务包含排序的 `operations.jsonl` / `schemas.jsonl` 和
  一份 `conventions.md`。
- operation/schema 文件名使用可读 slug 和 6 位短摘要；生成树未发现 32 位以上摘要文件名或 `tags/` 文件。
- 下文保留旧 `smartdoc-agent` 名称下的原始历史证据。

## 闭环链路

```
testbeds/springdoc-multi-package  (Spring Boot 3.5.9 + springdoc 2.8.15, :18080)
        │  GET /v3/api-docs/account   (account 组, 2 operations)
        │  GET /v3/api-docs/business  (business 组, 2 operations)
        ▼
smartdoc-agent-node  @fyuanz/smartdoc-agent@1.3.0  (历史本地 tgz 安装)
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
| 依赖安装 | `mvn -B -DskipTests install` | BUILD SUCCESS（4 模块，1.0.0） |
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
`Address` 在各自 `components.schemas` 下确实是两份独立定义；设计边界明确不做语义合并。生成器忠实反映了这一点。
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
- **本 testbed 已重新验证**：用重打包的 `@fyuanz/openapi-skill@1.3.0` tarball 重装并重新生成 Skill（19 文件），
  新 description 为 587 字符单行，4 个 operation 文件全部带语义小节，account/business SHA-256 摘要与
  历史记录一致。
- 领域同义词（如 billing 的 账单/计费/发票）属不可信源文本，不能进 description；用户可配置的 description
  override 作为延后项记录在 DECISIONS.md。

## 更新（2026-09-15，Node 1.4.0 项目模式端到端生成）

同一闭环改用 `1.4.0` 的项目模式重跑。链路前半段不变（SpringDoc testbed `:18080` → 本地 tgz 安装 → `npm run
skill:generate`），变化在生成产物与配置形态。

| 步骤 | 命令 | 结果 |
| --- | --- | --- |
| 打包 | `npm pack` | `openapi-skill-1.4.0.tgz`，24 个条目，21,058 B（解包 74,238 B） |
| 安装 | `npm install`（`file:` 依赖） | `node_modules/openapi-skill` 解析为 `1.4.0` |
| 后端 | `spring-boot:run --server.port=18080` | account 200（2 paths）、business 200（2 paths）、`/openapi-skill/skill.zip` 200（17,043 B） |
| 生成 | `npm run skill:generate` | 21 files → `.agents/skills/api-docs/`（`openapi-skill-core/2`、`kind=project`） |
| 校验 | 自写校验脚本 | 32 条相对链接全部命中，无嵌套 `SKILL.md`，描述为 464 字符单行，三类关键词均有序去重 |
| 确定性 | 重复生成 | 整树 SHA-256 恒为 `b8940cff…9dfc`，`.openapi-skill/staging`、`backups` 均为空 |
| 失败保留 | business 指向关闭端口 | CLI 退出码 1（`DOWNLOAD: fetch failed`），旧 Skill 整树字节不变 |
| 陈旧清理 | serviceId 改名后重生成 | `references/services/` 仅剩新服务目录 |
| 构建 | `npm run build` | `vue-tsc` 严格检查 + `vite build` 通过，71.74 kB JS / 1.43 kB CSS |
| 实时一致性 | 重新拉取两个端点计算 SHA-256 | `686c1b8b…6d87` / `ae7e7d84…290c`，与 `source.json` 完全一致 |

1.4.0 的产物形态与上一版不同：**唯一**入口 `SKILL.md` 位于根目录，服务内容物理内嵌在
`references/services/<serviceId>/references/`，不使用符号链接，复制整个 `api-docs` 目录即可使用。

一处需人工处理的残留：项目模式把 Skill 名默认成 `api-docs`，因此从旧的单服务 `springdoc-multi-package-api`
切换过来时，旧目录不会被自动删除——整树替换保证只在同一 Skill 名内生效。本 testbed 已手工删除该旧目录。

## 更新（2026-09-16，P13 独立复验）

上一节（P13 补充验证）的记录脚本不在仓库内，其整树哈希无法复现。本节用**固定算法**重做一遍，并补齐两处更正。

| 步骤 | 命令 / 方法 | 结果 |
| --- | --- | --- |
| Java 干净构建 | `mvn -B clean install` | BUILD SUCCESS，70 测试（68 core + 2 Starter） |
| JAR 纯净度 | `jar tf` 统计包名 | 17 个 `io/github/fyuanz` class，0 个旧 `com/smartdoc`（非 clean 构建会混入后者） |
| Node 测试 | `node --test "test/*.test.mjs"` | 30 通过 |
| dist 新鲜度 | `tsc` 重编译后比对 md5 | 与已安装 dist 逐字节一致 |
| 打包一致性 | `npm pack` 重新打包比对 | shasum `2a2837a61ce3ddf5bb752f4620df12d0eaa3041c`，与磁盘上的 `openapi-skill-1.1.0.tgz` 完全相同 |
| 生成 | `openapi-skill`（`:18080` 实时服务） | 21 文件；2 份 context；0 个摘要后缀契约；32 条相对链接全通；4 个 operation 均含精确安全语义；可信导航 0 处 JSONL 引用 |
| 确定性 | 连续两次生成 | 整树哈希恒为 `99547bf1a8b8…` |
| 实时一致性 | 重新拉取两个端点 | `3a5bbf4e…` / `45f43c83…`，与 `source.json` 完全一致 |
| 构建 | `npm run build` | `vue-tsc` + `vite build` 通过，71.74 kB JS / 1.43 kB CSS |

**整树哈希算法**（此前只记了裸哈希，脚本已随 `target/` 清理丢失，故此处钉死定义）：取树内所有文件，按 POSIX 相对
路径排序，对每条生成 `相对路径 + "\0" + sha256(文件内容)`，以 `\n` 连接后整体再做 sha256。按此定义，当前
21 文件树的值为 `99547bf1a8b8…`；上节的 `253e8c9d…` 无法用已知归一化复现，仅作历史记录保留。

**摘要更正**：本文件 2026-09-14 / 2026-09-15 两节记录的 `686c1b8b…` / `ae7e7d84…` 属于**改名之前**的文档字节。
改名提交 `50a96c7` 修改了 testbed 的 OpenAPI 身份（`OpenAPI Skill 多包测试服务` 等），实时文档因此合法地变为
`3a5bbf4e…` / `45f43c83…`。旧值不是缺陷，但**不能当作当前值**引用。
