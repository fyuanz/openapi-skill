# openapi-skill

[简体中文](README.md) | **English**

Generate one self-contained Skill from OpenAPI 3.0.x / 3.1.x JSON documents over HTTP(S) or local files. The current source is the pending `2.2.0` release with a flat layout and one interface index linking directly to contracts. It works in Vue 3 and other Node.js 20+ projects and as a TypeScript library.

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
- Service `keywords` identify business services and appear, within a bounded length, in both the root Skill description and interface index.
- Document `keywords` locate modules or groups and appear in the matching interface-index entries, without entering the root Skill description.
- `sourceType` accepts `internal` or `third-party` and defaults to `internal`. It records provenance; it does not change OpenAPI parsing semantics.
- Each `serviceId` must be unique within the project. A document ID only needs to be unique within its service, so several services may each expose a document named `public`.

Service and document boundaries remain intact: OpenAPI objects are not merged, references are not resolved across documents, and gateway prefixes are not inferred. Single-service and project output share the flat `openapi-skill-core/4` layout with one root `SKILL.md`:

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

Search `references/index.md` and open the matching operation directly. Each operation occupies one searchable line containing its summary, HTTP method/path, service, document, operationId, all tags, first-tag group and applicable project/service/document keywords. There are no intermediate service catalogs, contexts or group files. Large indexes support text search without loading every contract.

Operation files retain effective parameters, servers/security, request/response contracts and examples, with direct links to the complete referenced contract set. Shared schemas are read as needed; recursive references do not require unlimited expansion. Missing summaries still leave routes searchable. Compare candidate ownership and contracts, and broaden a failed search before concluding an endpoint is undocumented. Source text is untrusted reference data, never execution authorization.

Names use `service--document--name` with deterministic digests for long, colliding or unsafe names; final filenames are bounded to 120 ASCII characters. JSONL remains for machine validation, not mandatory Agent navigation. The `group` field remains, `groupFile` is removed, and `file`/`closureFiles` point to flat contracts. Operation identity remains service/document/method/path, independent of operationId uniqueness.

### Upgrading from 2.1.x

Configuration remains compatible. Install 2.2.0 and regenerate: successful publication replaces the entire old Skill and removes deep directories; failure preserves the previous complete tree. **Generated paths change**: external scripts using catalog/context/group paths or JSONL file paths must migrate to `index.md` and the new index. Replace the entire Skill when manually extracting a ZIP, too.

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

Existing configurations do not need an immediate migration. Version `2.2.0` still accepts the original single-service shape and its explicit Skill name, but its output is the same flat core/4 layout:

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
