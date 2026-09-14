# 项目长期约定（smart-doc-agent）

## 运行环境（本机 Windows 专用，反复踩坑）

- **Maven 不能从 Git Bash 直接调**。裸 `mvn` 报
  `ClassNotFoundException: org.codehaus.plexus.classworlds.launcher.Launcher`。正确姿势是绕开 `mvn` 包装脚本，
  直接用 java 启动 classworlds：
  ```bash
  "$JAVA_HOME/bin/java" -classpath "D:\apache-maven-3.9.16\boot\plexus-classworlds-2.11.0.jar" \
    "-Dclassworlds.conf=D:\apache-maven-3.9.16\bin\m2.conf" \
    "-Dmaven.home=D:\apache-maven-3.9.16" \
    "-Dmaven.multiModuleProjectDirectory=F:\admin_dev\smart-doc-agent\<模块>" \
    org.codehaus.plexus.classworlds.launcher.Launcher -B <goals>
  ```
  `classworlds` jar 版本以 `boot/` 目录实际文件名为准；**必须**带 `maven.multiModuleProjectDirectory`。
- **PowerShell 工具会拦截** `Start-Process` 启动 `mvn.cmd` / `cmd.exe`（安全策略）。且该工具 stdout 经常不回显，
  需要写文件再 `Read`。长驻服务进程改用 Bash 工具 `run_in_background` 前台运行最稳。
- **Bash 工具 PATH 缺 coreutils**（`cat`/`head`/`dirname`/`ls` 都不可用）。每次命令前置
  `export PATH="/usr/bin:/bin:$PATH"`（要 Node 就再前置 node 目录）。
- **Vite dev server 只绑 `localhost`**（含 IPv6 `::1`）。用 `127.0.0.1:<port>` 访问会 502，必须用 `localhost:<port>`。
- **Git Bash 的 curl 不支持 `-F` multipart**（返回 status 000，直连也失败）。验证 multipart 用 Node `fetch` + `FormData`。
- Node 中 `/tmp/x.mjs` 会被解析成 `F:\tmp\x.mjs`。临时脚本写到项目内、用相对路径调用。
- SpringBoot testbed 的 `application.properties` 里 `server.port=18080` **会被测试用随机端口覆盖**；手工
  `spring-boot:run` 时要显式 `-Dspring-boot.run.arguments=--server.port=18080`。
- 本机 Maven 3.9.16 / JDK 17.0.19 (Azul, `C:\Users\fyuan\.jabba\jdk\default`)。`gh` CLI 未安装。

## 交付流程约定

- 遵守 `AGENTS.md`：测试优先 → 更新受影响的 `docs/codex/` 文档 → 提交可独立评审的切片 → 正常 push（禁止 force）。
- **不改动已有发布标签**。`v1.0.0`/`v1.1.0`/`v1.2.0` 标识各自发布源码；后续改动就是后续源码，需要新版本+新标签。
- 任何改变**生成产物**的改动都必须升版本，并走 core 的测试优先流程。
- 提交前用 `git add -A --dry-run` 预演，确认没有 `node_modules/`、`dist/`、`target/`、生成 Skill 等产物混入。

## 产品边界（不要越界）

- 只支持精确 `openapi: 3.1.0` JSON。不支持 Swagger 2.0、YAML、外部 `$ref`、WebFlux。
- **不做语义合并**：多文档只做原子聚合，引用保持 document-local。因此跨分组同名 schema（如 `Address`）
  是各自独立的定义，这是设计选择而非缺陷。
- Core 必须与 Spring Boot / SpringDoc / Maven / HTTP / ZIP 解耦。
- 运行时收集必须用 `OpenApiWebMvcResource` / `MultipleOpenApiWebMvcResource`，
  **不能**注入基础 `OpenAPI` bean 当最终契约，也不能发 HTTP 自请求。
- API 源文本是不可信参考数据，永不进入受信任的 Skill 指令模板。
- 两级路径：`testbeds/springdoc-multi-package`（生产者）、`testbeds/vue-ts-consumer`（消费者）职责不同，别混用。

## 生成的 Skill 布局（`smartdoc-agent-core/1`）

```
<skillName>/
  SKILL.md                          # 受信任指令模板，不含源码文本
  references/catalog.md             # 分组 → 操作/schema/tag 索引
  references/source.json            # 输入快照 SHA-256（非 live 新鲜度）
  references/documents/<docId>/context.md
  references/documents/<docId>/operations/<method>-<sha>.md
  references/documents/<docId>/schemas/<sha>.md
  references/documents/<docId>/tags/<sha>.md
```
operation 文件含 `security` / `servers` 的**有效值**（`inherited()` 逐层 `has(key)`）。
`null` 表示「文档未声明」，**不是**「明确要求无鉴权」。
