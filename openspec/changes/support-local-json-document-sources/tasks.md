# Tasks

## 1. 先写失败测试锁定 ACCEPTANCE

- [x] 1.1 在 `openapi-skill-node/test/project-config.test.mjs` 新增配置解析测试，断言 `services[].documents[].url` 接受 `./openapi/account.json` 和绝对路径，并返回相对的本地来源类型；运行 `npm run build && node --test test/project-config.test.mjs`，确认实现前这些断言失败。
- [x] 1.2 在 `openapi-skill-node/test/run.test.mjs` 或新本地来源测试中新增端到端失败测试：合法本地 JSON 文件生成 Skill、缺失文件失败、8 MiB 以上单文件失败、不支持版本失败，且失败时旧 Skill 不变；运行新增测试，确认实现前失败。
- [x] 1.3 保留并运行现有 HTTP 下载测试 `node --test test/run.test.mjs test/project-config.test.mjs`，记录实现前当前测试基线应仍通过。

## 2. 实现配置来源模型

- [x] 2.1 在 `openapi-skill-node/src/types.ts` 中新增内部来源类型并把本地绝对路径加入 `ResolvedDocumentSource`，保持公开 `DocumentSource.url` 字段不变；运行 `npm run build` 确认类型可通过。
- [x] 2.2 修改 `openapi-skill-node/src/config.ts`，让 `loadConfig()` 把 `cwd` 传入文档解析，将 `http://`/`https://` 识别为远程来源，其余字符串解析为本地绝对路径，并保持空路径/无效远程 URL 等旧校验不回归；运行 `node --test test/project-config.test.mjs` 确认新增配置测试和旧配置测试全部通过。
- [x] 2.3 更新配置错误消息，使远程与本地错误分别可定位，并运行项目配置测试确认断言覆盖错误边界不退化。

## 3. 实现本地读取并接入 run

- [x] 3.1 在 `openapi-skill-node/src/index.ts` 中新增本地文件读取函数，先 `stat` 且确认普通文件，超过 8 MiB 时不读入全文，读取失败使用 `<serviceId>/<documentId>: LOCAL: ...`；运行新增失败测试确认对应错误语义通过。
- [x] 3.2 修改 `downloadServices()` 根据来源类型分派 HTTP `fetch` 或本地 `readFile`，并复用单文档 8 MiB 与项目总计 32 MiB 预算；运行 `node --test test/run.test.mjs` 确认端到端本地生成、超限和原子保留测试通过。
- [x] 3.3 运行 `cd openapi-skill-node && npm test`，确认 Node 包全量测试通过且现有 HTTP、配置、生成和发布测试没有回归；若失败，修复后重跑并记录结果。

## 4. 文档同步

- [x] 4.1 更新 `openapi-skill-node/README.md` 和 `README.en.md`：添加本地 JSON 路径示例，修改“每个 URL 必须 HTTP(S)”等旧限制描述，说明本地相对路径以项目根目录为基准、仍受大小/失败原子性约束；用定向阅读确认两种语言一致。
- [x] 4.2 更新 `docs/openapi-skill-design.md` 的 Node 配置与安全边界段落，使其不再只声称“只访问 HTTP(S) URL”，并明确本地路径是逐项声明的受信输入；运行 `rg -n "每个 URL|只访问|HTTP\\(S\\)|本地 JSON|openapi-skill.config.json" docs/openapi-skill-design.md openapi-skill-node/README*.md` 复核没有过时表述。
- [x] 4.3 更新 `docs/codex/` 中受此能力影响的模块/结构/任务事实，并在 `docs/codex/DECISIONS.md` 记录本变更的设计决策；使用定向阅读确认新增记录与实现、规格一致。

## 5. 验证与交付

- [x] 5.1 运行 `openspec validate "support-local-json-document-sources"`，确认提案、规格和任务工件有效。
- [x] 5.2 运行 `openspec status --change "support-local-json-document-sources" --json`，确认 proposal/specs/design/tasks 均为完成状态且无缺失依赖。
- [x] 5.3 运行 `git diff --check` 并审查 `git status --short` 与 `git diff -- openapi-skill-node/src openapi-skill-node/test openapi-skill-node/README*.md docs openspec/changes/support-local-json-document-sources`，确认没有无关文件、秘密或生成构建产物被纳入。
- [x] 5.4 按项目里程碑交付规则提交本变更相关文件并正常推送到 `origin`；若远端缺失、认证失败或需要人工交互，停止并报告具体阻塞，不使用 force-push。
