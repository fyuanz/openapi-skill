# Project Context

## Purpose

openapi-skill converts OpenAPI contracts into Codex Skills. A running Spring Boot WebMVC service can expose a directly
downloadable Skill ZIP, while the TypeScript npm consumer downloads explicitly configured OpenAPI endpoints from one or
more internal or third-party services and installs one complete project Skill into a Vue 3 or other Node.js project.

The source of truth is `docs/openapi-skill-design.md`. Core conversion, the runtime Starter, and Node project-Skill
generation remain available. There is no Maven build-time compatibility plugin. Web/frontend acceptance is user-reviewed
and is not a delivery gate.

## Primary Workflow

1. A Spring Boot application includes `openapi-skill-spring-boot-starter` and its existing SpringDoc configuration.
2. After the application starts, `GET /openapi-skill/skill.zip` triggers generation.
3. The Starter enumerates local `GroupedOpenApi` beans, or selects the default document when no groups exist.
4. It invokes SpringDoc's final WebMVC resources inside the same JVM. It does not inject the incomplete base `OpenAPI`
   model as the final contract and does not issue an HTTP self-request.
5. Core parses each exact OpenAPI 3.1.0 JSON document independently, renders one complete service Skill, validates it,
   and the Starter returns a deterministic ZIP with a `<skillName>/` root.
6. Generation failure fails only that request. No build output or partial archive is written.

## Node Project Workflow

1. A consuming project configures one or more services, with one or more explicit document ID/HTTP(S) URL pairs per
   service. `sourceType` distinguishes `internal` from `third-party` sources.
2. Project-, service-, and document-level keywords provide trusted discovery/navigation aliases without importing
   untrusted OpenAPI free text into `SKILL.md`.
3. The CLI downloads every configured document under one timeout and shared input budget. A failed download or invalid
   document aborts the whole project update.
4. The generator creates one self-contained Skill, named `api-docs` by default, with service trees physically included
   under `references/services/<serviceId>/references/` and connected through relative Markdown links.
   Each tree exposes compact JSONL operation/schema indexes and readable short paths for targeted retrieval.
5. The publisher validates and stages the complete tree before replacing `.agents/skills/<skillName>` atomically. It
   does not create filesystem symbolic links or publish a partial mix of old and new services.

## Current Status

- Java artifacts are prepared as `io.github.fyuanz:openapi-skill*:1.0.0` with package namespace
  `io.github.fyuanz.openapi.skill`; the new coordinates are not yet published to Maven Central.
- Node package `openapi-skill@1.0.0` is published and was verified end to end in the real Vue consumer.
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
- `openapi-skill-node` is prepared as `1.0.0`. Preferred `services` configuration
  generates one self-contained project Skill, defaults `skillName` to `api-docs`, supports internal and third-party
  services plus project/service/document keywords, and publishes the complete service set atomically. The legacy
  `serviceId` + `documents` configuration remains compatible, while new output uses `openapi-skill-core/1`.
- Node verification currently passes 29 tests across configuration, generation, semantic indexes, provenance, downloading, project-tree
  validation, project-wide document/byte budgets, atomic legacy/project migration, stale service removal, package
  metadata, and compatibility behavior. The locally packed `1.0.0` tarball was installed into
  `testbeds/vue-ts-consumer`; it builds and generated a 21-file core/1 `api-docs` project Skill from the running testbed.
- `testbeds/vue-ts-consumer` closes the consumer loop: a real Vue 3 + TypeScript project generates the Skill from the
  running SpringDoc testbed and calls all five documented operations through a dev-server proxy. An independent read-only
  audit of that Skill found it sufficient to write a correct typed client, plus three readability gaps recorded in its
  `CLOSURE-REPORT.md` and since addressed by core/1 targeted lookup and centralized OpenAPI conventions.
- Generated Skills describe themselves with a bilingual action-triggered sentence (task verbs, catalog navigation, a
  verification checklist, and generate-or-modify frontend request code) so LLM consumers can discover them by task.
- Historical releases remain available under the old `smart-doc-agent` / `smartdoc-agent-*` Maven coordinates and
  `smartdoc-agent` npm name. The new `openapi-skill` npm package starts at `1.0.0` and is published; the parent, core,
  and Starter Maven coordinates await manual publication.

## Commands

```text
mvn -B install
mvn -B -f testbeds/springdoc-multi-package/pom.xml clean verify
powershell -NoProfile -File testbeds/springdoc-multi-package/verify-generated-integration.ps1
cd openapi-skill-node && npm test
```

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

## Constraints

- Java 17, Spring Boot WebMVC 3.5.x, SpringDoc 2.8.x, and exact OpenAPI 3.1.0 JSON only.
- Core stays independent of Spring Boot, SpringDoc, Maven, HTTP, and ZIP packaging.
- Runtime collection uses `OpenApiWebMvcResource` / `MultipleOpenApiWebMvcResource`; `OpenAPI` and `GroupedOpenApi`
  beans alone are not treated as complete generated documents.
- All local groups form one atomic per-request service input. References remain document-local; no semantic merge.
- Source text is untrusted reference data and never enters the trusted Skill instruction template.
- Existing document/file/reference/size bounds remain enforced. ZIP creation is in-memory and deterministic.
- The Starter endpoint follows application security and accepts no arbitrary source URL. The Node CLI intentionally
  fetches only user-configured HTTP(S) URLs, rejects redirects, and is meant for trusted project configuration.
- Node project mode permits at most 32 services and 32 documents across the project, 32 MiB aggregate input, 10,000
  output files, and 64 MiB output. Each document retains the existing 8 MiB and document-local reference boundaries.
- Cross-service aggregation inside the Node consumer is supported; cross-service aggregation by the embedded runtime
  Starter, WebFlux, management-port variants, external references, YAML,
  Swagger 2.0, package repositories, and automatic installation remain deferred.
- No Maven build-time plugin or lifecycle compatibility path is supported under the new coordinates.

Milestone delivery follows `AGENTS.md`: test first, update affected project docs, commit the reviewable slice, and push
normally without force-overwriting remote history.
