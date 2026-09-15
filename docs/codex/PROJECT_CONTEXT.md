# Project Context

## Purpose

SmartDoc-Agent converts OpenAPI contracts into Codex Skills. A running Spring Boot WebMVC service can expose a directly
downloadable Skill ZIP, while the TypeScript npm consumer downloads explicitly configured OpenAPI endpoints and installs
one complete Skill into a Vue 3 or other Node.js project.

The source of truth is `docs/smartdoc-agent-design.md`. Core conversion, the published Maven compatibility plugin, and
aggregate generation remain available. Web/frontend acceptance is user-reviewed and is not a delivery gate.

## Primary Workflow

1. A Spring Boot application includes `smartdoc-agent-spring-boot-starter` and its existing SpringDoc configuration.
2. After the application starts, `GET /smartdoc/skill.zip` triggers generation.
3. The Starter enumerates local `GroupedOpenApi` beans, or selects the default document when no groups exist.
4. It invokes SpringDoc's final WebMVC resources inside the same JVM. It does not inject the incomplete base `OpenAPI`
   model as the final contract and does not issue an HTTP self-request.
5. Core parses each exact OpenAPI 3.1.0 JSON document independently, renders one complete service Skill, validates it,
   and the Starter returns a deterministic ZIP with a `<skillName>/` root.
6. Generation failure fails only that request. No build output or partial archive is written.

## Current Status

- Source is `1.3.0-SNAPSHOT` (default-semantics explanations and a bilingual action-triggered description); the latest
  Central release is `1.2.0`, containing the parent, core, Maven plugin, and runtime Spring Boot Starter.
- `smartdoc-agent-spring-boot-starter` provides Boot auto-configuration for Servlet/WebMVC and SpringDoc 2.8.x.
- Default path is `/smartdoc/skill.zip`. `serviceId` derives from `spring.application.name`; Skill name defaults to
  `<serviceId>-api`. Enabled/path/identities are optional overrides.
- Multi-group and default-document runtime tests pass. The ZIP is deterministic across repeated requests and excludes
  the hidden SmartDoc endpoint from the generated contract.
- The SpringDoc testbed now has no Boot start/stop Maven executions, SpringDoc Maven capture, SmartDoc Maven goal,
  generated OpenAPI directory, or generated Skill directory. Its six tests validate Swagger UI, two OpenAPI groups,
  sample APIs, and a real random-port ZIP download.
- Core retains 63 tests; Maven plugin retains 15 tests; the Starter retains 2 (80 across the reactor). The latter
  remains a compatibility path for authoritative static JSON and explicit cross-service `aggregate` / `both` generation.
- `smartdoc-agent-node` is the unscoped `smartdoc-agent` TypeScript package and CLI for atomic multi-URL generation. It
  defaults to the consuming project root's `.agents/skills`, supports an explicit output parent, and ships a Chinese
  default README plus a reciprocally linked English guide.
- `testbeds/vue-ts-consumer` closes the consumer loop: a real Vue 3 + TypeScript project generates the Skill from the
  running SpringDoc testbed and calls all five documented operations through a dev-server proxy. An independent read-only
  audit of that Skill found it sufficient to write a correct typed client, plus three readability gaps recorded in its
  `CLOSURE-REPORT.md` and since fixed in `1.3.0-SNAPSHOT` by stating OpenAPI default semantics at the point of use.
- Generated Skills describe themselves with a bilingual action-triggered sentence (task verbs, catalog navigation, a
  verification checklist, and generate-or-modify frontend request code) so LLM consumers can discover them by task.
- Published releases: `1.0.0` on 2026-09-11, `1.1.0` and `1.2.0` on 2026-09-14.

## Commands

```text
mvn -B install
mvn -B -f testbeds/springdoc-multi-package/pom.xml clean verify
powershell -NoProfile -File testbeds/springdoc-multi-package/verify-generated-integration.ps1
cd smartdoc-agent-node && npm test
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
GET http://127.0.0.1:18080/smartdoc/skill.zip
```

Legacy Maven compatibility verification remains under `testbeds/maven-plugin-integration/`.

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
- Cross-service runtime aggregation, WebFlux, management-port variants, external references, YAML,
  Swagger 2.0, package repositories, and automatic installation remain deferred.
- Maven compatibility code is retained but is no longer the recommended SpringDoc runtime workflow.

Milestone delivery follows `AGENTS.md`: test first, update affected project docs, commit the reviewable slice, and push
normally without force-overwriting remote history.
