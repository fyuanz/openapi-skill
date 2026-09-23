# Modules

## Module Index

| Module | Responsibility | Status |
| --- | --- | --- |
| Parent project | Java 17/Maven dependency management and module aggregation | `openapi-skill:2.1.1-SNAPSHOT`; parent, core and Starter reactor |
| `openapi-skill-core` | Per-service conversion, two-level catalog discovery, context navigation, aggregate assembly, validation and safe filesystem publication | 86 tests pass |
| `openapi-skill-spring-boot-starter` | Runtime SpringDoc discovery, current Skill generation and deterministic ZIP download | 2 tests pass; primary SpringDoc integration |
| `openapi-skill-node` | TypeScript npm library/CLI for one project Skill spanning explicitly configured services/documents and one or more output parents | `openapi-skill@2.1.2` is published as npm `latest`; local source with unreleased catalog discovery passes 70 tests |
| `testbeds/springdoc-multi-package` | Multi-package/group Spring Boot runtime download example | 7 tests pass; no OpenAPI Skill build executions |
| `testbeds/vue-ts-consumer` | Real Vue 3 + TypeScript consumer that generates the Skill from the running testbed and calls its documented API | Builds and passes 7 live call scenarios; generated Skill and `node_modules` are not committed |

## Parent Project

Coordinates are `io.github.fyuanz:openapi-skill`, `openapi-skill-core`, and
`openapi-skill-spring-boot-starter`; current source is `2.1.1-SNAPSHOT` after the published `1.0.0` and `2.0.0`. Java
packages use `io.github.fyuanz.openapi.skill`.

## Core

`SkillGenerator.generate(serviceId, skillName, documents)` converts a complete map of document IDs to OpenAPI 3.0.x/3.1.x
JSON bytes into an immutable map of relative paths to UTF-8 content. It preserves operation/schema JSON plus effective
parameters, servers, and security, and creates compact catalogs, one group-index document context, one interface file per
first OpenAPI tag, sorted machine JSONL indexes, and precomputed document-local direct/transitive reference closures.
Semantic IDs do not depend on SpringDoc operationId; unique safe filenames are clean and bounded to 72 characters, and
suffixes are reserved for true collisions or filesystem-safety fallbacks. Shared absent/null/empty/default semantics live
once in `conventions.md`, linked from contract
files. The `SKILL.md` frontmatter carries a bilingual action-triggered
description built only from validated identities; `boundedList()` truncates the interpolated group list so the
32-document worst case stays a single YAML-safe line under 1024 characters.

`CatalogDiscovery` renders complete interface discovery entries for service and aggregate catalogs from existing operation
indexes. It preserves document/group ownership, safely renders source aliases, and idempotently enriches older embedded
service catalogs without rewriting their contracts. `AggregateSkillGenerator` assembles validated service trees without semantic OpenAPI merging. `GeneratedSkillValidator`
and `ServiceSkillUpdater` retain generic validated filesystem publication primitives. Core performs no Spring, Maven,
HTTP, ZIP, UI, LLM, business API, or external-reference actions.

Bounds remain 32 documents, 8 MiB each, 32 MiB aggregate input, 128 reference levels, 5000 reference targets per document,
10000 output files, and 64 MiB output. Local JSON Pointer references are supported; external, dangling, anchored, dynamic,
rebased, cyclic aliases, and ambiguous Path Item reference siblings fail explicitly.

## Runtime Spring Boot Starter

The Starter depends on core and the SpringDoc WebMVC API. Boot discovers
`RuntimeSkillAutoConfiguration` through `AutoConfiguration.imports` when a Servlet application and SpringDoc resource are
present and `openapi.skill.runtime.enabled` is not false.

- `RuntimeSkillProperties`: optional enabled/path/serviceId/skillName overrides.
- `RuntimeSkillNames`: safe defaults from `spring.application.name`.
- `SpringDocOpenApiCollector`: enumerates `GroupedOpenApi` or selects the default document, then calls
  `MultipleOpenApiWebMvcResource` / `OpenApiWebMvcResource` directly in the same JVM.
- `RuntimeSkillArchive`: invokes core and creates a sorted, fixed-timestamp ZIP with one Skill root.
- `RuntimeSkillEndpoint`: hidden read-only controller at `${openapi.skill.runtime.path:/openapi-skill/skill.zip}`.

The collector does not treat the application's base `OpenAPI` bean as the final generated contract and does not perform
HTTP self-requests. It supplies a wrapped request representing the original SpringDoc path so SpringDoc server URL
calculation stays consistent. A request either returns one fully generated archive or fails without filesystem changes.

The endpoint follows existing application security. Servlet/WebMVC is the only current adapter. WebFlux, different
management-port resource layouts, remote service aggregation, caching, and artifact repositories are deferred.

## Node.js Package

The unscoped `openapi-skill` package targets Node.js 20+ and exports both an `openapi-skill` CLI and typed library
functions. Its default `README.md` is Chinese and links reciprocally to `README.en.md`. Published version `2.1.2` retains the
preferred top-level `services` configuration: one project may contain internal and third-party services, and each
service may contain multiple explicit document ID plus HTTP(S) URL or local JSON path pairs. One configuration produces one self-contained
project Skill; `skillName` defaults to `api-docs` and no service has a separately installed Skill.

Project generation physically embeds each complete service reference tree under
`references/services/<serviceId>/references/`, omits member `SKILL.md` files, and connects the root catalog to service
catalogs with relative Markdown links. Root provenance uses `openapi-skill-core/3` and `kind=project`; nested service
provenance and the flattened service/document list preserve origin without merging OpenAPI objects or resolving `$ref`
across documents. `sourceType` is limited to `internal|third-party` and defaults to `internal`.

`catalog-discovery.ts` provides the corresponding shared Node discovery view. The outer catalog links to service catalogs,
which link to document contexts; both levels contain every operation's summary, source operationId, method/path and tag aliases.

Optional project-, service-, and document-level keywords are normalized, de-duplicated, sorted and recorded in trusted
catalog/provenance fields. Project and service keywords contribute only a bounded discovery fragment to the root
frontmatter; document keywords appear in both catalog levels and in provenance. Each level accepts at most 16
keywords of 1-64 printable characters. OpenAPI free text remains untrusted reference data and does not become Skill
instructions.

Project mode permits 1-32 services, at most 32 documents across the whole project, at most 32 MiB total HTTP/local
input, 10,000 output files, and 64 MiB output; the existing 8 MiB per-document and reference limits still apply. Local
relative paths resolve from the CLI project root and must name regular files; HTTP timeout and redirect rules remain
network-only. Every configured document must be read and validated before staged replacement, so failure retains the
previous complete Skill. HTTP redirects and external references remain rejected. The default output parent is
`<consumer>/.agents/skills`; `output` supports one relative/absolute override or an ordered array of 1-8 safe parents.
The generator runs once and each parent is published as an independent atomic unit. All targets are attempted; partial
success fails the overall run, remains published, and is reported without cross-target rollback.

The earlier top-level `serviceId`, `skillName`, and `documents` configuration remains accepted. Project and legacy
configuration shapes cannot be mixed; every new tree uses core/3, while the publisher recognizes owned core/1 and
core/2 trees only for safe atomic replacement. The local implementation with unreleased catalog discovery passes 70 Node tests; the prior `2.1.1` packed tarball
generates the project Skill in the real Vue consumer against the running SpringDoc testbed. Accepted input root markers
are any `3.0.x` or `3.1.x`, and `references/source.json` records the input's own dialect.

## Testbed

`testbeds/springdoc-multi-package` uses Spring Boot 3.5.9, SpringDoc 2.8.15, and the current runtime Starter. Its POM has no
Boot start/stop execution, SpringDoc Maven plugin, or OpenAPI Skill Maven plugin. A real random-port test downloads the current
two-group ZIP and validates its catalog/source structure. The build verifier asserts the removed build directories and
plugin invocations stay absent. Frozen `fixtures/` remain only as deterministic core test data.

`testbeds/vue-ts-consumer` is the consumer-side counterpart. It is a real Vue 3 + TypeScript + Vite project that installs
the packed Node package, runs `npm run skill:generate` against the running SpringDoc testbed, and calls all five
documented operations through a Vite dev-server proxy. It now installs the local `2.0.0` tarball, declares one
`springdoc-multi-package` service with project/service/document keywords, and generates the core/3 `api-docs` project
Skill with tag-grouped navigation. `verify-skill-tree.mjs` re-checks the tree and pins its whole-tree SHA-256.
`src/api/client.ts` carries
the typed client and the error shape. `README.md` documents the reproducible sequence; `CLOSURE-REPORT.md` records the
verification evidence, the three readability gaps found by an independent read-only Skill audit, and the later
project-mode run. Generated output (`node_modules/`, `dist/`, `.agents/`) is gitignored, so the Skill is regenerated
rather than committed.
