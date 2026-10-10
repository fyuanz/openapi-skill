# openapi-skill

[简体中文](README.md) | **English**

Turn OpenAPI documents from one or more services into an API documentation Skill for AI coding agents. The generated Skill includes a searchable operation index, request and response contracts, and related schemas so agents can look up project APIs while writing and integrating code.

## Features

- **Project-wide documentation**: include microservices and third-party APIs in one Skill while preserving service and document ownership.
- **On-demand lookup**: find an operation, then read its parameters, request body, responses, security requirements, and examples.
- **Remote and local sources**: read OpenAPI 3.0.x / 3.1.x JSON over HTTP(S) or from local files.
- **Multiple agent directories**: generate once and distribute the same Skill to one or more destinations.
- **Repeatable updates**: rerun to replace generated content; source read or validation failures preserve existing Skills.
- **CLI and library API**: use npm scripts or integrate with JavaScript / TypeScript tools.

## Contents

- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Multiple services and output directories](#multiple-services-and-output-directories)
- [CLI usage](#cli-usage)
- [Generated files](#generated-files)
- [Supported inputs and limits](#supported-inputs-and-limits)
- [Updates and troubleshooting](#updates-and-troubleshooting)
- [Library API](#library-api)
- [Upgrading and compatibility](#upgrading-and-compatibility)
- [License](#license)

## Quick start

Requires **Node.js 20 or newer**.

### 1. Install

Run in the project where you want to use the API documentation:

```shell
npm install --save-dev openapi-skill
```

### 2. Configure

Create `openapi-skill.config.json` in your project root:

```json
{
  "services": [
    {
      "serviceId": "my-service",
      "documents": [
        { "id": "public", "url": "./openapi.json" }
      ]
    }
  ]
}
```

Replace `./openapi.json` with your OpenAPI JSON file path, or use a service URL such as `http://localhost:8080/v3/api-docs`. Make sure remote services are reachable before generating.

### 3. Generate the Skill

Add a script to your `package.json`:

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

The default output is `.agents/skills/api-docs/`, with `SKILL.md` as its entry point. Set the output to your agent's Skill directory so it can reference these API documents. Rerun the same command whenever your API documentation changes.

## Configuration

By default, the CLI looks for `openapi-skill.config.json` in the project root, then falls back to the `openapiSkill` field in `package.json` if no configuration is found. Use `--config <path>` to select a configuration file explicitly.

**Path resolution**: configuration paths, local document paths, and relative output paths resolve from the directory where you run the command, or from `cwd` when using the library API. Selecting a configuration file in another directory does not change this base.

### Project fields

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `services` | Array | Required | 1–32 services, with at most 32 documents across the project |
| `skillName` | String | `api-docs` | Skill name and output subdirectory name |
| `output` | String or string array | `.agents/skills` | Output parent directories; 1 to 8 absolute or relative paths |
| `keywords` | String array | `[]` | Keywords for discovering the project Skill |
| `timeoutMs` | Positive integer | `30000` | Shared HTTP download timeout budget in milliseconds; does not limit local file reads |

For example, `output: ".codex/skills"` and `skillName: "api-docs"` produce `.codex/skills/api-docs/`. Output parents cannot be duplicates, nested within one another, or filesystem roots.

### Service fields: `services[]`

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `serviceId` | String | Required | Unique service identifier within the project |
| `documents` | Array | Required | OpenAPI documents for this service |
| `sourceType` | String | `internal` | `internal` or `third-party`; records provenance only |
| `keywords` | String array | `[]` | Service keywords included in the Skill description and operation index |

### Document fields: `services[].documents[]`

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `id` | String | Required | Unique within its service; different services can reuse an ID |
| `url` | String | Required | HTTP(S) URL or plain local file path |
| `keywords` | String array | `[]` | Module or group keywords included in the operation index |

Identifiers: use lowercase letters and digits separated by single hyphens for `skillName`, `serviceId`, and document `id`. Names must be at most 63 characters and avoid Windows reserved device names.

## Multiple services and output directories

This example includes an internal account service and a third-party shipping API in one Skill, distributed to two agent directories. Replace the sources with your own:

```json
{
  "output": [".codex/skills", ".trae/skills"],
  "keywords": ["API documentation", "frontend integration"],
  "services": [
    {
      "serviceId": "account-service",
      "keywords": ["users", "permissions"],
      "documents": [
        {
          "id": "account",
          "url": "http://localhost:8080/v3/api-docs/account",
          "keywords": ["login", "registration"]
        },
        {
          "id": "permission",
          "url": "./openapi/permission.json"
        }
      ]
    },
    {
      "serviceId": "logistics-provider",
      "sourceType": "third-party",
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

The output directories are `.codex/skills/api-docs/` and `.trae/skills/api-docs/`, both containing the same files. To generate Skills with different content, use separate configuration files and `skillName` values.

## CLI usage

After installation, run in your project:

```shell
npx openapi-skill
npx openapi-skill --config ./config/api-docs.json
npx openapi-skill --config ./config/api-docs.json --debug
```

Pass options through an npm script:

```shell
npm run skill:generate -- --debug
```

| Option | Description |
| --- | --- |
| `--config <path>` | Select a configuration file |
| `--debug` | Append the complete error stack and cause chain to diagnostics |

Exit codes: `0` for success, `1` for generation or output failures, and `2` for invalid CLI arguments.

## Generated files

```text
api-docs/
|-- SKILL.md
+-- references/
    |-- index.md
    |-- conventions.md
    |-- source.json
    |-- operations.jsonl
    |-- schemas.jsonl
    |-- operations/
    |-- schemas/
    +-- refs/
```

| File or directory | Purpose |
| --- | --- |
| `SKILL.md` | Agent entry point and reading instructions |
| `references/index.md` | Search by summary, HTTP method, path, tags, or keywords |
| `references/operations/` | Operation contracts: parameters, requests, responses, servers, security, and examples |
| `references/schemas/`, `references/refs/` | Referenced schemas and other contracts, read as needed |
| `references/conventions.md` | Documentation usage conventions |
| `references/source.json` | Source metadata |
| `references/*.jsonl` | Machine-readable indexes for tools |

Agents open operations directly from the index, then follow links to related schemas. Service and document boundaries remain intact: OpenAPI objects are not merged, and gateway prefixes are not inferred.

## Supported inputs and limits

| Item | Support |
| --- | --- |
| Document format | OpenAPI 3.0.x / 3.1.x JSON; no YAML or Swagger 2.0 |
| Remote sources | HTTP(S), successful JSON responses required; no redirects |
| Local sources | Regular file paths; no `file://`, directory discovery, or globs |
| References | In-document `$ref` only; no external files, remote references, or cross-document references |
| Input size | Up to 8 MiB per document and 32 MiB per project |
| Document count | Up to 32 per project |
| Output count | 1–8 directories |

## Updates and troubleshooting

### Updating an existing Skill

After changing source documents or configuration, rerun `npm run skill:generate`:

- Output replacement starts only after all documents have been read, validated, and generated successfully.
- Successful updates remove services, documents, and operations no longer in the configuration.
- Each output directory is an independently atomic update target. If some writes fail, successful targets keep their new content and are not rolled back; failed targets normally retain their previous content. The CLI reports `OK` / `FAILED` for each target and exits with `1`.
- Fix the cause and rerun. If an error reports a failed rollback and a backup path, recover that backup first.

`.openapi-skill/` holds temporary staging files and backups during updates. Empty directories are normally cleaned up automatically. Follow the error instructions if a backup remains.

### Diagnosing errors

Diagnostics identify the source and failure stage, for example:

```text
ERROR user-service/account [PARSE/INVALID_JSON]: expected a colon (line 42, column 17)
```

| Problem | What to check |
| --- | --- |
| Configuration or local file not found | Working directory, `--config`, and file paths |
| Download failure | Service availability, direct JSON response, and redirects |
| JSON parsing failure | JSON syntax near the reported line and column |
| Contract validation failure | OpenAPI version and external `$ref` values |
| Output failure | Directory permissions, locked files, and any reported backup path |

Use `--debug` for more detail. Default diagnostics hide source content, request headers, and credentials or query parameters in remote URLs. Debug output may include source details; redact it before sharing.

## Library API

The package provides ESM exports and TypeScript types. Use `run` to load configuration and documents, generate files, and write the output:

```js
import { run } from 'openapi-skill';

const result = await run({
  cwd: process.cwd(),
  config: 'openapi-skill.config.json'
});

console.log(result.skillDirectories);
console.log(`Generated ${result.serviceCount} service(s)`);
```

`cwd` defaults to the current working directory, and `config` is optional. Successful results contain:

| Field | Description |
| --- | --- |
| `skillDirectories` | All generated directories |
| `skillDirectory` | First generated directory, retained for compatibility |
| `serviceCount`, `documentCount` | Number of services and documents |
| `fileCount` | Number of generated files per output directory |

Additional exports support custom integrations:

| Export | Purpose |
| --- | --- |
| `loadConfig` | Read and resolve configuration |
| `generateProjectSkill` | Generate a file collection from multiple services |
| `generateSkill` | Generate a file collection from legacy single-service input |
| `publishSkill` | Write a file collection to a Skill directory |
| `MultiOutputPublishError` | Output write error whose `results` property contains per-target outcomes |

## Upgrading and compatibility

### From 2.1.x to 2.2.0

Configuration remains compatible. Upgrade and rerun generation. Version 2.2.0 uses a flat file layout:

- Find operations directly through `references/index.md`.
- Update custom scripts that depend on old catalog/context/group paths.
- For JSONL consumers, `groupFile` has been removed; `file` and `closureFiles` use the new paths.
- Replace the entire old Skill directory when copying or extracting generated content manually.

### Legacy single-service configuration

The following configuration is still supported, with `skillName` required:

```json
{
  "serviceId": "my-service",
  "skillName": "my-service-api",
  "documents": [
    { "id": "public", "url": "./openapi.json" }
  ]
}
```

Do not combine root-level `serviceId` or `documents` with `services`. For new projects, use the `services` structure shown in the quick start.

## License

[MIT](LICENSE)
