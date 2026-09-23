# Project Context

## Purpose

openapi-skill converts OpenAPI contracts into Codex Skills. A running Spring Boot WebMVC service can expose a directly
downloadable Skill ZIP, while the TypeScript npm consumer reads explicitly configured HTTP(S) endpoints or local JSON
files from one or more internal or third-party services and installs one complete project Skill into a Vue 3 or other
Node.js project.

The source of truth is `docs/openapi-skill-design.md`. Core conversion, the runtime Starter, and Node project-Skill
generation remain available. There is no Maven build-time compatibility plugin. Web/frontend acceptance is user-reviewed
and is not a delivery gate.

## Primary Workflow

1. A Spring Boot application includes `openapi-skill-spring-boot-starter` and its existing SpringDoc configuration.
2. After the application starts, `GET /openapi-skill/skill.zip` triggers generation.
3. The Starter enumerates local `GroupedOpenApi` beans, or selects the default document when no groups exist.
4. It invokes SpringDoc's final WebMVC resources inside the same JVM. It does not inject the incomplete base `OpenAPI`
   model as the final contract and does not issue an HTTP self-request.
5. Core parses each OpenAPI 3.0.x or 3.1.x JSON document independently, renders one complete service Skill, validates it,
   and the Starter returns a deterministic ZIP with a `<skillName>/` root.
6. Generation failure fails only that request. No build output or partial archive is written.

## Node Project Workflow

1. A consuming project configures one or more services, with one or more explicit document ID plus HTTP(S) URL or local
   JSON path pairs per service. Relative local paths resolve from the CLI project root; `sourceType` distinguishes
   `internal` from `third-party` sources.
2. Project-, service-, and document-level keywords provide trusted discovery/navigation aliases without importing
   untrusted OpenAPI free text into `SKILL.md`.
3. The CLI reads every configured document under a shared input budget; `timeoutMs` applies to HTTP downloads, while
   local paths must name regular files. A failed download/read or invalid document aborts the whole project update.
4. Both outer and service catalogs list source-derived operation summaries, operation IDs, method/path, tag groups,
   additional tag aliases and document keywords. Navigation follows outer catalog -> service catalog -> context -> group
   -> operation; single-service output starts at the service catalog. Same-named actions retain their owners, all operations
   are covered, and exceeding the existing output budget fails instead of silently truncating entries.
   The generator creates one self-contained Skill, named `api-docs` by default, with service trees physically included
   under `references/services/<serviceId>/references/` and connected through relative Markdown links.
   Each tree exposes one slim group-index context per document, one interface file per first OpenAPI tag, clean
   semantic paths and precomputed reference closures. Compact JSONL operation/schema indexes remain machine-only
   artifacts.
5. The publisher validates one generated tree and publishes it to one default output or 1-8 explicitly configured
   output parents. Each `<output>/<skillName>` is staged and replaced atomically; multiple outputs are independent,
   are all attempted in order, and do not form one cross-directory transaction or rollback unit.

## Current Status

- Java source uses `io.github.fyuanz:openapi-skill*:2.1.1-SNAPSHOT` with package namespace
  `io.github.fyuanz.openapi.skill`; the `1.0.0` and `2.0.0` coordinates are published.
- Node source is `openapi-skill@2.1.2`; the prior `2.1.1` source was locally packed and verified end to end in the real Vue consumer, and
  `2.0.0` is published. The published npm versions are `1.0.0`, `1.1.0` and `2.0.0` (`latest`).
- `openapi-skill-spring-boot-starter` provides Boot auto-configuration for Servlet/WebMVC and SpringDoc 2.8.x.
- Default path is `/openapi-skill/skill.zip`. `serviceId` derives from `spring.application.name`; Skill name defaults to
  `<serviceId>-api`. Enabled/path/identities are optional overrides.
- Multi-group and default-document runtime tests pass. The ZIP is deterministic across repeated requests and excludes
  the hidden OpenAPI Skill endpoint from the generated contract.
- The SpringDoc testbed now has no Boot start/stop Maven executions, SpringDoc Maven capture, OpenAPI Skill Maven goal,
  generated OpenAPI directory, or generated Skill directory. Its six tests validate Swagger UI, two OpenAPI groups,
  sample APIs, and a real random-port ZIP download.
- The Java reactor contains only parent, core, and Starter modules. Maven build-time compatibility and its integration
  testbed were removed by explicit product decision.
- `openapi-skill-node` source is `2.1.2`. Preferred `services` configuration
  generates one self-contained project Skill, defaults `skillName` to `api-docs`, supports internal and third-party
  services plus project/service/document keywords, and can publish the same generated tree to one or 1-8 output
  parents. Each target remains atomic, while partial multi-target success is reported and not rolled back. The legacy
  `serviceId` + `documents` configuration is still accepted, while all new output uses `openapi-skill-core/3`.
- Node verification currently passes 70 tests across two-level catalog discovery, configuration, local/HTTP input, multi-output publication and diagnostics, generation, tag grouping, context navigation, semantic indexes, provenance, project-tree
  validation, project-wide document/byte budgets, legacy/project version acceptance, atomic legacy/project migration,
  stale service removal, package metadata, and compatibility behavior. The locally packed `2.0.0` tarball was installed into
  `testbeds/vue-ts-consumer`; it builds and generates a core/3 `api-docs` project Skill from the running testbed.
- `testbeds/vue-ts-consumer` closes the consumer loop: a real Vue 3 + TypeScript project generates the Skill from the
  running SpringDoc testbed and calls all five documented operations through a dev-server proxy. An independent read-only
  audit of that Skill found it sufficient to write a correct typed client, plus three readability gaps recorded in its
  `CLOSURE-REPORT.md` and since addressed by core/1 targeted lookup and centralized OpenAPI conventions.
- Generated Skills describe themselves with a bilingual action-triggered sentence (task verbs, catalog navigation, a
  verification checklist, and generate-or-modify frontend request code) so LLM consumers can discover them by task.
- Tag-grouped navigation is implemented: each document keeps one `context.md` as a slim group index, one file per
  first OpenAPI tag carries the readable interface list (Chinese tag names preserved), the document's server and
  security facts live in the catalog, and normal filenames stay hash-free with collision/safety-only fallback bounded
  to 72 characters. Every operation still carries its precomputed document-local direct/transitive closure plus
  recursive edges.
- Historical releases remain available under the old `smart-doc-agent` / `smartdoc-agent-*` Maven coordinates and
  `smartdoc-agent` npm name. Under the current identities, npm `openapi-skill` has `1.0.0` and `1.1.0` published
  (`latest = 1.1.0`) and Maven Central has `io.github.fyuanz:openapi-skill{,-core,-spring-boot-starter}:1.0.0`; the
  source now carries the breaking `2.0.0` line, which awaits manual publication.
- Development follows OpenSpec (`@fission-ai/openspec@1.13.1`) as the single workflow source for spec-driven
  development, change lifecycle, and agreed behavior. `openspec/specs/` holds agreed current behavior and
  `openspec/changes/<name>/` holds in-flight proposals; both are tracked. The generated agent instruction trees
  (`.agents/`, `.claude/`, `.codebuddy/`) are ignored and refreshed by `openspec update`, while root `AGENTS.md`
  only records repository-specific engineering rules and does not duplicate OpenSpec instructions.

## Commands

```text
mvn -B clean install
mvn -B -f testbeds/springdoc-multi-package/pom.xml clean verify
powershell -NoProfile -File testbeds/springdoc-multi-package/verify-generated-integration.ps1
cd openapi-skill-node && npm test
```

Always run `clean` before a build whose output is inspected, compared, or released: a non-clean build after the product
rename packaged stale `com.smartdoc.agent.*` classes into the core JAR.

Consumer loop (generate the Skill, then build and run a real frontend):

```text
cd testbeds/vue-ts-consumer
npm install
npm run skill:generate
npm run build
npm run dev
```

Manual runtime check:

```text
mvn -B -f testbeds/springdoc-multi-package/pom.xml spring-boot:run
GET http://127.0.0.1:18080/openapi-skill/skill.zip
```

OpenSpec workflow commands and per-assistant invocation names are provided by the installed OpenSpec skills and the
OpenSpec CLI help; they are intentionally not duplicated in project documentation. Root `AGENTS.md` records only the
governance precedence and repository-specific engineering rules.

## Constraints

- Nontrivial features, refactors, and architectural changes start as an OpenSpec change proposal in
  `openspec/changes/<name>/` and are implemented only after the proposal is reviewed. `openspec/specs/`
  holds agreed current behavior and is reconciled by the change itself.
- Java 17, Spring Boot WebMVC 3.5.x, SpringDoc 2.8.x, and OpenAPI 3.0.x/3.1.x JSON only. The accepted set is defined by
  the root marker; every other version, including 3.2.x, stays rejected.
- Core stays independent of Spring Boot, SpringDoc, Maven, HTTP, and ZIP packaging.
- Runtime collection uses `OpenApiWebMvcResource` / `MultipleOpenApiWebMvcResource`; `OpenAPI` and `GroupedOpenApi`
  beans alone are not treated as complete generated documents.
- All local groups form one atomic per-request service input. References remain document-local; no semantic merge.
- Source text is untrusted reference data and never enters the trusted Skill instruction template.
- Existing document/file/reference/size bounds remain enforced. ZIP creation is in-memory and deterministic.
- The Starter endpoint follows application security and accepts no arbitrary source URL. The Node CLI intentionally
  reads only user-configured HTTP(S) URLs or plain local paths, rejects HTTP redirects, performs no path discovery or
  glob expansion, and treats the project configuration as trusted input.
- Node project mode permits at most 32 services and 32 documents across the project, 32 MiB aggregate input, 10,000
  output files, and 64 MiB output. Each document retains the existing 8 MiB and document-local reference boundaries.
- Cross-service aggregation inside the Node consumer is supported; cross-service aggregation by the embedded runtime
  Starter, WebFlux, management-port variants, external references, YAML,
  Swagger 2.0, package repositories, and automatic installation remain deferred.
- No Maven build-time plugin or lifecycle compatibility path is supported under the new coordinates.

Milestone delivery follows `AGENTS.md`: test first, update affected project docs, commit the reviewable slice, and push
normally without force-overwriting remote history.
