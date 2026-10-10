# openapi-skill

[简体中文](README.md) | **English**

Turn OpenAPI documents into API documentation Skills for AI coding agents. Help agents look up actual parameters, requests, responses, and schemas while writing API clients and integrating services. Generate a Skill in your project with the Node.js CLI, or download a Skill ZIP from a running service with the Spring Boot Starter.

## Features

- **Documentation for agents**: search an operation index, then read contracts and related schemas as needed.
- **Preserved API details**: parameters, request bodies, responses, media types, security requirements, and examples retain their service and document ownership.
- **Multiple services**: the Node CLI combines microservices and third-party APIs into one project Skill.
- **Runtime export**: the Spring Boot Starter discovers SpringDoc documents and groups and serves a downloadable ZIP.
- **Local conversion**: conversion requires no LLM and does not call business APIs or external reference URLs.

## Contents

- [Choose an integration](#choose-an-integration)
- [Quick start: Node.js](#quick-start-nodejs)
- [Quick start: Spring Boot](#quick-start-spring-boot)
- [Use with your agent](#use-with-your-agent)
- [Supported scope](#supported-scope)
- [Troubleshooting](#troubleshooting)
- [Documentation and repository](#documentation-and-repository)
- [Local development and verification](#local-development-and-verification)
- [License](#license)

## Choose an integration

| Your goal | Integration | Requirements |
| --- | --- | --- |
| Generate a Skill from OpenAPI URLs or local files in a frontend or other project | **Node CLI** | Node.js 20+ |
| Combine services or distribute documentation to multiple agents | **Node CLI** | Node.js 20+ |
| Download a Skill ZIP from a running Spring Boot service | **Spring Boot Starter** | JDK 17+, Spring Boot WebMVC, SpringDoc |
| Integrate conversion into your own Java tools | **Java Core** | JDK 17+ |

The two generation options work independently. The Node CLI does not require the backend to install the Starter; the Starter does not require Node.js.

## Quick start: Node.js

### 1. Install

Run in the project where you want to use the documentation:

```shell
npm install --save-dev openapi-skill
```

### 2. Configure sources

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

Replace `./openapi.json` with your OpenAPI JSON file path, or use an HTTP(S) URL such as `http://localhost:8080/v3/api-docs`. Relative paths resolve from the directory where you run the command.

### 3. Generate

```shell
npx openapi-skill
```

The default output is `.agents/skills/api-docs/`. Rerun after your API documentation changes.

Add entries to `services` for additional services. To distribute the Skill to multiple agents, set this field at the configuration root:

```json
{
  "output": [".codex/skills", ".trae/skills"]
}
```

This is a field fragment to add to your complete configuration. Each output parent receives the same `api-docs/` directory.

See the [Node guide](openapi-skill-node/README.en.md) for full configuration, npm scripts, error handling, and the library API.

## Quick start: Spring Boot

The Starter adds `GET /openapi-skill/skill.zip` to a WebMVC application with SpringDoc. It discovers document groups automatically and uses the default document when there are no groups.

This example uses the repository's **`2.1.1-SNAPSHOT` source version**, which you must first install into your local Maven repository. These are not installation instructions for a Maven Central release. The repository test application uses Spring Boot 3.5.9 and SpringDoc 2.8.15.

### 1. Install the current source

```shell
git clone https://github.com/fyuanz/openapi-skill.git
cd openapi-skill
mvn -B install
```

### 2. Add the dependency

In an application already configured with SpringDoc WebMVC, add:

```xml
<dependency>
    <groupId>io.github.fyuanz</groupId>
    <artifactId>openapi-skill-spring-boot-starter</artifactId>
    <version>2.1.1-SNAPSHOT</version>
</dependency>
```

### 3. Start and download

Start your application and open its `/openapi-skill/skill.zip` path.

Alternatively, run the repository's sample service:

```shell
mvn -B -f testbeds/springdoc-multi-package/pom.xml spring-boot:run
```

Once it starts, open the [sample Skill download](http://127.0.0.1:18080/openapi-skill/skill.zip) in your browser.

### Optional configuration

| Property | Default or behavior |
| --- | --- |
| `openapi.skill.runtime.enabled` | `true` |
| `openapi.skill.runtime.path` | `/openapi-skill/skill.zip` |
| `openapi.skill.runtime.service-id` | Derived from `spring.application.name` |
| `openapi.skill.runtime.skill-name` | `<serviceId>-api` |

Each download generates and validates a complete ZIP from the current running instance, packaging files in memory. The endpoint follows the application's Spring Security rules; configure access according to your documentation permissions.

## Use with your agent

The Node CLI writes directly to the output directory. With the Starter, extract the **entire Skill directory** from the ZIP into the consuming project's `.agents/skills/` or your agent's Skill directory. Keep all reference files.

The current source generates this structure:

```text
<skillName>/
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

| Content | Purpose |
| --- | --- |
| `SKILL.md` | Skill entry point and reading instructions |
| `references/index.md` | Find operations and open their contracts directly |
| `operations/` | Parameters, requests, responses, and related operation details |
| `schemas/`, `refs/` | Schemas and referenced contracts for on-demand reading |
| Other metadata and indexes | Source records, conventions, and tool processing |

Once your agent has loaded the Skill, try:

```text
Use the api-docs Skill to find the create-order endpoint, explain its required fields,
and generate calling code using this project's existing request wrapper.
Identify the service and document group. Do not guess missing contract details.
```

Replace `api-docs` with your Skill name. The Starter defaults to `<serviceId>-api`; the repository sample uses `springdoc-multi-package-api`.

After API changes, regenerate or download again and replace the entire old Skill. The Starter does not automatically synchronize copies downloaded into other projects.

## Supported scope

These capabilities describe the current source. Published versions may support different inputs or generate a different layout.

| Item | Scope |
| --- | --- |
| Input format | OpenAPI 3.0.x / 3.1.x JSON |
| Node sources | HTTP(S) URLs or regular local files |
| Starter sources | Final SpringDoc WebMVC document resources in the current application |
| `$ref` | In-document references; no external files, remote or cross-document references |
| Multiple services | Explicit Node configuration; each Starter application exports independently |
| Not supported | YAML, Swagger 2.0, WebFlux, full OpenAPI specification validation |

Services and documents remain separate: OpenAPI objects are not merged, and gateway prefixes are not inferred. See the [Node input and output limits](openapi-skill-node/README.en.md#supported-inputs-and-limits) for size, document count, and output directory limits.

## Troubleshooting

| Problem | What to check |
| --- | --- |
| Node cannot find configuration or local files | Working directory, configuration location, and relative document paths |
| Node download or validation fails | Inspect the reported source; use `npx openapi-skill --debug` for more detail |
| Starter endpoint returns 404 | Runtime dependency and whether `openapi.skill.runtime.enabled` is disabled |
| Starter endpoint returns 500 | SpringDoc availability, document version, and complete `$ref` targets |
| Download returns 401/403 | Application authorization for the download path |
| Agent cannot find the Skill | Agent Skill directory and whether `SKILL.md` and all references are present |

Node preserves existing Skills when reading, validation, or generation fails. Multiple outputs update independently; check CLI diagnostics for each result. A failed Starter request returns an error instead of an incomplete ZIP.

## Documentation and repository

| Path | Contents |
| --- | --- |
| [Node guide](openapi-skill-node/README.en.md) | CLI, configuration, library API, and upgrades |
| [Java Core](openapi-skill-core/) | OpenAPI input validation and Skill conversion |
| [Spring Boot Starter](openapi-skill-spring-boot-starter/) | SpringDoc integration and runtime ZIP download |
| [SpringDoc sample](testbeds/springdoc-multi-package/) | Runnable multi-group application and integration tests |
| [Vue / TypeScript sample (Chinese)](testbeds/vue-ts-consumer/README.md) | Frontend integration example |
| [Design (Chinese)](docs/openapi-skill-design.md) | Architecture and generation flow |
| [Publishing guide (Chinese)](docs/maven-central.md) | Maven Central setup and maintainer publishing workflow |

## Local development and verification

Run from the repository root. Java requires JDK 17 and Maven; Node requires Node.js 20+.

**Node build and tests:**

```shell
npm ci --prefix openapi-skill-node
npm test --prefix openapi-skill-node
```

**Java build, tests, and local installation:**

```shell
mvn -B clean install
mvn -B -f testbeds/springdoc-multi-package/pom.xml test
```

**Additional runtime integration verification (requires PowerShell):**

```powershell
powershell -NoProfile -File testbeds/springdoc-multi-package/verify-generated-integration.ps1
```

Integration verification checks the runtime ZIP download and its contents. See the [SpringDoc sample guide (Chinese)](testbeds/springdoc-multi-package/README.md) for details.

## License

[MIT](LICENSE)
