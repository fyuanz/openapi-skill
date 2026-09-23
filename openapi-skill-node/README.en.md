# openapi-skill

[简体中文](README.md) | **English**

Generate one self-contained Codex Skill from OpenAPI 3.0.x / 3.1.x JSON documents exposed over HTTP(S) or stored in local files. npm `latest` is `2.1.2`; it defaults to one API-documentation Skill per project and navigates by OpenAPI `tags`: one file per tag under its own readable name, with Chinese tag names kept verbatim. The package works in Vue 3 and other Node.js 20+ projects and can also be called as a TypeScript library.

## Install

```shell
npm install --save-dev openapi-skill
```

## Project configuration (recommended)

Create `openapi-skill.config.json` in the project root:

```json
{
  "output": [".codex/skills", ".trae/skills"],
  "keywords": ["API documentation", "frontend integration"],
  "services": [
    {
      "serviceId": "account-service",
      "sourceType": "internal",
      "keywords": ["users", "accounts", "permissions"],
      "documents": [
        {
          "id": "account",
          "url": "http://127.0.0.1:18080/v3/api-docs/account",
          "keywords": ["login", "registration", "profiles"]
        },
        {
          "id": "permission",
          "url": "http://127.0.0.1:18080/v3/api-docs/permission",
          "keywords": ["roles", "RBAC"]
        }
      ]
    },
    {
      "serviceId": "logistics-provider",
      "sourceType": "third-party",
      "keywords": ["logistics", "shipping"],
      "documents": [
        {
          "id": "shipping",
          "url": "https://api.example.com/openapi.json",
          "keywords": ["waybills", "tracking"]
        }
      ]
    }
  ]
}
```

A locally exported OpenAPI JSON document can use the same `url` field. Relative paths are resolved from the project root where the CLI runs:

```json
{
  "id": "account",
  "url": "./openapi/account.json"
}
```

In project mode, `skillName` is optional and defaults to `api-docs`. Omitting `output` produces only `<project>/.agents/skills/api-docs/`. The existing single path string remains compatible, or configure 1 to 8 paths as above to distribute the same Skill to several agents. Relative paths resolve from the project root; duplicate, nested, and filesystem-root targets are rejected before documents are read. A monorepo that genuinely needs several project-level Skills with different content can use separate configurations with explicit `skillName` values.

The configuration levels have distinct roles:

- Root `keywords` help discover the complete project API Skill.
- Service `keywords` identify business services and appear, within a bounded length, in both the root Skill description and service catalog.
- Document `keywords` locate modules or groups and appear in both the outer and service catalogs, without entering the root Skill description.
- `sourceType` accepts `internal` or `third-party` and defaults to `internal`. It records provenance; it does not change OpenAPI parsing semantics.
- Each `serviceId` must be unique within the project. A document ID only needs to be unique within its service, so several services may each expose a document named `public`.

Service and document boundaries remain intact: OpenAPI objects are not merged, `$ref` values are not resolved across documents, and gateway prefixes are not inferred. The output has one root `SKILL.md`; every service is physically included below `references/services/<serviceId>/` and reached through relative Markdown links. These are not filesystem symbolic links, so the complete `api-docs` directory remains portable.

Both the outer `references/catalog.md` and each service catalog list discovery entries by document and first tag: summary, operationId, HTTP method/path, additional tags and configured keywords. Every operation remains searchable even without a summary; no synonyms or contract bodies are invented or copied. Same-named actions keep their service/document ownership. Exceeding the total output budget fails generation and retains the previous Skill rather than truncating entries.

Follow outer catalog → service catalog → document context → group → operation. Match a known method/path exactly; inspect the contracts of multiple candidates and check other candidate documents and groups before concluding an interface is undocumented.

Each service reference root uses `openapi-skill-core/3`. Every document has exactly one `context.md`, and it is a
**group index**: it lists each of the document's tag groups with its interface count. Each group opens
`groups/<tag>.md`, whose file name is the OpenAPI tag itself (Chinese names are kept verbatim), holding one
`- [semantic title](../operations/<file>.md) — \`METHOD /path\`` line per operation. An operation belongs to its
**first** tag only, so when a contract is not in the expected group, check the document's other groups first. The
document's declared servers and security facts live in the service `catalog.md` instead of consuming mandatory-read
context space. Compact `operations.jsonl` and `schemas.jsonl` files remain as machine
validation indexes (the former carries `group`/`groupFile` columns), and LLM navigation never requires reading or
searching them. Operation identities use service, document, HTTP method, and path rather than the optional or
duplicate-prone SpringDoc `operationId`; the latter remains a navigation alias. Operation and Schema files use clean
semantic names such as `get-users-by-id.md` when unique; a short digest appears only for a case-insensitive collision or
filesystem-safety fallback. Each operation also contains a generator-computed direct/transitive reference list and
recursive edges, so the LLM does not have to derive the `$ref` closure.

## Run and atomic updates

Add an npm script and run it after every configured API service is available:

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

On failure, the CLI writes one stable diagnostic to stderr and exits with status `1`, for example:

```text
ERROR user-service/account [PARSE/INVALID_JSON]: expected a colon (line 42, column 17)
```

JSON syntax failures include one-based line and column numbers when they can be determined reliably. Default diagnostics do not echo OpenAPI content, HTTP headers, or remote-URL credentials, query parameters, and fragments. Run `openapi-skill --debug` to append the complete stack and `cause` chain; it can be combined with `--config <path>` in either order. Debug output may contain source details, so review and redact it before posting it to a public issue.

Before publication, OpenAPI Skill reads and validates every configured document from every service, then generates and validates the complete project Skill only once. If an HTTP download, local file read, contract validation, or generation step fails, every previous Skill remains unchanged; OpenAPI Skill never publishes a subset that silently omits a service. A later successful replacement also removes services, documents, and operations no longer present in the configuration.

Each output directory is an independently atomic publication unit: the CLI attempts every target in configuration order, but the directories do not form one transaction. If one target fails, the command exits with status `1` after reporting `OK` / `FAILED` for every target. Successful targets are not rolled back, while a failed target retains its previous complete Skill or remains absent. Fix the failed target and rerun safely.

Each document `url` may be an HTTP(S) URL or a plain local file path. Relative local paths are resolved from the project root where the CLI runs; `file://` URLs, directory discovery, and globs are not supported. HTTP sources must return JSON successfully and redirects are rejected; local sources must be regular files. Both source kinds must declare a supported `openapi: 3.0.x` or `3.1.x`, share the 8 MiB per-document and 32 MiB project input limits, and reject external `$ref` values. `timeoutMs` applies only to HTTP downloads and defaults to `30000`. Set `output` to one absolute/relative output parent or an array of 1 to 8 such paths; the default is `.agents/skills`. Configuration may instead be placed under `package.json#openapiSkill` or selected with `openapi-skill --config <path>`.

## Legacy single-service compatibility

Existing configurations do not need an immediate migration. Version `2.0.0` still accepts the original single-service shape and its explicit Skill name, but its output is the same core/3 layout:

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

Do not combine root-level single-service fields with `services`. New projects should use `services`, which lets them add microservices or third-party APIs without changing the Skill entrypoint.

## Library API

The package exports `run`, `loadConfig`, `generateSkill`, `generateProjectSkill`, `publishSkill`, `MultiOutputPublishError`, and their TypeScript types. A successful `run` result lists every target in `skillDirectories`, while the compatible `skillDirectory` field points to the first target. Partial publication throws `MultiOutputPublishError` with the per-target results. `generateSkill` remains available for single-service compatibility; prefer `generateProjectSkill` or `run` for project-level generation. Node.js 20 or newer is required.
