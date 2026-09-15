# smartdoc-agent

[简体中文](README.md) | **English**

Generate one Codex Skill from one or more OpenAPI 3.1.0 JSON endpoints. The package is written in TypeScript and can be used as a development dependency in Vue 3 or other Node.js projects, or as a library.

## Install and configure

```shell
npm install --save-dev smartdoc-agent
```

Create `smartdoc-agent.config.json` in the project root:

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

Add an npm script and run it after the local API service starts:

```json
{
  "scripts": {
    "skill:generate": "smartdoc-agent"
  }
}
```

```shell
npm run skill:generate
```

The default output is `<project>/.agents/skills/<skillName>/`. Set `output` to an absolute path or a path relative to the project root to change its parent directory. `timeoutMs` defaults to 30000. Configuration may alternatively be placed under `package.json#smartdocAgent`, or selected with `smartdoc-agent --config <path>`.

All configured documents are downloaded before publication. Each URL must use HTTP(S), return JSON successfully, and contain exact `openapi: 3.1.0`. A failed download or validation never replaces a previously valid generated Skill. Redirects and external `$ref` values are rejected.

## Library API

The package exports `run`, `loadConfig`, `generateSkill`, and `publishSkill`, together with their TypeScript types. Node.js 20 or newer is required.
