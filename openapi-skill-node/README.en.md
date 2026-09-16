# openapi-skill

[简体中文](README.md) | **English**

Generate one self-contained Codex Skill from OpenAPI 3.1.0 JSON endpoints exposed by one or more services. The current, unpublished `1.1.0` source defaults to one API-documentation Skill per project and adds context-first LLM navigation. The package works in Vue 3 and other Node.js 20+ projects and can also be called as a TypeScript library.

## Install

```shell
npm install --save-dev openapi-skill
```

## Project configuration (recommended)

Create `openapi-skill.config.json` in the project root:

```json
{
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

In project mode, `skillName` is optional and defaults to `api-docs`, producing `<project>/.agents/skills/api-docs/`. A monorepo that genuinely needs multiple project-level Skills can set another root-level `skillName` explicitly.

The configuration levels have distinct roles:

- Root `keywords` help discover the complete project API Skill.
- Service `keywords` identify business services and appear, within a bounded length, in both the root Skill description and service catalog.
- Document `keywords` locate modules or groups after a service is selected. They stay in that service's catalog instead of filling the root description with fine-grained terms.
- `sourceType` accepts `internal` or `third-party` and defaults to `internal`. It records provenance; it does not change OpenAPI parsing semantics.
- Each `serviceId` must be unique within the project. A document ID only needs to be unique within its service, so several services may each expose a document named `public`.

Service and document boundaries remain intact: OpenAPI objects are not merged, `$ref` values are not resolved across documents, and gateway prefixes are not inferred. The output has one root `SKILL.md`; every service is physically included below `references/services/<serviceId>/` and reached through relative Markdown links. These are not filesystem symbolic links, so the complete `api-docs` directory remains portable.

Each service reference root uses `openapi-skill-core/2`. Every document has exactly one `context.md` listing all
operations with method/path, summary, tags, configured keywords, and direct Markdown links. LLM navigation starts there
and never requires reading or searching JSONL. Compact `operations.jsonl` and `schemas.jsonl` files remain as machine
validation indexes. Operation identities use service, document, HTTP method, and path rather than the optional or
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

Before publication, OpenAPI Skill downloads and validates every configured document from every service, generates and validates the complete project Skill, and then performs one directory replacement. If any service cannot be downloaded, contains an invalid contract, or fails generation, the complete previous Skill remains unchanged; OpenAPI Skill never publishes a subset that silently omits a service. A later successful replacement also removes services, documents, and operations no longer present in the configuration.

Each URL must use HTTP(S), return JSON successfully, and declare exact `openapi: 3.1.0`. Redirects and external `$ref` values are rejected. Set `output` to an absolute path or a path relative to the project root to change the output parent; the default is `.agents/skills`. `timeoutMs` defaults to `30000`. Configuration may instead be placed under `package.json#openapiSkill` or selected with `openapi-skill --config <path>`.

## Legacy single-service compatibility

Existing configurations do not need an immediate migration. Version `1.1.0` still accepts the original single-service shape and its explicit Skill name:

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

The package exports `run`, `loadConfig`, `generateSkill`, `generateProjectSkill`, `publishSkill`, and their TypeScript types. `generateSkill` remains available for single-service compatibility; prefer `generateProjectSkill` or `run` for project-level generation. Node.js 20 or newer is required.
