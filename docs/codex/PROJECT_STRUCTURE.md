# Project Structure

## Current Directory Map

```text
.
|-- AGENTS.md
|-- README.md              # default Chinese project guide
|-- README.en.md           # equivalent English guide with reciprocal language link
|-- .gitignore
|-- LICENSE                # MIT
|-- docs/
|   |-- smartdoc-agent-design.md
|   |-- maven-central.md   # release coordinates, publishing and consumer setup
|   `-- codex/
|       |-- PROJECT_CONTEXT.md
|       |-- PROJECT_STRUCTURE.md
|       |-- MODULES.md
|       |-- TASKS.md
|       `-- DECISIONS.md
|-- testbeds/
|   |-- springdoc-multi-package/
|   |   |-- pom.xml           # standalone Spring Boot parent
|   |   |-- README.md
|   |   |-- refresh-fixtures.ps1
|   |   |-- verify-generated-integration.ps1
|   |   |-- fixtures/         # account/business JSON and metadata
|   |   `-- src/              # sample application and contract/runtime tests
|   `-- maven-plugin-integration/ # static reactor; verify.ps1 and verify-aggregate.ps1
|       `-- skill-set/          # opt-in aggregate owner depending on both service modules
|-- smartdoc-agent-core/
|   |-- pom.xml
|   `-- src/                # input validation, Skill generation, safe publication and focused tests
|-- smartdoc-agent-maven-plugin/
|   |-- pom.xml
|   `-- src/                # legacy/compatibility Maven goal and focused tests
|-- smartdoc-agent-spring-boot-starter/
|   |-- pom.xml
|   |-- README.md
|   `-- src/                # runtime auto-configuration, SpringDoc collection, ZIP endpoint and tests
|-- smartdoc-agent-node/
|   |-- package.json        # publishable @fyuanz/smartdoc-agent package and CLI
|   |-- src/                # TypeScript core-compatible generator, downloader and safe publisher
|   `-- test/               # Node unit and loopback HTTP integration tests
`-- pom.xml
```

## Important Files

| Path | Purpose |
| --- | --- |
| `AGENTS.md` | First-read, test-first development, and documentation rules |
| `README.md` / `README.en.md` | Runtime-first onboarding, legacy Maven compatibility, Skill usage and verification |
| `docs/smartdoc-agent-design.md` | v3.7 runtime architecture, discovery and compatibility boundaries |
| `pom.xml` | Java 17 Maven parent; aggregates core, Maven plugin and runtime Starter |
| `LICENSE` | User-selected MIT license |
| `docs/maven-central.md` | Maven Central release and plugin-consumption instructions |
| `docs/codex/DECISIONS.md` | Historical and current scope decisions |

P0-P6 produced the core, safe publisher, Maven compatibility plugin, and aggregate output. v3.7 adds a runtime Starter and
removes build-time startup/capture/generation from the SpringDoc testbed. Legacy IR remains deleted.

## Implementation Locations

Core, runtime entry point, and Maven compatibility entry point now exist:

- `smartdoc-agent-core/src/main/java/com/smartdoc/agent/core/`: OpenApiInput.java (version/JSON boundary), SkillGenerator.java (service assembly), DocumentReferences.java (local graph, contract rendering and links), GeneratedSkillValidator.java (complete-tree checks), and ServiceSkillUpdater.java (bounded generation, locking, staged replacement, recovery, and external status).
- `AggregateSkillGenerator.java` assembles validated service reference trees with a single trusted entrypoint, service catalog and provenance. Trusted templates reside in `SkillGenerator.java` and `AggregateSkillGenerator.java`.
- Plugin `MultiServiceGeneration.java` coordinates modes, required membership and independent/aggregate publication. `ServiceSource.java` holds member identities and input sources.
- `smartdoc-agent-core/src/test/`: sanitized OpenAPI fixture, small boundary inputs, and meaningful semantic tests.
- `smartdoc-agent-maven-plugin/src/main/java/com/smartdoc/agent/maven/`: `GenerateSkillMojo` and its explicit-path `DocumentSource` configuration bean. The Mojo normally discovers top-level JSON files in one configured producer directory, retains explicit file configuration as a fallback, can reject files older than the Maven session, and translates P3 results into Maven info/warning output.
- `smartdoc-agent-spring-boot-starter/src/main/java/com/smartdoc/agent/runtime/`: Boot auto-configuration,
  optional runtime properties, safe identity derivation, direct SpringDoc final-resource collection, deterministic in-memory
  ZIP creation, and the hidden `/smartdoc/skill.zip` controller.
- `smartdoc-agent-spring-boot-starter/src/test/`: default-document and multi-group auto-configuration/ZIP tests.
- `smartdoc-agent-node/`: Node.js 20+ TypeScript package. Its CLI loads explicit document ID/URL pairs, downloads all
  inputs, invokes the core-compatible generator, and atomically publishes one Skill. Default output is the consuming
  project's `.agents/skills/`; an explicit output parent is supported.
- `testbeds/maven-plugin-integration/`: two valid service-owner modules, an opt-in broken Java module, static OpenAPI inputs, POM examples, and `verify.ps1` for real lifecycle assertions.

Do not add CLI, package repository, generic URL ingestion, or cross-service runtime aggregation. The standalone fixture at
`testbeds/springdoc-multi-package/` has `user`, `order`, `file`, and `common` packages plus `account`/`business` groups.
It consumes the Starter but remains outside the root reactor. Core tests consume frozen sanitized snapshots offline.

## Generated Or Ignored Directories

- Maven `**/target/` output is not source.
- `smartdoc-agent-core/target/smartdoc/springdoc-multi-package-api/` is the verified test-generated Skill. The P3 publisher is verified in temporary directories; no production build invokes it yet.
- `testbeds/maven-plugin-integration/target/generated-resources/smartdoc/` is ignored verification output for the Maven goal; it is recreated by the verifier.
- The runtime testbed must not create `target/generated-openapi/` or `target/generated-resources/smartdoc/`; its explicit
  fixture test still writes asserted snapshots to `target/openapi/` for the separate refresh script.
- For an output parent, the final Skill is `<skillName>/`; updater state is outside it under `.smartdoc/locks/<skillName>.lock`, `.smartdoc/staging/`, `.smartdoc/backups/`, and `.smartdoc/status/<serviceId>.json`.
- Each service and aggregate owns separate output, staging, lock and status paths. Individual references use `references/documents/<documentId>/`; aggregate members use `references/services/<serviceId>/references/documents/<documentId>/`. The aggregate has one root `SKILL.md` and remains independently installable.
- Preserve safe local ignore rules for IDE files, secrets, logs, and temporary files.
- Generated restricted API documentation must not be committed as a substitute for sanitized fixtures.

## Caution Areas

- Do not silently restore the user's core deletions or call the missing-POM state a completed migration.
- Output replacement must only affect a validated generator-owned directory, never a source root or a directory with unrelated manual content.
- Do not replace final SpringDoc resource collection with direct injection of the incomplete base `OpenAPI` bean.
- Do not add an HTTP self-call or arbitrary source URL to the runtime collector.
- Stable files and deterministic ZIP bytes matter; a package repository/identity platform remains outside scope.
- Runtime endpoints inherit application security and must not silently expose restricted API contracts.
- Never replace a shared parent containing multiple service outputs. Do not infer service boundaries from Java packages or Maven directory names.

