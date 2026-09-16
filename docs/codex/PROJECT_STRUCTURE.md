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
|   |-- openapi-skill-design.md
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
|   |-- vue-ts-consumer/    # real Vue 3 + TS consumer; generates Skill from the running service
|   |   |-- package.json      # installs the packed Node package as a dev dependency
|   |   |-- openapi-skill.config.json # two live document URLs
|   |   |-- vite.config.ts    # dev proxy /api/* -> 127.0.0.1:18080
|   |   |-- README.md         # reproducible sequence
|   |   |-- CLOSURE-REPORT.md # verification evidence and Skill audit findings
|   |   `-- src/              # App.vue plus the typed client in api/client.ts
|   `-- maven-plugin-integration/ # static reactor; verify.ps1 and verify-aggregate.ps1
|       `-- skill-set/          # opt-in aggregate owner depending on both service modules
|-- openapi-skill-core/
|   |-- pom.xml
|   `-- src/                # input validation, Skill generation, safe publication and focused tests
|-- openapi-skill-maven-plugin/
|   |-- pom.xml
|   `-- src/                # legacy/compatibility Maven goal and focused tests
|-- openapi-skill-spring-boot-starter/
|   |-- pom.xml
|   |-- README.md
|   `-- src/                # runtime auto-configuration, SpringDoc collection, ZIP endpoint and tests
|-- openapi-skill-node/
|   |-- package.json        # unscoped openapi-skill 1.0.0 source and CLI; packed, not yet published
|   |-- README.md           # default Chinese Node package guide
|   |-- README.en.md        # equivalent English Node package guide with reciprocal link
|   |-- src/                # service/project generators, keyword/config rules, downloader and safe publisher
|   `-- test/               # Node unit, project-tree, publication and loopback HTTP integration tests
`-- pom.xml
```

## Important Files

| Path | Purpose |
| --- | --- |
| `AGENTS.md` | First-read, test-first development, and documentation rules |
| `README.md` / `README.en.md` | Runtime-first onboarding, legacy Maven compatibility, Skill usage and verification |
| `docs/openapi-skill-design.md` | v3.9 runtime, project-Skill and semantic-index architecture |
| `pom.xml` | Java 17 Maven parent; aggregates core, Maven plugin and runtime Starter |
| `LICENSE` | User-selected MIT license |
| `docs/maven-central.md` | Maven Central release and plugin-consumption instructions |
| `docs/codex/DECISIONS.md` | Historical and current scope decisions |

P0-P6 produced the core, safe publisher, Maven compatibility plugin, and aggregate output. v3.7 added a runtime Starter
and removed build-time startup/capture/generation from the SpringDoc testbed. v3.8 added Node project mode; v3.9 adds
core/1 semantic indexes, compact catalogs and centralized reading conventions. Legacy IR remains deleted.

## Implementation Locations

Core, runtime entry point, and Maven compatibility entry point now exist:

- `openapi-skill-core/src/main/java/com/openapi-skill/agent/core/`: OpenApiInput.java (version/JSON boundary), SkillGenerator.java (service assembly and indexes), SemanticNames.java (readable collision-safe paths), DocumentReferences.java (local graph, contract rendering and links), GeneratedSkillValidator.java (complete-tree/index checks), and ServiceSkillUpdater.java (bounded generation, locking, staged replacement, recovery, and external status).
- `AggregateSkillGenerator.java` assembles validated service reference trees with a single trusted entrypoint, service catalog and provenance. Trusted templates reside in `SkillGenerator.java` and `AggregateSkillGenerator.java`.
- Plugin `MultiServiceGeneration.java` coordinates modes, required membership and independent/aggregate publication. `ServiceSource.java` holds member identities and input sources.
- `openapi-skill-core/src/test/`: sanitized OpenAPI fixture, small boundary inputs, and meaningful semantic tests.
- `openapi-skill-maven-plugin/src/main/java/com/openapi-skill/agent/maven/`: `GenerateSkillMojo` and its explicit-path `DocumentSource` configuration bean. The Mojo normally discovers top-level JSON files in one configured producer directory, retains explicit file configuration as a fallback, can reject files older than the Maven session, and translates P3 results into Maven info/warning output.
- `openapi-skill-spring-boot-starter/src/main/java/com/openapi-skill/agent/runtime/`: Boot auto-configuration,
  optional runtime properties, safe identity derivation, direct SpringDoc final-resource collection, deterministic in-memory
  ZIP creation, and the hidden `/openapi-skill/skill.zip` controller.
- `openapi-skill-spring-boot-starter/src/test/`: default-document and multi-group auto-configuration/ZIP tests.
- `openapi-skill-node/src/config.ts` accepts the preferred top-level `services` model, defaults its `skillName` to
  `api-docs`, validates source types and project/service/document keywords, and normalizes the earlier single-service
  configuration without changing that legacy contract.
- `openapi-skill-node/src/project-generator.ts` generates one `openapi-skill-core/1`, `kind=project` tree. It builds
  each service through the core-compatible service generator, omits nested `SKILL.md` files, physically relocates the
  complete reference trees beneath `references/services/<serviceId>/references/`, and creates the root catalog,
  provenance, and trusted entrypoint.
- `openapi-skill-node/src/keywords.ts` applies deterministic keyword trimming, NFC normalization, de-duplication,
  sorting, count/length/control-character checks, and bounded frontmatter discovery text.
- `openapi-skill-node/src/index.ts` downloads the complete project input and routes legacy configuration to the
  service generator or `services` configuration to the project generator. `publisher.ts` validates
  `openapi-skill-core/1` indexes before staged replacement.
- The Node CLI defaults output to the consuming project's `.agents/skills/`; an explicit relative or absolute output
  parent remains supported.
- `testbeds/maven-plugin-integration/`: two valid service-owner modules, an opt-in broken Java module, static OpenAPI inputs, POM examples, and `verify.ps1` for real lifecycle assertions.

Do not add package repositories, unconfigured URL discovery, or cross-service aggregation to the embedded runtime
Starter. The Node CLI's explicit trusted configuration is the only current remote URL ingestion boundary. The standalone fixture at
`testbeds/springdoc-multi-package/` has `user`, `order`, `file`, and `common` packages plus `account`/`business` groups.
It consumes the Starter but remains outside the root reactor. Core tests consume frozen sanitized snapshots offline.
`testbeds/vue-ts-consumer/` is the consumer-side counterpart and also stays outside the Maven reactor; it is a plain npm
project whose generated Skill, `node_modules/`, and `dist/` are ignored rather than committed.

## Generated Or Ignored Directories

- Maven `**/target/` output is not source.
- `openapi-skill-core/target/openapi-skill/springdoc-multi-package-api/` is the verified test-generated Skill. The P3 publisher is verified in temporary directories; no production build invokes it yet.
- `testbeds/maven-plugin-integration/target/generated-resources/openapi-skill/` is ignored verification output for the Maven goal; it is recreated by the verifier.
- `testbeds/vue-ts-consumer/` ignores `node_modules/`, `dist/`, `*.tsbuildinfo`, and `.agents/`. The generated Skill is a build artifact produced by `npm run skill:generate` against a running service, so it is regenerated instead of committed.
- The runtime testbed must not create `target/generated-openapi/` or `target/generated-resources/openapi-skill/`; its explicit
  fixture test still writes asserted snapshots to `target/openapi/` for the separate refresh script.
- For an output parent, the final Skill is `<skillName>/`; updater state is outside it under `.openapi-skill/locks/<skillName>.lock`, `.openapi-skill/staging/`, `.openapi-skill/backups/`, and `.openapi-skill/status/<serviceId>.json`.
- Each service and aggregate owns separate output, staging, lock and status paths. Individual references use `references/documents/<documentId>/`; aggregate members use `references/services/<serviceId>/references/documents/<documentId>/`. The aggregate has one root `SKILL.md` and remains independently installable.
- Node project output uses one `<skillName>/` (default `api-docs`) with one root `SKILL.md`. Its root catalog and
  provenance are `references/catalog.md` and `references/source.json`; every physical member tree is under
  `references/services/<serviceId>/references/`. Relative Markdown links provide navigation, not filesystem symlinks.
  Node staging and backup attempts stay beside the output under `.openapi-skill/staging/` and `.openapi-skill/backups/`.
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
- In Node project mode, every configured service and document is required for one full replacement. Never publish a
  partial project tree or use a stale member as a substitute for a failed download.
