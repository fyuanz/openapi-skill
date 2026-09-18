# openapi-skill

[简体中文](README.md) | **English**

Turn the current OpenAPI contract of a running Spring Boot service into a downloadable Skill ZIP. After startup, one
read-only endpoint returns the complete catalog, request/response contracts, and Schema references. OpenAPI Skill no longer
needs Maven phases, a second application process, HTTP capture of `/v3/api-docs`, or build-directory intermediates.

## Features and scope

- **Runtime download**: adding the starter exposes `GET /openapi-skill/skill.zip`, generated from the current instance on demand.
- **Automatic discovery**: reuses SpringDoc's final resources and enumerates `GroupedOpenApi` without duplicate OpenAPI URL configuration.
- **Configurable output**: runtime defaults to one Skill per application; the Node CLI can aggregate explicitly configured services into one project Skill.
- **Contract preservation**: parameters, request bodies, responses, media types, authentication definitions, and Schema data, with semantic operation IDs, machine indexes, and local-reference navigation.
- **No filesystem side effects**: validates a complete result and creates a deterministic ZIP in memory; unchanged contracts produce identical bytes.
- **Local conversion**: the core does not call LLMs, business APIs, or external reference URLs. Source free text stays separate from trusted Skill instructions.
- **Explicit input**: JSON declaring `openapi: 3.0.x` or `3.1.x` is accepted; any other root marker is rejected. Production documents come from SpringDoc / NextDoc4j; those producers own Java package scanning and document export.

YAML, Swagger 2.0, other OpenAPI versions, external references, full OpenAPI validation, automatic cross-project
installation/synchronization, WebFlux, cross-service runtime aggregation, and package repositories are outside
the current scope. Runtime evidence comes from the SpringDoc WebMVC testbed.

## Generate a Skill in Vue 3 / Node.js projects

The TypeScript package `openapi-skill@2.1.0` is the current source version; npm serves `1.0.0`, `1.1.0` and `2.0.0`
as `latest`. It defaults to one self-contained
API Skill per frontend project and adds a `context.md` group index keyed by the OpenAPI `tags`, one interface file per
tag under its own readable name (Chinese tag names are kept verbatim), clean semantic filenames,
generator-computed reference closures, and centralized conventions. JSONL remains a machine validation artifact.
Multiple microservices, multiple documents within each service, and third-party providers are
organized below one `.agents/skills/api-docs/` directory; `skillName` can override the `api-docs` default.

```json
{
  "keywords": ["API documentation", "frontend integration"],
  "services": [
    {
      "serviceId": "account-service",
      "sourceType": "internal",
      "keywords": ["users", "accounts"],
      "documents": [
        {
          "id": "account",
          "url": "http://127.0.0.1:18080/v3/api-docs/account",
          "keywords": ["login", "profiles"]
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

Root, service, and document `keywords` respectively support Skill discovery, service selection, and document lookup.
`sourceType` is `internal` by default and also accepts `third-party`. Every service reference is physically included and
reached through relative Markdown links; no filesystem symbolic link or separately installed service Skill is needed.

OpenAPI Skill downloads and validates every configured service and document before replacing the complete directory once.
Any failure retains the previous complete Skill instead of publishing a subset. The original
`serviceId + skillName + documents` single-service configuration remains supported. Install the package as a development
dependency and see the [Node package guide](openapi-skill-node/README.en.md) for scripts, overrides, and migration details.

## Release and requirements

The first release under the new name is `1.0.0`, and both the npm package and the Maven Central artifacts have been
published manually. The published `2.0.0` moved the generated layout from the `openapi-skill-core/1` and
`openapi-skill-core/2` trees to `openapi-skill-core/3`, on npm and Maven Central both. The Maven source line is now
`2.1.0-SNAPSHOT`, which adds OpenAPI 3.0.x input support without changing any existing 3.1 output.
SpringDoc applications should use the runtime Starter.

| Artifact | Purpose |
| --- | --- |
| `io.github.fyuanz:openapi-skill:2.0.0` | Parent POM |
| `io.github.fyuanz:openapi-skill-core:2.0.0` | Offline conversion and safe output publication |
| `io.github.fyuanz:openapi-skill-spring-boot-starter:2.0.0` | Runtime discovery and ZIP download |

Use JDK 17 and Maven. The verified environment is Maven 3.9.16 / JDK 17.0.19. Repository integration scripts require PowerShell. The sample uses Spring Boot 3.5.9 and springdoc 2.8.15.

## Quick start

Clone the repository and run from its root:

```shell
git clone https://github.com/fyuanz/openapi-skill.git
cd openapi-skill
mvn -B install
mvn -B -f testbeds/springdoc-multi-package/pom.xml clean verify
```

The first command installs the current source artifacts locally. The second runs ordinary tests and packaging with no OpenAPI Skill application
start/stop, OpenAPI capture, or generated files. Tests verify the runtime ZIP on a random port.

For a manual check, start the application:

```shell
mvn -B -f testbeds/springdoc-multi-package/pom.xml spring-boot:run
```

Then download `http://127.0.0.1:18080/openapi-skill/skill.zip`. It contains the account/business groups, 4 operations,
and 7 document-local Schemas.

## Recommended: add the runtime starter

For a Spring Boot WebMVC service whose SpringDoc output is OpenAPI 3.0.x or 3.1.x, add one dependency:

```xml
<dependency>
    <groupId>io.github.fyuanz</groupId>
    <artifactId>openapi-skill-spring-boot-starter</artifactId>
    <version>1.0.0</version>
</dependency>
```

No OpenAPI Skill Maven plugin, execution, phase, OpenAPI URL, document directory, or output directory is required. The
project no longer ships a build-time Maven compatibility plugin. Once the
application is running, `GET /openapi-skill/skill.zip` downloads the Skill. The starter:

- enumerates the `GroupedOpenApi` beans used by Swagger UI, or uses the default document when there are no groups;
- calls `MultipleOpenApiWebMvcResource` / `OpenApiWebMvcResource` in process to obtain the post-controller-scan JSON;
- converts and validates those current documents, then creates a deterministic ZIP with a `<skillName>/` root;
- derives serviceId from `spring.application.name` and defaults the Skill name to `<serviceId>-api`.

Injecting an application's base `OpenAPI` bean is not equivalent to the complete document: it commonly contains the
manually defined Info, Components, and Servers, while SpringDoc's resource scans and assembles `paths` at runtime.
`GroupedOpenApi` is likewise configuration, not the final group document. The starter therefore uses the final resources
without issuing an HTTP self-request.

All overrides are optional:

```properties
openapi.skill.runtime.enabled=true
openapi.skill.runtime.path=/openapi-skill/skill.zip
openapi.skill.runtime.service-id=my-service
openapi.skill.runtime.skill-name=my-service-api
```

The endpoint follows the application's existing Spring Security rules; explicitly protect it when the API contract is
sensitive. See the [starter guide](openapi-skill-spring-boot-starter/README.md).

## Use the Skill in a frontend project

Download the ZIP and extract its **entire Skill directory** into the frontend project's `.agents/skills/`, preserving every reference file:

```text
<frontend-project>/.agents/skills/my-service-api/
├── SKILL.md
└── references/
    ├── catalog.md
    ├── source.json
    └── documents/
        └── <document>
            ├── context.md        # group index; read this first
            ├── groups/           # one file per OpenAPI tag, named after the tag
            ├── operations/
            └── schemas/
```

Try this task in the frontend project and verify that your agent actually discovers and uses the Skill:

```text
Use the my-service-api Skill to find the create-order endpoint, explain its required fields,
and generate calling code using this project's existing request wrapper. Identify the service
and document group. Do not guess missing contract details.
```

For the repository sample, use `springdoc-multi-package-api` instead. It describes a fictional test service; its server address and authentication metadata do not represent a production environment.

After an API change, download again and replace the complete old Skill so deleted operations do not remain. The runtime endpoint does not write `target/` and does not automatically synchronize frontend copies.

## Runtime troubleshooting

| Observation | What to check |
| --- | --- |
| Download endpoint returns 404 | Ensure the starter is on the runtime classpath and `openapi.skill.runtime.enabled` is not `false` |
| Download endpoint returns 500 | Check that SpringDoc is enabled, the final JSON is OpenAPI 3.0.x or 3.1.x, and local `$ref` targets are complete |
| Unexpected ZIP name | Set `spring.application.name`, or override `openapi.skill.runtime.service-id` / `skill-name` |
| 401/403 with Spring Security | Authorize the download path according to project policy; do not expose restricted API contracts just for download |

Runtime generation has no stale-file fallback: a successful request returns one fully validated ZIP, while a failed request
returns an application error and no partial archive.

## Development and verification

Run from the repository root:

```shell
mvn -B clean test
mvn -B -f testbeds/springdoc-multi-package/pom.xml test
```

Runtime integration verification is separate from root unit tests:

```powershell
powershell -NoProfile -File testbeds/springdoc-multi-package/verify-generated-integration.ps1
```

The SpringDoc script proves that an ordinary build performs no application start/stop, HTTP capture, or OpenAPI Skill Maven
goal, then downloads and checks the ZIP on a real random port.

`1.0.0` adds single-document/multi-group runtime starter tests and six testbed checks. See
[task records](docs/codex/TASKS.md) for current results. The user will continue to review Skill usability manually.

## Repository and documentation

| Path | Contents |
| --- | --- |
| [openapi-skill-core](openapi-skill-core/) | Input validation, contract conversion, safe publication |
| [openapi-skill-spring-boot-starter](openapi-skill-spring-boot-starter/) | Runtime SpringDoc discovery, conversion, and ZIP download |
| [SpringDoc testbed](testbeds/springdoc-multi-package/) | Multi-package, multi-group sample and runtime verification |
| [Design (Chinese)](docs/openapi-skill-design.md) | Runtime and Node project-Skill primary paths |
| [Release and usage (Chinese)](docs/maven-central.md) | Maven Central setup and maintainer publishing workflow |
| [Task status](docs/codex/TASKS.md) | Completed work, verification evidence, and next steps |

## License

[MIT](LICENSE)
