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
|   `-- src/                # compile-phase goal and focused tests
`-- pom.xml
```

## Important Files

| Path | Purpose |
| --- | --- |
| `AGENTS.md` | First-read, test-first development, and documentation rules |
| `README.md` / `README.en.md` | Chinese-default and English onboarding, Maven configuration, Skill usage, troubleshooting, and verification |
| `docs/smartdoc-agent-design.md` | v3.6 scope, individual/aggregate outputs and testbed acceptance |
| `pom.xml` | Java 17 Maven parent; aggregates core and Maven plugin modules |
| `LICENSE` | User-selected MIT license |
| `docs/maven-central.md` | Maven Central release and plugin-consumption instructions |
| `docs/codex/DECISIONS.md` | Historical and current scope decisions |

P0 rebuilt the core POM and exact-version input boundary. P2 adds `SkillGenerator` and `DocumentReferences`; P3 adds `GeneratedSkillValidator` and `ServiceSkillUpdater`. P4 adds `smartdoc-agent-maven-plugin`, a static-input Maven lifecycle testbed, and a runtime springdoc `verify` probe with current-build input checks. Legacy IR remains deleted.

## Implementation Locations

Core and the thin Maven entry point now exist:

- `smartdoc-agent-core/src/main/java/com/smartdoc/agent/core/`: OpenApiInput.java (version/JSON boundary), SkillGenerator.java (service assembly), DocumentReferences.java (local graph, contract rendering and links), GeneratedSkillValidator.java (complete-tree checks), and ServiceSkillUpdater.java (bounded generation, locking, staged replacement, recovery, and external status).
- `AggregateSkillGenerator.java` assembles validated service reference trees with a single trusted entrypoint, service catalog and provenance. Trusted templates reside in `SkillGenerator.java` and `AggregateSkillGenerator.java`.
- Plugin `MultiServiceGeneration.java` coordinates modes, required membership and independent/aggregate publication. `ServiceSource.java` holds member identities and input sources.
- `smartdoc-agent-core/src/test/`: sanitized OpenAPI fixture, small boundary inputs, and meaningful semantic tests.
- `smartdoc-agent-maven-plugin/src/main/java/com/smartdoc/agent/maven/`: `GenerateSkillMojo` and its explicit-path `DocumentSource` configuration bean. The Mojo normally discovers top-level JSON files in one configured producer directory, retains explicit file configuration as a fallback, can reject files older than the Maven session, and translates P3 results into Maven info/warning output.
- `testbeds/maven-plugin-integration/`: two valid service-owner modules, an opt-in broken Java module, static OpenAPI inputs, POM examples, and `verify.ps1` for real lifecycle assertions.

Do not add CLI, server, package repository, generic ingestion, or distribution modules. The implemented standalone fixture at `testbeds/springdoc-multi-package/` has `user`, `order`, `file`, and `common` packages and explicit `account`/`business` groups. It is outside the root reactor and must not become a production dependency. Future core tests consume its frozen sanitized snapshots rather than start it on every run.

## Generated Or Ignored Directories

- Maven `**/target/` output is not source.
- `smartdoc-agent-core/target/smartdoc/springdoc-multi-package-api/` is the verified test-generated Skill. The P3 publisher is verified in temporary directories; no production build invokes it yet.
- `testbeds/maven-plugin-integration/target/generated-resources/smartdoc/` is ignored verification output for the Maven goal; it is recreated by the verifier.
- `testbeds/springdoc-multi-package/target/generated-openapi/` and `target/generated-resources/smartdoc/` are ignored runtime-integration outputs recreated by the generated-document verifier.
- For an output parent, the final Skill is `<skillName>/`; updater state is outside it under `.smartdoc/locks/<skillName>.lock`, `.smartdoc/staging/`, `.smartdoc/backups/`, and `.smartdoc/status/<serviceId>.json`.
- Each service and aggregate owns separate output, staging, lock and status paths. Individual references use `references/documents/<documentId>/`; aggregate members use `references/services/<serviceId>/references/documents/<documentId>/`. The aggregate has one root `SKILL.md` and remains independently installable.
- Preserve safe local ignore rules for IDE files, secrets, logs, and temporary files.
- Generated restricted API documentation must not be committed as a substitute for sanitized fixtures.

## Caution Areas

- Do not silently restore the user's core deletions or call the missing-POM state a completed migration.
- Output replacement must only affect a validated generator-owned directory, never a source root or a directory with unrelated manual content.
- Do not treat a local test snapshot as proof of current-code freshness in production.
- Do not treat the testbed's `verify`-phase runtime export as ordinary `compile` coverage; application-start failure remains build-fatal in that sample.
- Independent IDE compilation is outside the accepted workflow; IDE builds are covered only when delegated to Maven.
- Stable links and filenames matter; a ZIP identity/verification platform is outside scope.
- Never replace a shared parent containing multiple service outputs. Do not infer service boundaries from Java packages or Maven directory names.

