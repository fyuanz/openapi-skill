# SmartDoc-Agent

[简体中文](README.md) | **English**

Turn the current OpenAPI contract of a running Spring Boot service into a downloadable Skill ZIP. After startup, one
read-only endpoint returns the complete catalog, request/response contracts, and Schema references. SmartDoc no longer
needs Maven phases, a second application process, HTTP capture of `/v3/api-docs`, or build-directory intermediates.

## Features and scope

- **Runtime download**: adding the starter exposes `GET /smartdoc/skill.zip`, generated from the current instance on demand.
- **Automatic discovery**: reuses SpringDoc's final resources and enumerates `GroupedOpenApi` without duplicate OpenAPI URL configuration.
- **Configurable output**: runtime defaults to one Skill per application; the published Maven plugin retains complete aggregate/coexistence compatibility.
- **Contract preservation**: parameters, request bodies, responses, media types, authentication definitions, and Schema data, with operation, tag, and local-reference navigation.
- **No filesystem side effects**: validates a complete result and creates a deterministic ZIP in memory; unchanged contracts produce identical bytes.
- **Local conversion**: the core does not call LLMs, business APIs, or external reference URLs. Source free text stays separate from trusted Skill instructions.
- **Explicit input**: only JSON declaring `openapi: 3.1.0` is accepted. Production documents come from SpringDoc / NextDoc4j; those producers own Java package scanning and document export.

YAML, Swagger 2.0, other OpenAPI versions, external references, full OpenAPI validation, automatic cross-project
installation/synchronization, WebFlux, cross-service runtime aggregation, package repositories, and a CLI are outside
the current scope. Runtime evidence comes from the SpringDoc WebMVC testbed.

## Generate a Skill in Vue 3 / Node.js projects

The TypeScript package `smartdoc-agent` downloads multiple configured OpenAPI JSON endpoints and generates one
complete Skill under `.agents/skills/<skillName>/` by default. Install it as a development dependency, create
`smartdoc-agent.config.json`, and run `smartdoc-agent` after the local backend starts. See the
[Node package guide](smartdoc-agent-node/README.en.md) for the account/business configuration and custom output option.

## Release and requirements

The current release is `1.2.0`. It adds the runtime Starter and retains Maven build-time single-service and aggregate
compatibility; SpringDoc applications should prefer the runtime Starter.

| Artifact | Purpose |
| --- | --- |
| `io.github.fyuanz:smart-doc-agent:1.2.0` | Parent POM |
| `io.github.fyuanz:smartdoc-agent-core:1.2.0` | Offline conversion and safe output publication |
| `io.github.fyuanz:smartdoc-agent-maven-plugin:1.2.0` | Maven `generate-skill` goal |
| `io.github.fyuanz:smartdoc-agent-spring-boot-starter:1.2.0` | Runtime discovery and ZIP download |

Use JDK 17 and Maven. The verified environment is Maven 3.9.16 / JDK 17.0.19. Repository integration scripts require PowerShell. The sample uses Spring Boot 3.5.9 and springdoc 2.8.15.

## Quick start

Clone the repository and run from its root:

```shell
git clone https://github.com/fyuanz/smart-doc.git
cd smart-doc
mvn -B install
mvn -B -f testbeds/springdoc-multi-package/pom.xml clean verify
```

The first command installs the snapshot. The second runs ordinary tests and packaging with no SmartDoc application
start/stop, OpenAPI capture, or generated files. Tests verify the runtime ZIP on a random port.

For a manual check, start the application:

```shell
mvn -B -f testbeds/springdoc-multi-package/pom.xml spring-boot:run
```

Then download `http://127.0.0.1:18080/smartdoc/skill.zip`. It contains the account/business groups, 4 operations,
and 7 document-local Schemas.

## Recommended: add the runtime starter

For a Spring Boot WebMVC service whose SpringDoc output is exact OpenAPI 3.1.0, add one dependency:

```xml
<dependency>
    <groupId>io.github.fyuanz</groupId>
    <artifactId>smartdoc-agent-spring-boot-starter</artifactId>
    <version>1.2.0</version>
</dependency>
```

No SmartDoc Maven plugin, execution, phase, OpenAPI URL, document directory, or output directory is required. Once the
application is running, `GET /smartdoc/skill.zip` downloads the Skill. The starter:

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
smartdoc.runtime.enabled=true
smartdoc.runtime.path=/smartdoc/skill.zip
smartdoc.runtime.service-id=my-service
smartdoc.runtime.skill-name=my-service-api
```

The endpoint follows the application's existing Spring Security rules; explicitly protect it when the API contract is
sensitive. See the [starter guide](smartdoc-agent-spring-boot-starter/README.md).

## Microservices: individual and complete aggregate Skills

The following is the `1.2.0` Maven plugin compatibility path for projects that still need offline static JSON
or build-time cross-service aggregation. Prefer the runtime starter for a current application's Skill ZIP.

| `outputMode` | Output |
| --- | --- |
| `service` (default) | An individual Skill for the single service or each member in `services` |
| `aggregate` | Only one complete Skill containing every configured service |
| `both` | All individual service Skills plus one complete aggregate Skill |

Configure this plugin under `build/plugins` in one coordinator module. It must run after both services export their documents. Establish order with explicit Maven module dependencies; a parent POM that executes first is insufficient. Do not combine `services` with top-level single-service `serviceId`, `skillName`, `documentsDirectory`, or `documents`.

```xml
<plugin>
    <groupId>io.github.fyuanz</groupId>
    <artifactId>smartdoc-agent-maven-plugin</artifactId>
    <version>1.2.0</version>
    <inherited>false</inherited>
    <executions>
        <execution>
            <id>update-service-skills</id>
            <phase>verify</phase>
            <goals><goal>generate-skill</goal></goals>
        </execution>
    </executions>
    <configuration>
        <outputMode>both</outputMode>
        <aggregateId>platform</aggregateId>
        <aggregateSkillName>platform-api</aggregateSkillName>
        <requireCurrentBuildDocuments>true</requireCurrentBuildDocuments>
        <services>
            <service>
                <serviceId>orders</serviceId>
                <skillName>orders-api</skillName>
                <documentsDirectory>${project.basedir}/../orders-service/target/generated-openapi</documentsDirectory>
            </service>
            <service>
                <serviceId>billing</serviceId>
                <skillName>billing-api</skillName>
                <documentsDirectory>${project.basedir}/../billing-service/target/generated-openapi</documentsDirectory>
            </service>
        </services>
    </configuration>
</plugin>
```

Each service can use the explicit `documents` list shown earlier instead of a directory. Configure 1–32 services. `aggregateId` owns aggregate publication/status; `aggregateSkillName` names its output directory. Keep aggregate ownership/output names distinct from member identities/output names. Change only `outputMode` to switch modes; `service` ignores retained aggregate identity settings.

Default output:

```text
target/generated-resources/smartdoc/
├── orders-api/             # Individual orders Skill
├── billing-api/            # Individual billing Skill
└── platform-api/           # One complete aggregate Skill
    ├── SKILL.md
    └── references/
        ├── catalog.md
        ├── source.json
        └── services/
            ├── orders/references/
            └── billing/references/
```

The aggregate can be copied and used on its own, with all operations and references included. Navigate by service, then document group/operation. Identical Schema names, paths, and authentication definitions remain isolated; documents are not merged into one OpenAPI contract and gateway addresses are never guessed.

- **Every listed service is required**: empty, missing, invalid, or stale member input fails the aggregate update and retains its previous complete result. No subset is published as a complete aggregate.
- **Independent failures**: healthy services can still update in `both`. Only all successful member updates from this invocation enter the aggregate. Aggregate publication failure does not undo individual results; outputs are not one cross-service transaction.
- **Timeouts and size**: `aggregate` shares one `timeoutSeconds` budget for all reading/conversion/assembly. In `both`, each service task and final aggregate assembly has its own timeout. Prepared aggregate inputs and final output are each bounded to 10000 files and 64 MiB.
- **Mode changes and removal**: disabling an output does not delete its existing directory. Removing a member cleans its references on the next successful aggregate replacement, without deleting its individual Skill.
- **Build coordination**: in `both`, the coordinator owns individual outputs; avoid duplicate writers. Existing independent service owners can instead coexist with one `aggregate` owner. A service-only build that does not execute the coordinator leaves the aggregate unchanged. Cross-repository inputs must be supplied as local JSON; collection and scheduling are not automatic.
- **Current-build checks**: this example requires all JSON files to be rewritten in the same Maven session. Static test inputs can disable this check; the caller still owns input readiness.

See the runnable [skill-set POM](testbeds/maven-plugin-integration/skill-set/pom.xml) for explicit module dependencies. From the repository root, run this verifier for parallel build order, all three modes, coexistence, repeated generation, and failure retention:

```powershell
powershell -NoProfile -File testbeds/maven-plugin-integration/verify-aggregate.ps1
```

## Use the Skill in a frontend project

Download the ZIP and extract its **entire Skill directory** into the frontend project's `.agents/skills/`, preserving every reference file:

```text
<frontend-project>/.agents/skills/my-service-api/
├── SKILL.md
└── references/
    ├── catalog.md
    ├── source.json
    └── documents/
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
| Download endpoint returns 404 | Ensure the starter is on the runtime classpath and `smartdoc.runtime.enabled` is not `false` |
| Download endpoint returns 500 | Check that SpringDoc is enabled, the final JSON is exact OpenAPI 3.1.0, and local `$ref` targets are complete |
| Unexpected ZIP name | Set `spring.application.name`, or override `smartdoc.runtime.service-id` / `skill-name` |
| 401/403 with Spring Security | Authorize the download path according to project policy; do not expose restricted API contracts just for download |

Runtime generation has no stale-file fallback: a successful request returns one fully validated ZIP, while a failed request
returns an application error and no partial archive. The old Maven plugin's status, lock, and recovery behavior remains
documented in its [plugin guide](smartdoc-agent-maven-plugin/README.md).

## Development and verification

Run from the repository root:

```shell
mvn -B clean test
mvn -B -f testbeds/springdoc-multi-package/pom.xml test
```

Runtime and legacy Maven-plugin integration verifiers are separate from root unit tests:

```powershell
powershell -NoProfile -File testbeds/maven-plugin-integration/verify.ps1
powershell -NoProfile -File testbeds/springdoc-multi-package/verify-generated-integration.ps1
```

The SpringDoc script proves that an ordinary build performs no application start/stop, HTTP capture, or SmartDoc Maven
goal, then downloads and checks the ZIP on a real random port. The Maven-plugin script retains compatibility coverage.

`1.2.0` adds single-document/multi-group runtime starter tests and six testbed checks. See
[task records](docs/codex/TASKS.md) for current results. The user will continue to review Skill usability manually.

## Repository and documentation

| Path | Contents |
| --- | --- |
| [smartdoc-agent-core](smartdoc-agent-core/) | Input validation, contract conversion, safe publication |
| [smartdoc-agent-spring-boot-starter](smartdoc-agent-spring-boot-starter/) | Runtime SpringDoc discovery, conversion, and ZIP download |
| [smartdoc-agent-maven-plugin](smartdoc-agent-maven-plugin/) | Maven configuration, directory discovery, update entry point |
| [SpringDoc testbed](testbeds/springdoc-multi-package/) | Multi-package, multi-group sample and runtime verification |
| [Maven integration testbed](testbeds/maven-plugin-integration/) | Multiple services, repeated/parallel builds, failure isolation |
| [Design (Chinese)](docs/smartdoc-agent-design.md) | v3.7 runtime primary path and compatibility boundaries |
| [Release and usage (Chinese)](docs/maven-central.md) | Maven Central setup and maintainer publishing workflow |
| [Task status](docs/codex/TASKS.md) | Completed work, verification evidence, and next steps |

## License

[MIT](LICENSE)
