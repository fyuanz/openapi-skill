# Modules

## Module Index

| Module | Responsibility | Status |
| --- | --- | --- |
| Parent project | Java 17/Maven dependency management and module aggregation | Buildable; core and plugin tests execute |
| `smartdoc-agent-core` | Per-service conversion, aggregate assembly, validation and safe publication | 59 tests pass, including aggregate isolation, completeness and limits |
| `smartdoc-agent-maven-plugin` | Maven trigger, input checks, output-mode coordination and warning reporting | 15 tests pass; legacy and service/aggregate/both Maven fixtures pass |
| AI project docs | Persistent scope, context, and implementation guidance | Refreshed for v3.6 and manual Skill review |
| `testbeds/springdoc-multi-package` | Standalone annotated sample, frozen fixtures, and runtime springdoc-to-Skill verification | Implemented; five service tests and generated-document verification pass |
| `testbeds/maven-plugin-integration` | Standalone static-document multi-service Maven lifecycle verification | Implemented; scripted matrix passes |

## Parent Project

Development coordinates: `io.github.fyuanz:smart-doc-agent:1.1.0-SNAPSHOT`. Core and plugin inherit the group/version; Java packages remain unchanged. Published `1.0.0` is immutable and contains only the original per-service output configuration.

The opt-in `central-release` profile attaches sources/Javadoc, signs all release files using Maven GPG's BC signer and publishes the three-module reactor through Central Publishing Plugin 0.11.0. Root MIT license, developer and SCM metadata are inherited; the license is also included in both binary/source JARs. Authentication and signing secrets remain outside the repository. `docs/maven-central.md` documents the publisher and consumer workflows.

The parent describes OpenAPI-to-Skill conversion and aggregates core plus `smartdoc-agent-maven-plugin`. Core uses managed Jackson 2.16.1 and JUnit 5.10.2, compiler 3.13.0 and Surefire 3.2.5. The plugin uses Maven Plugin API 3.9.9 and Maven Plugin Tools 3.15.2. No legacy IR is restored.

## Core

P2 is complete: `SkillGenerator.generate(serviceId, skillName, documents)` returns an immutable complete content map and performs no filesystem or network actions. `DocumentReferences` renders contract JSON in Markdown with document-local graph links. Operation files preserve original operations plus effective path/operation parameters, servers and security; schema and other referenced component files preserve exact JSON semantics. Catalogs list all operations, tags and schemas by document. Names are safe lowercase IDs; operation paths, schema pointers and tags use SHA-256 filenames to avoid unsafe characters and case collisions. Metadata records the generator format version, service/Skill identity, full document set, each input digest, OpenAPI/API versions, and operation/schema counts.

Bounds: 32 documents, 8 MiB per document, 32 MiB aggregate input, 128 graph nesting levels, 5000 schema/reference targets per document, 10000 output files and 64 MiB output. The final output cap is checked before returning the content map, not a process memory guarantee. Local JSON Pointer fragments, including root and escaped pointers, and bare multi-level Path Item aliases are supported. External, dangling, anchored, dynamic and rebased references fail explicitly; ambiguous Path Item `$ref` siblings are rejected. Example/default/enum/const and extension payloads remain data, not reference traversal targets. Known OpenAPI container shapes are checked, but core remains a converter rather than a full OpenAPI specification validator.

P3 adds `ServiceSkillUpdater.update(...)`: it obtains a per-output lock, runs generation with a timeout, checks the complete in-memory result, writes and rechecks a private staging tree, replaces only a matching generator-owned Skill, and restores the previous complete tree when publication fails. A failed restore leaves the complete backup for recovery. It never clears the shared output parent or adopts an existing manual/foreign directory. Last-attempt JSON status stays outside the Skill, and a status-write failure is returned without undoing a valid publication. Timed-out generation cannot publish later because only the updater thread can consume and publish its returned map.

Publication validation enforces safe normalized relative paths, case-insensitive collision and file/directory conflict checks, the 10,000-file/64 MiB bounds, matching trusted entrypoint/source ownership, strict source JSON, reachable local Markdown links, and no symlinks or special filesystem entries. The test export still only writes sanitized snapshots under target. P3 tests use temporary directories; no source freshness, compiler hook or agent discovery is implied.

Target responsibilities:

- Accept a complete set of explicitly identified OpenAPI JSON documents for one service, each with the retained exact `3.1.0` input boundary; parse documents independently.
- Preserve API parameters, requests, responses, media types, authentication, inheritance/overrides, and schema facts.
- Resolve local shared, multi-level, recursive, and inline schema relationships with bounded traversal.
- Render a trusted `SKILL.md`, compact catalog, operation/schema files, optional tag navigation, and minimal source metadata.
- Check required structure, safe filenames, conflicts, bounds, and link targets.
- Return results and diagnostics; do not conceal conversion failure as success.
- Preserve service/document provenance and namespace same-named operations, schemas, and security definitions. Local references resolve only inside their source document; no automatic cross-document merge, deduplication, or external-reference support.
- Render one complete service Skill with a group-aware catalog and per-document references. Record all source document identities/digests and preserve documented server/authentication context without inventing gateway routes.

Dependency boundary:

- No Maven API, Spring Boot, springdoc internals, UI, LLM SDK, business API requests, or external-reference fetching.
- Introduce only the internal types needed by tests and rendering, not a speculative generic model or schema platform.
- No ZIP packaging, package identity system, artifact server, CLI framework, retrieval, chat, or installation management.

## Compilation Integration (Fixture-Verified Maven Plugin)

`outputMode` defaults to `service`; original top-level single-service parameters remain supported. An explicit `services` list configures 1-32 members with serviceId, skillName and directory or explicit documents. `aggregate` and `both` also require distinct aggregateId/aggregateSkillName. `MultiServiceGeneration` rejects identity/output collisions before writing, reuses bounded safe updates, and never substitutes previous Skill files for missing inputs. Both mode assembles successful current member maps; aggregate-only mode bounds all member reading/conversion/assembly in one task. `AggregateSkillGenerator` preserves service/document namespaces and links in a self-contained tree with one entrypoint. Each output retains independent status and failure recovery.

`GenerateSkillMojo` exposes the thread-safe `generate-skill` goal without a default lifecycle phase, so every target POM must place it after its producer. Configuration supplies one `serviceId`, one `skillName`, an output parent, a positive timeout, and normally one `documentsDirectory`; explicit `{id, path}` entries remain an alternative. Directory mode discovers regular top-level JSON files in stable filename order, derives IDs from safe lowercase filename stems, ignores other files, and logs SKIPPED when the directory is absent or empty. The Mojo snapshots all discovered files inside the P3 generation boundary, invokes `SkillGenerator`, and logs SUCCESS as info or every update failure as a service-specific warning. With `requireCurrentBuildDocuments`, each file must have been rewritten no earlier than the Maven session start and must not change while being read. It deliberately does not throw for configuration, document, freshness, conversion, timeout, locking, or publication failures.

The standalone `testbeds/maven-plugin-integration/` reactor configures the goal explicitly in each service-owner module with `<inherited>false>`. Its verifier proves first/repeated compile, changed/deleted API content, package traversal, targeted service compilation, two-thread reactor execution, exactly one update per participating service, invalid and absent documents, first-run failure, blocked output, invalid configuration, whole-tree retention, unaffected peer-service updates, and a normal nonzero build result for invalid Java.

The `springdoc-multi-package` verifier proves a separate generated-input route. Spring Boot starts the packaged test application at `pre-integration-test`; springdoc Maven Plugin 1.5 captures account and business at `integration-test`; Spring Boot stops at `post-integration-test`; SmartDoc scans the generated JSON directory once at `verify` with current-build checks. A deliberate capture failure leaves the prior JSON untouched, produces a SmartDoc FAILED status/warning, retains the exact prior Skill tree, and keeps Maven successful.

Remaining target responsibilities:

- Target projects explicitly map service, owner module, producer directory, and phase. Providers are restricted to SpringDoc / NextDoc4j; runtime SpringDoc is verified at `verify` only.
- Decide how the production build handles application-start failure. The springdoc HTTP capture is non-blocking in the fixture, while Spring Boot's `start` goal still fails Maven before SmartDoc can isolate it.
- Treat every JSON discovered for one execution as the service's current atomic set. “Document” means an OpenAPI JSON file/group rather than an additional checklist of API facts; absent groups/content are not invented. Use explicit entries only when the target needs a fixed required group set.
- Scope output, staging, mutual exclusion, and status by service. Reject colliding service outputs without overwriting or clearing their shared parent.
- Establish a generation owner after all required local input producers. The aggregate fixture uses explicit dependencies for parallel reactor ordering. Missing member input fails the complete aggregate; a parent aggregator cannot assume child readiness. Real-target/web acceptance is removed from the task plan.

Core errors remain observable; only the integration layer decides the non-blocking build behavior. Existing business build failures must remain failures. Host process failure or inability to load the plugin is not an exception a running generator can intercept.

The plugin-to-core wiring and Maven `compile` binding are verified for fixture documents. Runtime SpringDoc order, directory discovery, and stale-input rejection are verified at `verify` in the standalone service. Production providers are restricted to SpringDoc / NextDoc4j, output defaults under `target/generated-resources/smartdoc`, and independent IDE compilation is out of scope. Target POMs still choose their owner module/phase and application-start failure behavior.

## Deferred Modules And Contracts

The earlier `smartdoc-agent-cli`, `smartdoc-agent-server`, deterministic package/verify stack, package manifest schema, download APIs, and artifact repository are not current work.

The minimal Spring Boot testbed is implemented under `testbeds/springdoc-multi-package/` with an independent Spring Boot 3.5.9 parent, springdoc WebMVC UI 2.8.15, and springdoc Maven Plugin 1.5. It owns sample controllers/DTO annotations, explicit groups, real HTTP export and Swagger UI/group-discovery assertions, three MockMvc behavior tests, and frozen sanitized inputs with source digests. `refresh-fixtures.ps1` refreshes snapshots only after clean tests. `verify-generated-integration.ps1` uses dynamic loopback HTTP/JMX ports and verifies the later runtime export/Skill chain plus stale capture failure. This remains a testbed rather than a production dependency.

Also defer automatic cross-project install/update, lock/drift management, search, RAG, AI enrichment, TypeScript, alternate knowledge-source types/formats, Agent plugins/MCP, and multi-tenant operations. Aggregate Skills are supported without semantic contract merging. Global release orchestration and cross-repository scheduling remain deferred. User Skill review is manual, not a web/frontend acceptance task.

Generation-side automatic updates are required; cross-project installation management is a separate deferred capability.

