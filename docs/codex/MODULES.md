# Modules

## Module Index

| Module | Responsibility | Status |
| --- | --- | --- |
| Parent project | Java 17/Maven dependency management and module aggregation | `1.2.0`; four-module reactor |
| `smartdoc-agent-core` | Per-service conversion, aggregate assembly, validation and safe filesystem publication | 59 tests pass |
| `smartdoc-agent-spring-boot-starter` | Runtime SpringDoc discovery, current Skill generation and deterministic ZIP download | 2 tests pass; primary SpringDoc integration |
| `smartdoc-agent-maven-plugin` | Static/local JSON and build-time individual/aggregate compatibility | 15 tests pass; compatibility path |
| `smartdoc-agent-node` | TypeScript npm library/CLI for multiple OpenAPI URL download and one safe local Skill publication | 5 Node tests pass; npm package ready |
| `testbeds/springdoc-multi-package` | Multi-package/group Spring Boot runtime download example | 6 tests pass; no SmartDoc build executions |
| `testbeds/vue-ts-consumer` | Real Vue 3 + TypeScript consumer that generates the Skill from the running testbed and calls its documented API | Builds and passes 7 live call scenarios; generated Skill and `node_modules` are not committed |
| `testbeds/maven-plugin-integration` | Legacy static multi-service Maven lifecycle verification | Retained and passing at the prior milestone |

## Parent Project

Release coordinates are `io.github.fyuanz:1.2.0`. Central `1.2.0` contains the parent, core, Maven plugin, and runtime
Starter. Java packages remain `com.smartdoc.agent`; the opt-in Central release profile and signing process remain
unchanged.

## Core

`SkillGenerator.generate(serviceId, skillName, documents)` converts a complete map of document IDs to exact OpenAPI 3.1.0
JSON bytes into an immutable map of relative paths to UTF-8 content. It preserves operation/schema JSON plus effective
parameters, servers, and security, and creates catalogs and document-local reference navigation.

`AggregateSkillGenerator` assembles validated service trees without semantic OpenAPI merging. `GeneratedSkillValidator`
and `ServiceSkillUpdater` retain safe filesystem publication for Maven compatibility. Core performs no Spring, Maven,
HTTP, ZIP, UI, LLM, business API, or external-reference actions.

Bounds remain 32 documents, 8 MiB each, 32 MiB aggregate input, 128 reference levels, 5000 reference targets per document,
10000 output files, and 64 MiB output. Local JSON Pointer references are supported; external, dangling, anchored, dynamic,
rebased, cyclic aliases, and ambiguous Path Item reference siblings fail explicitly.

## Runtime Spring Boot Starter

The Starter depends on core and the SpringDoc WebMVC API. Boot discovers
`RuntimeSkillAutoConfiguration` through `AutoConfiguration.imports` when a Servlet application and SpringDoc resource are
present and `smartdoc.runtime.enabled` is not false.

- `RuntimeSkillProperties`: optional enabled/path/serviceId/skillName overrides.
- `RuntimeSkillNames`: safe defaults from `spring.application.name`.
- `SpringDocOpenApiCollector`: enumerates `GroupedOpenApi` or selects the default document, then calls
  `MultipleOpenApiWebMvcResource` / `OpenApiWebMvcResource` directly in the same JVM.
- `RuntimeSkillArchive`: invokes core and creates a sorted, fixed-timestamp ZIP with one Skill root.
- `RuntimeSkillEndpoint`: hidden read-only controller at `${smartdoc.runtime.path:/smartdoc/skill.zip}`.

The collector does not treat the application's base `OpenAPI` bean as the final generated contract and does not perform
HTTP self-requests. It supplies a wrapped request representing the original SpringDoc path so SpringDoc server URL
calculation stays consistent. A request either returns one fully generated archive or fails without filesystem changes.

The endpoint follows existing application security. Servlet/WebMVC is the only current adapter. WebFlux, different
management-port resource layouts, remote service aggregation, caching, and artifact repositories are deferred.

## Maven Plugin Compatibility

`GenerateSkillMojo` still supports single-service and `service|aggregate|both` modes over local JSON directories or
explicit files. It retains current-build timestamp checks, bounded conversion, safe publication, warning-only Skill
failures, independent service updates, and complete aggregate membership. No new runtime project should need this plugin
just to consume its own SpringDoc document.

The Maven integration testbed remains for backward compatibility. It is distinct from the SpringDoc runtime testbed and
must not be used to justify reintroducing build-time startup/capture into the recommended flow.

## Node.js Package

`@fyuanz/smartdoc-agent` targets Node.js 20+ and exports both a `smartdoc-agent` CLI and typed library functions. It uses
explicit document IDs and HTTP(S) URLs, rejects redirects and external references, preserves the Java core's
`smartdoc-agent-core/1` Skill layout and bounds, and publishes only after every download and output validation succeeds.
The default output parent is `<consumer>/.agents/skills`; `output` supports a relative or absolute override.

## Testbed

`testbeds/springdoc-multi-package` uses Spring Boot 3.5.9, SpringDoc 2.8.15, and the current runtime Starter. Its POM has no
Boot start/stop execution, SpringDoc Maven plugin, or SmartDoc Maven plugin. A real random-port test downloads the current
two-group ZIP and validates its catalog/source structure. The build verifier asserts the removed build directories and
plugin invocations stay absent. Frozen `fixtures/` remain only as deterministic core test data.

`testbeds/vue-ts-consumer` is the consumer-side counterpart. It is a real Vue 3 + TypeScript + Vite project that installs
the packed Node package, runs `npm run skill:generate` against the running SpringDoc testbed, and calls all five
documented operations through a Vite dev-server proxy. `src/api/client.ts` carries the typed client and the error shape.
`README.md` documents the reproducible sequence; `CLOSURE-REPORT.md` records the verification evidence and the three
readability gaps found by an independent read-only Skill audit. Generated output (`node_modules/`, `dist/`, `.agents/`)
is gitignored, so the Skill is regenerated rather than committed.
