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
|-- openapi-skill-core/
|   |-- pom.xml
|   `-- src/                # input validation, Skill generation, safe publication and focused tests
|-- openapi-skill-spring-boot-starter/
|   |-- pom.xml
|   |-- README.md
|   `-- src/                # runtime auto-configuration, SpringDoc collection, ZIP endpoint and tests
|-- openapi-skill-node/
|   |-- package.json        # unscoped openapi-skill 2.0.0 source and CLI; locally packed, 1.0.0/1.1.0 published
|   |-- README.md           # default Chinese Node package guide
|   |-- README.en.md        # equivalent English Node package guide with reciprocal link
|   |-- src/                # service/project generators, keyword/config rules, downloader and safe publisher
|   `-- test/               # Node unit, project-tree, publication and loopback HTTP integration tests
`-- pom.xml
```

## Important Files

| Path | Purpose |
| --- | --- |
| `AGENTS.md` | Repository-specific first-read, test-first, documentation, verification, and delivery rules; it does not duplicate OpenSpec workflow instructions |
| `README.md` / `README.en.md` | Runtime/Node onboarding, Skill usage and verification |
| `docs/openapi-skill-design.md` | v4.0 runtime and context-first project-Skill architecture |
| `pom.xml` | Java 17 Maven parent; aggregates core and runtime Starter |
| `LICENSE` | User-selected MIT license |
| `docs/maven-central.md` | Maven Central release and Starter-consumption instructions |
| `docs/codex/DECISIONS.md` | Historical and current scope decisions |

P0-P6 historically produced the core, safe publisher, Maven compatibility plugin, and aggregate output. The compatibility
module was later removed by product decision. v3.7 added a runtime Starter
and removed build-time startup/capture/generation from the SpringDoc testbed. v3.8 added Node project mode; v3.9 added
semantic indexes and centralized conventions; v4.0 added core/2 context-first navigation, clean paths and precomputed
reference closures; v4.1 adds core/3 tag grouping, a slim group-index context, catalog-owned server/security facts and
readable 72-character names. Legacy IR remains deleted.

## Implementation Locations

Core and runtime entry points now exist:

- `openapi-skill-core/src/main/java/io/github/fyuanz/openapi/skill/core/`: OpenApiInput.java (version/JSON boundary), SkillGenerator.java (service assembly and indexes), SemanticNames.java (readable collision-safe paths), DocumentReferences.java (local graph, contract rendering and links), GeneratedSkillValidator.java (complete-tree/index checks), and ServiceSkillUpdater.java (bounded generation, locking, staged replacement, recovery, and external status).
- `CatalogDiscovery.java` renders service/aggregate discovery from existing operation indexes and safely enriches older embedded catalogs. `AggregateSkillGenerator.java` assembles validated service reference trees with a single trusted entrypoint, service catalog and provenance. Trusted templates reside in `SkillGenerator.java` and `AggregateSkillGenerator.java`.
- `openapi-skill-core/src/test/`: sanitized OpenAPI fixture, small boundary inputs, and meaningful semantic tests.
- `openapi-skill-spring-boot-starter/src/main/java/io/github/fyuanz/openapi/skill/runtime/`: Boot auto-configuration,
  optional runtime properties, safe identity derivation, direct SpringDoc final-resource collection, deterministic in-memory
  ZIP creation, and the hidden `/openapi-skill/skill.zip` controller.
- `openapi-skill-spring-boot-starter/src/test/`: default-document and multi-group auto-configuration/ZIP tests.
- `openapi-skill-node/src/config.ts` accepts the preferred top-level `services` model, defaults its `skillName` to
  `api-docs`, validates source types and project/service/document keywords, resolves explicit HTTP(S) or local document
  sources from the CLI project root, normalizes one or 1-8 safe output parents, and preserves the earlier single-service
  and single-output contracts.
- `openapi-skill-node/src/project-generator.ts` generates one `openapi-skill-core/3`, `kind=project` tree. It builds
  each service through the core-compatible service generator, omits nested `SKILL.md` files, physically relocates the
  complete reference trees beneath `references/services/<serviceId>/references/`, and creates the root catalog,
  provenance, and trusted entrypoint.
- `openapi-skill-node/src/catalog-discovery.ts` shares document/group/operation discovery rendering between the service
  generator and outer project catalog. `testbeds/verify-catalog-discovery.mjs` compares Java/Node discovery using the shared
  `openapi-skill-core/src/test/resources/catalog-discovery.json` and test-generated files under `openapi-skill-core/target/catalog-discovery/`.
- `openapi-skill-node/src/keywords.ts` applies deterministic keyword trimming, NFC normalization, de-duplication,
  sorting, count/length/control-character checks, and bounded frontmatter discovery text.
- `openapi-skill-node/src/index.ts` reads the complete project input from HTTP(S) or regular local files under shared
  per-document/project byte limits, routes legacy configuration to the service generator or `services`
  configuration to the project generator, and publishes that one generated file map to every configured target.
  `output-publication.ts` records ordered target results and partial failure; `publisher.ts` validates
  `openapi-skill-core/3` contexts, group files, closures and machine indexes before staged replacement; owned core/1 and
  core/2 trees are recognized only as replacement inputs.
- `openapi-skill-node/src/references.ts` allocates two filename families in two deterministic passes: ASCII semantic
  slugs for operations and schemas, and tag stems that preserve `\p{L}\p{N}_-` so a Chinese tag keeps its own name.
  `generator.ts` renders the catalog facts, the group-index context, the group files and the slimmed one-line entries.
- The Node CLI defaults output to the consuming project's `.agents/skills/`; `output` accepts one relative/absolute
  parent or an ordered array of 1-8 non-duplicate, non-nested parents.

Do not add package repositories, unconfigured URL discovery, or cross-service aggregation to the embedded runtime
Starter. The Node CLI's explicit trusted configuration is the only current remote URL ingestion boundary. The standalone fixture at
`testbeds/springdoc-multi-package/` has `user`, `order`, `file`, and `common` packages plus `account`/`business` groups.
It consumes the Starter but remains outside the root reactor. Core tests consume frozen sanitized snapshots offline.
`testbeds/vue-ts-consumer/` is the consumer-side counterpart and also stays outside the Maven reactor; it is a plain npm
project whose generated Skill, `node_modules/`, and `dist/` are ignored rather than committed.

## Generated Or Ignored Directories

- Maven `**/target/` output is not source.
- `openapi-skill-core/target/openapi-skill/springdoc-multi-package-api/` is the verified test-generated Skill. The P3 publisher is verified in temporary directories; no production build invokes it yet.
- `testbeds/vue-ts-consumer/` ignores `node_modules/`, `dist/`, `*.tsbuildinfo`, and `.agents/`. The generated Skill is a build artifact produced by `npm run skill:generate` against a running service, so it is regenerated instead of committed.
- The runtime testbed must not create `target/generated-openapi/` or `target/generated-resources/openapi-skill/`; its explicit
  fixture test still writes asserted snapshots to `target/openapi/` for the separate refresh script.
- For an output parent, the final Skill is `<skillName>/`; updater state is outside it under `.openapi-skill/locks/<skillName>.lock`, `.openapi-skill/staging/`, `.openapi-skill/backups/`, and `.openapi-skill/status/<serviceId>.json`.
- Each service and aggregate owns separate output, staging, lock and status paths. Individual references use `references/documents/<documentId>/`; aggregate members use `references/services/<serviceId>/references/documents/<documentId>/`. The aggregate has one root `SKILL.md` and remains independently installable.
- Each Node project output uses one `<skillName>/` (default `api-docs`) with one root `SKILL.md`. Its root catalog and
  provenance are `references/catalog.md` and `references/source.json`; every physical member tree is under
  `references/services/<serviceId>/references/`. Relative Markdown links provide navigation, not filesystem symlinks.
  Node staging and backup attempts stay beside each output under `.openapi-skill/staging/` and `.openapi-skill/backups/`.
  Each target is replaced atomically and independently; successful targets are not rolled back when another target fails.
- OpenSpec splits by lifetime, not by tool. `openspec/` is the tracked workflow and specification source:
  `config.yaml`, `specs/` for agreed current behavior, `changes/<name>/` for in-flight proposals, and
  `changes/archive/<date>-<name>/` for history. The generated agent instruction trees `.agents/`, `.claude/`, and
  `.codebuddy/` are ignored because `openspec update` rewrites them from the installed CLI version; they are output,
  not reviewable source. Root `AGENTS.md` is separate reviewable project guidance for repository engineering rules
  only; it must not become a second copy of OpenSpec command or lifecycle instructions.
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
