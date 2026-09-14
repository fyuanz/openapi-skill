# SmartDoc-Agent

[简体中文](README.md) | **English**

Turn API documentation into a Skill for frontend development. One or more OpenAPI JSON documents for each service become a browsable set of API catalogs, request/response contracts, and Schema references that coding agents can consult on demand.

SmartDoc-Agent integrates with Maven and updates the Skill at an explicitly configured build phase. Generation or update failures produce warnings. A previous complete Skill is retained on recoverable failures, while business compilation keeps its own success/failure semantics.

## Features and scope

- **Configurable output**: one Skill per service by default; since `1.1.0`, a complete aggregate and coexistence are also supported. Identical operations and Schema names remain isolated by service/document.
- **Contract preservation**: parameters, request bodies, responses, media types, authentication definitions, and Schema data, with operation, tag, and local-reference navigation.
- **Safe updates**: complete validation, staging, replacement, timeouts, locking, and recovery. Successful updates remove stale files for deleted operations or groups.
- **Local conversion**: the core does not call LLMs, business APIs, or external reference URLs. Source free text stays separate from trusted Skill instructions.
- **Explicit input**: only JSON declaring `openapi: 3.1.0` is accepted. Production documents come from SpringDoc / NextDoc4j; those producers own Java package scanning and document export.

YAML, Swagger 2.0, other OpenAPI versions, external references, full OpenAPI specification validation, automatic cross-project installation/synchronization, a download service, and a CLI are outside the current scope. NextDoc4j is an allowed JSON source; the repository's runtime integration evidence comes from the SpringDoc testbed.

## Release and requirements

Version `1.1.0` is published to Maven Central and includes both single-service and aggregate Skill features. No additional repository is needed for these artifacts. `1.0.0` only provides the single-service configuration.

| Artifact | Purpose |
| --- | --- |
| `io.github.fyuanz:smart-doc-agent:1.1.0` | Parent POM |
| `io.github.fyuanz:smartdoc-agent-core:1.1.0` | Offline conversion and safe output publication |
| `io.github.fyuanz:smartdoc-agent-maven-plugin:1.1.0` | Maven `generate-skill` goal |

Use JDK 17 and Maven. The verified environment is Maven 3.9.16 / JDK 17.0.19. Repository integration scripts require PowerShell. The sample uses Spring Boot 3.5.9 and springdoc 2.8.15.

## Quick start

Clone the repository and run from its root:

```shell
git clone https://github.com/fyuanz/smart-doc.git
cd smart-doc
mvn -B install
mvn -B -f testbeds/springdoc-multi-package/pom.xml clean verify
```

Run the second Maven command only after the first succeeds. The test application starts automatically, exports the `account` / `business` groups, stops, and then generates the Skill. Do not start it manually beforehand. Default HTTP and JMX ports are `18080` and `9001`; ensure both are available. See the [testbed guide (Chinese)](testbeds/springdoc-multi-package/README.md) for a build using dynamically selected ports.

On success, the log includes `SmartDoc [springdoc-multi-package] SUCCESS`. The complete artifact is at:

```text
testbeds/springdoc-multi-package/target/generated-resources/smartdoc/springdoc-multi-package-api/
```

The sample contains 19 files, 4 operations, and 7 document-local Schemas. **Maven's `BUILD SUCCESS` does not mean the Skill was updated.** Check the SmartDoc log and the current update status as described below.

## Integrate with your Maven service

First configure SpringDoc / NextDoc4j to export OpenAPI JSON from the current build into an explicit directory. Add this plugin under `build/plugins` in the single module responsible for generating that service's Skill:

```xml
<plugin>
    <groupId>io.github.fyuanz</groupId>
    <artifactId>smartdoc-agent-maven-plugin</artifactId>
    <version>1.1.0</version>
    <inherited>false</inherited>
    <executions>
        <execution>
            <id>update-generated-skill</id>
            <phase>verify</phase>
            <goals><goal>generate-skill</goal></goals>
        </execution>
    </executions>
    <configuration>
        <serviceId>my-service</serviceId>
        <skillName>my-service-api</skillName>
        <documentsDirectory>${project.build.directory}/generated-openapi</documentsDirectory>
        <requireCurrentBuildDocuments>true</requireCurrentBuildDocuments>
    </configuration>
</plugin>
```

**This configuration consumes JSON; it does not start the application or export documents.** The goal has no default lifecycle phase. Bind it explicitly after the document producer. See the [sample POM](testbeds/springdoc-multi-package/pom.xml) for the full SpringDoc startup, export, and shutdown configuration.

The sample runs: `package` → start application → export JSON at `integration-test` → stop application → update Skill at `verify`. Use `mvn verify`; ordinary `mvn compile` and `mvn package` do not execute this runtime chain. Every configured goal invocation attempts an update, even when the content is unchanged. Independent IDE compilation is outside scope.

| Parameter | Meaning and default |
| --- | --- |
| `serviceId` | Required service identity for provenance and status |
| `skillName` | Required Skill name and final directory name; use a separate output for each service |
| `documentsDirectory` | Scans top-level JSON files without recursion; mutually exclusive with `documents` |
| `documents` | Explicit document entries with `id` and `path`; every listed document must exist |
| `outputDirectory` | Defaults to `${project.build.directory}/generated-resources/smartdoc`; the final output is its `<skillName>/` child |
| `timeoutSeconds` | Timeout for the document reading and conversion task, in seconds; defaults to `30`, must be positive |
| `requireCurrentBuildDocuments` | Defaults to `false`; when enabled, every document must have been rewritten since the current Maven session began, with stable size and modification time during reading |

Use lowercase letters and digits separated by single hyphens for identities, with at most 63 characters, avoiding Windows reserved names; for example, `my-service-api`. Directory mode derives document IDs from filenames without `.json`; use names such as `account.json` and `business.json`.

Discovered files define the complete input set for this update. A missing or empty directory logs `SKIPPED`. If specific groups must exist, replace `documentsDirectory` with explicit `documents`:

```xml
<documents>
    <document>
        <id>account</id>
        <path>${project.build.directory}/generated-openapi/account.json</path>
    </document>
    <document>
        <id>business</id>
        <path>${project.build.directory}/generated-openapi/business.json</path>
    </document>
</documents>
```

Each target project explicitly selects its producer, owner module, groups, and Maven phase. Enable current-build checking for generated files. The repository's authoritative static-JSON test path can disable it and bind to `compile`, but that does not prove runtime documents match current application source.

## Microservices: individual and complete aggregate Skills

This feature is published to Maven Central with **`1.1.0`**; reference that version to use it. Published `1.0.0` only supports the single-service configuration above.

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
    <version>1.1.0</version>
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

Copy the **entire generated Skill directory** into the frontend project's `.agents/skills/`, preserving every reference file:

```text
<frontend-project>/.agents/skills/my-service-api/
├── SKILL.md
└── references/
    ├── catalog.md
    ├── source.json
    └── documents/
```

The adjacent `.smartdoc/` directory contains build state and does not need to be copied. Try this task in the frontend project and verify that your agent actually discovers and uses the Skill:

```text
Use the my-service-api Skill to find the create-order endpoint, explain its required fields,
and generate calling code using this project's existing request wrapper. Identify the service
and document group. Do not guess missing contract details.
```

For the repository sample, use `springdoc-multi-package-api` instead. It describes a fictional test service; its server address and authentication metadata do not represent a production environment.

Rebuilding the backend updates only the generated output, not the frontend copy. Replace the complete old Skill when copying again so deleted operations do not remain. The default generated directory is under `target/` and is removed by `mvn clean`.

## Update status and troubleshooting

The default status path is `target/generated-resources/smartdoc/.smartdoc/status/<serviceId>.json` under the service owner module. It records the latest attempt that reached the updater. Configuration errors and empty-directory skips may only emit logs; an old status file is not proof of success in the current build.

| Observation | What to check |
| --- | --- |
| `SUCCESS` | A complete Skill was published for this attempt; inspect its output location and provenance |
| `SKIPPED` | Check the input directory and top-level JSON files; use explicit required entries if appropriate |
| `FAILED` / `CONFIG` | Check names, configuration, JSON version, local references, output permissions, and current-build document timestamps |
| `TIMED_OUT` / `LOCKED` | Check input size, timeout configuration, and concurrent writers targeting the same Skill |
| Maven succeeds but the Skill is unchanged | Read the current SmartDoc log; a failed update may retain the previous complete artifact |

Recoverable update failures retain or restore the old Skill. If restoration itself fails, a complete backup remains for recovery. There may be no previous artifact after a first-run failure or a failed build following `clean`. The plugin does not mask Java compilation or other business build failures; Spring Boot startup failures in the sample also still fail Maven.

## Development and verification

Run from the repository root:

```shell
mvn -B clean test
mvn -B -f testbeds/springdoc-multi-package/pom.xml test
```

The two real Maven integration verifiers are separate from root unit tests:

```powershell
powershell -NoProfile -File testbeds/maven-plugin-integration/verify.ps1
powershell -NoProfile -File testbeds/springdoc-multi-package/verify-generated-integration.ps1
```

The scripts install the current plugin and execute real builds. The SpringDoc script injects capture failures and intentionally finishes with a `FAILED` status and a retained old Skill. Run a normal `clean verify` again when you need a fresh successful artifact for delivery.

Release baseline verification (2026-09-11): 62 core/plugin tests and 5 testbed tests passed. The development version adds aggregate/output-mode tests and real Maven coexistence verification; see [task records](docs/codex/TASKS.md) for current results. Existing testbeds are the accepted generation evidence. Web/frontend and real-environment validation have been removed from the plan; the user will review Skill usability manually and provide feedback.

## Repository and documentation

| Path | Contents |
| --- | --- |
| [smartdoc-agent-core](smartdoc-agent-core/) | Input validation, contract conversion, safe publication |
| [smartdoc-agent-maven-plugin](smartdoc-agent-maven-plugin/) | Maven configuration, directory discovery, update entry point |
| [SpringDoc testbed](testbeds/springdoc-multi-package/) | Multi-package, multi-group sample and runtime verification |
| [Maven integration testbed](testbeds/maven-plugin-integration/) | Multiple services, repeated/parallel builds, failure isolation |
| [Design (Chinese)](docs/smartdoc-agent-design.md) | v3.6 scope, aggregate modes, and testbed acceptance boundaries |
| [Release and usage (Chinese)](docs/maven-central.md) | Maven Central setup and maintainer publishing workflow |
| [Task status](docs/codex/TASKS.md) | Completed work, verification evidence, and next steps |

## License

[MIT](LICENSE)
