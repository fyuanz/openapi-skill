# Project Context

## Purpose

SmartDoc-Agent converts API documentation into a Skill for frontend development. Every configured compilation must trigger a Skill update, and Skill generation failure must not interrupt the business build. All other product work is deferred.

The current source of truth is `docs/smartdoc-agent-design.md`, version 3.5.0. Microservices, multiple Java packages/modules, and multiple OpenAPI documents per service remain product scenarios. For the 2026-09-11 delivery, the user selects the existing SpringDoc testbed, defers target-specific integration, and will try the generated Skill in their own frontend projects. The previous compiler-plus-download-service scope remains superseded.

## Target Users

- Frontend developers using an API Skill with their coding agent.
- Backend maintainers connecting API documentation and Skill generation to their compilation workflow.

## Core Workflow

1. During each configured Maven build, let SpringDoc / NextDoc4j prepare OpenAPI JSON, discover the files in the configured directory, and freeze the complete input set for this update.
2. Parse each OpenAPI 3.1.0 JSON document independently and resolve its local references within that document.
3. Render trusted Skill instructions, a compact catalog, operations, shared schemas, and optional tag navigation.
4. Validate a complete staged service Skill and replace only that service's generator-owned output directory.
5. On failure or timeout, warn, retain the previous complete Skill if available, and let the business compilation continue with its own normal success/failure semantics.

## Current Status

- Public onboarding is documented in the Chinese-default `README.md` and equivalent `README.en.md`, with reciprocal language links, Maven examples, manual frontend handoff, and explicit verification limits.
- Maven Central publication is complete: `io.github.fyuanz:1.0.0` (parent POM, core, Maven plugin) is signed, uploaded, and `PUBLISHED` on the Central Portal; all twelve pom/jar/sources/javadoc/asc artifacts are publicly reachable on `repo1.maven.org` (checked 2026-09-11). Java packages remain `com.smartdoc.agent`. The opt-in `central-release` profile creates source/Javadoc JARs, signs with the BC signer, and publishes through Central Portal. See `docs/maven-central.md`; publication status is tracked in TASKS.md.
- Product scope v3.5 is the implementation baseline. Production providers are restricted to SpringDoc / NextDoc4j, builds use Maven, and each target POM explicitly owns its service/module/phase mapping.
- P0, P2, and P3 are complete. P4 has two verified input models; remaining target-specific gates are deferred by the user. The current delivery is a freshly built testbed Skill for manual frontend use; actual P5 discovery and multi-service consumption remain unverified.
- The Java 17 Maven parent exists and references `smartdoc-agent-core` plus `smartdoc-agent-maven-plugin`.
- A new core POM and OpenApiInput validator pass 19 tests. Deleted legacy IR remains removed.
- Root Maven project loading and test discovery work; 62 tests pass (19 input, 20 content-generation, 15 safe-publication, and 8 Maven-goal tests).
- `smartdoc-agent-maven-plugin` implements the `generate-skill` goal without a default phase, forcing each target POM to place it after its producer. It can discover top-level JSON files from one explicitly configured directory or use explicit document entries, optionally requires every document to have been rewritten during the current Maven session, calls the P2/P3 core boundary, and reports service-specific warnings without throwing a build failure for Skill update errors.
- A standalone two-service reactor verifies ordinary, repeated, targeted, parallel, and package-through-compile execution for authoritative static JSON, including input/configuration/write failures and preservation of Java compilation failures.
- The target contract is fixed: SpringDoc / NextDoc4j produces JSON, SmartDoc runs afterward in the configured Maven module/phase, and output defaults to `target/generated-resources/smartdoc/` with no retention across `clean`.
- The realistic fixture at `testbeds/springdoc-multi-package/` now also verifies a runtime export chain: package, application start, two springdoc Maven Plugin 1.5 captures, application stop, then Skill update at `verify`. A failed capture leaves old JSON in place but is rejected by the current-build check while the old Skill is retained. Application-start failure still belongs to the Spring Boot plugin and fails Maven.
- On 2026-09-11, the user-selected testbed completed a fresh `clean verify` and published `testbeds/springdoc-multi-package/target/generated-resources/smartdoc/springdoc-multi-package-api/`: 19 files, two groups, four operations and seven document-local schemas. All 31 local links and both input digests were checked; the final update status is SUCCESS. The testbed README documents rebuilding and manually copying the complete folder into a frontend project's `.agents/skills/`.

## Commands

Standalone testbed (independent of the root reactor):

```text
mvn -f testbeds/springdoc-multi-package/pom.xml test
mvn -f testbeds/springdoc-multi-package/pom.xml spring-boot:run
powershell -NoProfile -File testbeds/springdoc-multi-package/refresh-fixtures.ps1
powershell -NoProfile -File testbeds/springdoc-multi-package/verify-generated-integration.ps1
```

Tests start the testbed on a random loopback port and close it afterward. Manual startup uses `127.0.0.1:18080`; see the testbed README. Only explicit refresh replaces frozen fixture files.

Root Maven entry points (test verified):

```text
mvn compile
mvn test
```

The fixture-generation test writes a reviewable Skill to `smartdoc-agent-core/target/smartdoc/springdoc-multi-package-api/`. This test export is not a compile hook. Core callers use `new SkillGenerator().generate(serviceId, skillName, Map<String, byte[]>)` to obtain a complete immutable map of relative paths to UTF-8 content. All discovered map entries form one atomic update; “documents” means JSON files/groups, not a separate list of required API facts. `ServiceSkillUpdater.update(...)` runs bounded generation, validates the in-memory and staged trees, locks one output, and publishes or restores one complete generator-owned Skill. It returns an observable result and writes last-attempt status under the output parent's `.smartdoc/status/` directory.

The static-input testbed covers ordinary and repeated compilation without requiring `clean`, plus packaging that traverses compilation. The SpringDoc verifier covers the later `verify` entry point, directory discovery, and current-session freshness for one representative runtime producer. Target POMs must still select their actual owner module/phase and producer failure policy; independent IDE compilation is outside scope.

Maven plugin lifecycle integration testbed:

```text
powershell -NoProfile -File testbeds/maven-plugin-integration/verify.ps1
```

The verifier installs the current plugin snapshot and exercises real Maven processes. It is intentionally separate from root unit tests.

The former `smartdoc skill build`, `smartdoc skill verify`, and `smartdoc serve` commands are deferred; they do not exist.

## Constraints

- Retain Java 17/Maven and the current OpenAPI 3.1.0 JSON input scope; no format compatibility expansion.
- A frozen fixture is sufficient for core tests, but repeated conversion of an old generated snapshot does not prove synchronization with current source code.
- Input preparation, freshness failure, generation, output replacement, and timeout must be included in the Skill failure boundary.
- Core consumes fixed local document bytes without LLM calls, business API calls, external-reference access, framework scanning, or UI parsing.
- Production documents come only from SpringDoc / NextDoc4j. The automated startup in the standalone testbed is representative evidence; each target must explicitly place its producer before SmartDoc and must not treat a deployed old instance as current build output.
- Preserve existing contract facts and local multi-level/shared/recursive references; report unsupported or dangling references explicitly.
- API free text is untrusted reference material and must not enter the trusted `SKILL.md` instruction template.
- Use bounded processing, safe stable filenames, complete staging, and replacement that preserves the old valid result on failure.
- Every compile attempts an update even when API content is unchanged. Identical content may remain identical.
- Minimal source metadata and update status are needed; package IDs, payload digest inventories, deterministic ZIPs, downloads, CLI, and installation management are deferred.
- Default output is `target/generated-resources/smartdoc/<skillName>/`; `clean` removes prior build artifacts by design.
- Automatic generation-side updates do not imply cross-project installation or distribution.
- One service produces one Skill; each service accepts one or more explicitly identified OpenAPI documents. Multiple services update independently, including in separate repositories.
- Java packages, Maven modules, document groups, and services are distinct concepts. Existing document producers own package scanning; a service has one designated generation entry point with verified document readiness.
- Namespace operations, schemas, security schemes, links, and metadata by service/document identity. Do not overwrite or semantically merge same-named items across documents.
- Directory mode discovers regular top-level `*.json` files in stable filename order; a missing/empty directory is logged as SKIPPED. The discovered files define the current service set and are validated together; absent JSON groups/content are not generated. Explicit document entries remain available when a fixed set must be required. Invalid, stale, or changing discovered files fail that update.
- Isolate output, staging, locking, and status by service. Partial compilation must report unavailable service documents rather than silently skipping or publishing mixed old/new inputs.
- Full, single-service, repeated no-change, package-through-compile, and parallel Maven entry points are verified for independent services. Runtime SpringDoc export is verified at `verify`, including directory discovery and stale-file rejection after capture failure. A service spanning partially built modules and the chosen producer/startup failure policy remain target-specific. Global cross-service Skill aggregation and release coordination are deferred.

The testbed also provides Swagger UI at `http://127.0.0.1:18080/swagger-ui.html`, with account/business group selection for manual API inspection.

Milestone delivery follows AGENTS.md: verify each completed part of requested work, update documentation, commit, and push to the configured GitHub remote. This does not automatically begin the next product stage.

