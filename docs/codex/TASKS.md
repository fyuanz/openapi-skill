# Tasks

## Current Scope

Product design v3.7.0 makes an embedded Spring Boot runtime endpoint the primary SpringDoc workflow. The application
generates and downloads a current Skill ZIP after startup, with automatic local group discovery and no SmartDoc build
executions, HTTP self-capture, or generated build directories. The user will manually review Skills; this is not a gate.

The v3.6 Maven aggregate and safe publication features remain compatible. The Node consumer adds explicit URL download
and local project installation; cross-service runtime aggregation, WebFlux and centralized artifact coordination remain
outside scope.

## Work Plan

| Stage | Deliverable | Status |
| --- | --- | --- |
| P0 | Buildable Java 17/Maven core and exact OpenAPI 3.1.0 JSON input | Complete |
| P1 | SpringDoc multi-package/group testbed and current-document contract | Complete within the accepted testbed scope |
| P2 | Contract-preserving per-service Skill generation | Complete |
| P3 | Validated complete publication, timeout, locking, recovery and isolation | Complete |
| P4 | Static multi-service and runtime SpringDoc Maven integration | Complete within the accepted testbed scope |
| P6 | Configurable individual / aggregate / both Skill outputs | Complete; unit and real Maven verification passed |
| P7 | Runtime SpringDoc discovery and deterministic Skill ZIP endpoint | Complete; starter and real HTTP testbed verification passed |
| P8 | TypeScript npm package for configured multi-URL Skill generation | Complete and committed; npm publication requires npm credentials |
| P9 | Real Vue 3 + TypeScript consumer loop against the running SpringDoc service | Complete; build plus seven live call scenarios verified |
| Release | Maven Central releases | 1.0.0, 1.1.0, and runtime Starter release 1.2.0 published 2026-09-14 |
| Documentation | Chinese-default README, English guide and v3.7 design | Updated for runtime-first integration |

## Current Implementation

- `testbeds/vue-ts-consumer` is a real Vue 3 + TypeScript + Vite consumer. It installs the packed
  `@fyuanz/smartdoc-agent` package, generates one Skill from the two live grouped endpoints of the running SpringDoc
  testbed into its own `.agents/skills/`, and calls all five documented operations through a Vite dev-server proxy.
- `smartdoc-agent-spring-boot-starter` auto-configures `GET /smartdoc/skill.zip` for Servlet/WebMVC applications.
- It derives service identity from `spring.application.name`; enabled/path/serviceId/skillName are optional overrides.
- `GroupedOpenApi` beans define the complete document set. With no groups, the default SpringDoc document is used.
- Final JSON comes from `MultipleOpenApiWebMvcResource` / `OpenApiWebMvcResource` in-process, not an HTTP self-request and
  not the incomplete base `OpenAPI` bean.
- Each request invokes existing core conversion and returns a sorted, fixed-timestamp ZIP rooted at `<skillName>/`.
  The hidden endpoint does not enter generated OpenAPI.
- The SpringDoc testbed POM now contains no Boot start/stop, springdoc Maven capture, or SmartDoc Maven goal.
- `smartdoc-agent-maven-plugin` remains compatible for static JSON and explicit `service|aggregate|both` workflows.
- `smartdoc-agent-node` provides `@fyuanz/smartdoc-agent`: a TypeScript library/CLI that downloads explicit grouped
  OpenAPI URLs, generates one core-compatible Skill, and safely replaces `.agents/skills/<skillName>` by default.
- Source is `1.3.0-SNAPSHOT` (default-semantics explanations at the point of use and a bilingual action-triggered
  description); the latest immutable Central release is `1.2.0`, including the runtime Starter. The Node package source
  is `1.3.0`, published from a packed tarball pending registry publication.

## Verified

## 2026-09-14 - Default-Semantics Readability Fixes And Bilingual Action-Triggered Description

- Trigger: the consumer-loop audit recorded three readability gaps (null `security`, absent `required`, cross-document
  same-named schemas), and the user asked to fix them, then to widen Skill discovery by upgrading the description from a
  keyword list to a bilingual action-triggered sentence (查找/解释/实现/调试 plus finding/explaining/implementing/debugging,
  catalog navigation, a verification checklist, and generate-or-modify frontend request code).
- Gap fixes, test-first: `DocumentReferences.semantics(contract)` renders a "How to read the defaults above" section at
  the end of every operation file stating that null `security`/`servers` is an unstated fact (not a no-auth claim), an
  absent `required` list is an undeclared constraint, same-named schemas stay document-local, and only an explicit empty
  value is a declared override. `SKILL.md` carries the same guidance up front. The TypeScript port mirrors both.
- Description redesign: the frontmatter description is now one bilingual action sentence built only from validated
  identities (serviceId, document IDs). Untrusted API source text (titles, tags, summaries, domain synonyms) still never
  enters the template. The aggregate Skill mirrors it with cross-service wording and a bounded member list.
- Bounds: `boundedList()` sorts IDs, joins them with `/`, and truncates past 200 characters with an explicit `…(+N)`
  marker, so the 32-document worst case keeps the description a single YAML-safe line under 1024 characters (no ASCII
  `: `, no newline).
- Version: all POMs moved to `1.3.0-SNAPSHOT` and the Node package to `1.3.0`, because generated output changed.
- Verification: red-first Java assertions (verbs, keywords, groups, YAML safety, a 32-group bound test, aggregate
  wording) then full reactor `install` — 80 tests (63 core + 15 plugin + 2 starter), zero failures. Node `npm test`
  passes 7 tests. The Vue consumer reinstalled the packed `1.3.0` tarball and regenerated its Skill: 19 files, all four
  operation files carry the semantics section, the new description is 587 characters, and the account/business SHA-256
  digests are unchanged.
- Deferred: npm publication of `@fyuanz/smartdoc-agent@1.3.0` (needs credentials) and a user-configurable description
  override for domain synonyms remain future work; a `1.3.0` Central release needs a new tag.

## 2026-09-14 - Real Vue 3 + TypeScript Consumer Loop Complete

- Purpose: close the last unverified gap. All prior testbeds verify the producer; this one verifies a real consuming
  frontend project end to end.
- Setup: `testbeds/vue-ts-consumer` (Vue 3 + TypeScript + Vite). The SpringDoc testbed was started on a fixed port
  `18080`; `@fyuanz/smartdoc-agent@1.3.0` was installed from a locally packed tarball as a dev dependency.
- Skill generation: `npm run skill:generate` downloaded both live grouped documents and published 19 files to
  `.agents/skills/springdoc-multi-package-api/`. All five operations appear in the catalog. `source.json` digests
  (account `686c1b8b…6d87`, business `ae7e7d84…290c`) match the values already recorded in this file, confirming the
  runtime export is the same data as the frozen contract snapshots.
- Frontend: `npm run build` passes `vue-tsc` strict type checking and produces a 71.74 kB bundle. Two genuine type
  errors were fixed during the build (`noUnusedParameters` on a callback, and missing `node:url` types requiring
  `@types/node`); neither was suppressed or worked around with `any`.
- Live calls, all through the Vite proxy `:15173` to `:18080`: `GET /users` with a matching and a non-matching
  `keyword` (200 with one record, 200 with `[]`); `GET /users/1` with `X-Request-Id` (200); `GET /users/999`
  (404 + `ApiError`); `POST /orders` valid (201 echoing the request) and invalid (400 + `ApiError`);
  `POST /files` multipart (200 + `{"size":5}`). Seven scenarios, all matching the generated contract.
- Independent read-only audit: the generated Skill was handed to a separate agent that could only read Skill files and
  was asked ten frontend-integration questions. It could write a correct typed client for all five operations and found
  no broken navigation link. It flagged three readability gaps, verified against source data: cross-document
  same-named schemas are not declared independent-or-shared; `security: null` is not explained at its point of use; and
  absent `required` lists are not explained as "unconstrained" versus "missing". All three are faithful OpenAPI
  exports — `first` the source documents genuinely define `Address` twice per group and carry no root-level `security`
  field — so they are documentation-clarity gaps, not data defects. Details and evidence are in
  `testbeds/vue-ts-consumer/CLOSURE-REPORT.md`.
- Recorded but not implemented: making the three OpenAPI default semantics explicit in the generated Skill. That would
  change generated output and requires a new version, a new tag, and the core test-first flow.
- Committed scope: consumer source, config, README, and closure report. `node_modules/`, `dist/`, and `.agents/` are
  gitignored, so the Skill is regenerated rather than committed.

## Verification

- Red: the new Starter integration test returned 404 before auto-configuration existed. Green: the multi-group test downloads
  two byte-identical archives and validates automatic identity/group discovery, content, and endpoint exclusion.
- Starter tests: 2 pass, covering grouped and default documents plus optional path/identity overrides.
- Full four-module `mvn -B install`: 76 tests pass (59 core + 15 Maven plugin + 2 Starter).
- `verify-generated-integration.ps1` passes in the normal local Maven environment: six SpringDoc testbed tests pass on a
  real random HTTP port; no generated OpenAPI/Skill directory or build-time start/capture/generation invocation exists.
- The first sandbox testbed attempt hit the previously recorded Windows `javac` resource-close failure before tests;
  the same command passed outside that sandbox without source changes.
- Prior Maven aggregate/static verification remains valid for the unchanged compatibility behavior.
- Node package tests: 5 pass; `npm pack --dry-run` includes the executable CLI, declarations, README and license.
- `git diff --check` passes after documentation cleanup; bilingual onboarding and v3.7 project records describe the same
  runtime-first boundary.

## Deferred Work

- Long-lived artifact caching, YAML configuration, automatic cross-project synchronization, drift management, global
  version coordination and cross-repository scheduling.
- Cross-service runtime aggregation, WebFlux, databases, service discovery, gateways, or custom UI.
- Other OpenAPI versions, Swagger 2.0, YAML, external references, unconfigured URL discovery, full specification validation.
- Search, RAG, AI enrichment, chat, generated API clients, additional knowledge sources, Agent plugins or MCP.

## Blockers

No external project path or web environment is required. Future user feedback may create a separate requested task; it does not block this delivery.

## Historical Evidence

The records below retain decisions and evidence at their original dates. Older statements that runtime ZIP/download is
deferred or that SpringDoc generation runs at Maven `verify` are superseded by P7 above.

## Last Updated

2026-09-14 (real Vue 3 consumer loop verified).

## 2026-09-14 - Node Consumer Committed And Pushed

- The `@fyuanz/smartdoc-agent` source, tests, and the accompanying documentation updates had been completed in the
  working tree but were never tracked: `smartdoc-agent-node/` was entirely untracked and eight files were modified.
  This delivery checkpoint records repository inclusion only; no product behavior changed.
- Verification before commit: `npm test` passes 5 tests and `npm pack --dry-run` lists 19 files including `dist`,
  README, and LICENSE. `.gitignore` gained `**/node_modules/`, `smartdoc-agent-node/dist/`, and
  `smartdoc-agent-node/*.tgz`, so no dependency or build output was committed.
- `git add -A --dry-run` was checked first: 23 files, all source/documentation, no generated artifacts. `git diff
  --cached --check` passed before commit `49f09d7` (23 files, 873 insertions, 12 deletions), pushed as
  `0c662dc..49f09d7` on `main`.
- Tags `v1.1.0` and `v1.2.0` still identify their release sources and were not moved; the Node consumer is later
  source than `1.2.0`.
- npm publication of `1.3.0` remains a separate credentialed action and is still outstanding.

## 2026-09-14 - Maven Central 1.2.0 Release Completed

- The user confirmed the updated READMEs and explicitly authorized publication. Root, core, Maven plugin, and the new
  Spring Boot Starter were changed from `1.2.0-SNAPSHOT` to immutable `1.2.0`; standalone testbeds remain unpublished.
- Formal-coordinate `mvn -B install` passed 76 tests. A clean `central-release` install attached sources and Javadocs;
  all 13 POM/JAR signatures independently verified as Good signatures from `fyuan <624728873@qq.com>` with fingerprint
  `B8EDC9D7B1AEBDCA56A1DA28FD9316D8966A3116`.
- The runtime verifier passed six tests on a real random HTTP port and confirmed no build-time application start,
  OpenAPI capture, SmartDoc Maven goal, or generated OpenAPI/Skill directory. The Maven aggregate matrix also passed
  parallel ordering, all output modes, repeat generation, failure isolation, and recovery.
- Central deployment `5e3eba4c-1cc5-4feb-b720-93694413d290` reached `PUBLISHED`. Representative parent, core, Maven
  plugin, and runtime Starter artifacts each returned HTTP 200 from `repo1.maven.org`.
- Chinese, English, Starter, testbed, design, module/context, and Central documentation use `1.2.0`. Tag `v1.2.0`
  identifies the release source; later changes require a new version and tag.

## 2026-09-14 - Runtime Skill ZIP Replaces Build-Time SpringDoc Capture

- Added `smartdoc-agent-spring-boot-starter` and moved development coordinates to `1.2.0-SNAPSHOT`; no Central release
  was requested. The Starter is discovered through Boot `AutoConfiguration.imports`.
- Added `GET /smartdoc/skill.zip`, automatic service/Skill identity defaults, optional path/identity overrides, local
  `GroupedOpenApi` discovery, default-document fallback, direct in-process SpringDoc resource calls, and deterministic
  in-memory ZIP creation. The endpoint is hidden from OpenAPI.
- Did not use direct `OpenAPI` injection as the final contract: that bean may lack scanned paths. Did not add HTTP
  self-requests or arbitrary URL configuration.
- Red-to-green evidence: initial runtime test returned 404; implementation then passed the grouped test. A default-document
  test was added for the other discovery branch and optional overrides.
- Migrated `springdoc-multi-package`: removed Spring Boot lifecycle start/stop, springdoc Maven plugin and SmartDoc Maven
  plugin. A random-port HTTP test downloads the ZIP and verifies both groups and business operations.
- The integration verifier confirms six tests, no build-time generated directories, and no removed goal in the build log.
  Its sandbox run hit the known `javac` resource-close issue; an approved normal-environment rerun passed.
- Updated v3.7 design, bilingual onboarding, testbed guide, module/context/structure records, and compatibility boundaries.
- The existing Maven plugin and aggregate behavior remain source-compatible; they are no longer recommended for a
  SpringDoc application's own runtime Skill download.

## 2026-09-14 - Maven Central 1.1.0 Release Completed

- User-authorized release of the v3.6 aggregate feature. Root/core/plugin and both testbed plugin references were bumped from `1.1.0-SNAPSHOT` to `1.1.0`; the testbeds' own `1.0.0-SNAPSHOT` module coordinates are unchanged because they are not published.
- Plain root `mvn -B install`: BUILD SUCCESS, 74 tests (59 core, 15 plugin) with the release coordinates. Signed `-Pcentral-release -Clean install` rebuilt everything, attached sources/Javadoc and produced nine PGP signatures with key `fyuan <624728873@qq.com>`; all nine `.asc` files independently verify as Good signature.
- Regression on the released coordinates: `verify-aggregate.ps1` reports PASS for parallel reactor order, all three output modes, repeat execution, member-failure isolation and recovery; final `both/` statuses for orders/billing/platform are SUCCESS. The SpringDoc testbed `clean verify` on dynamic loopback ports completed app start → account/business capture → stop → `smartdoc-agent:1.1.0:generate-skill` SUCCESS (19-file Skill); its status is SUCCESS.
- Signed `deploy -Clean` uploaded the bundle; Central Portal deploymentId `6f9cffda-6cd3-4236-857a-fc5c8a77d961` with `autoPublish` reached successfully published. Origin `repo.maven.apache.org` serves all 18 artifacts (parent pom+.asc; per module pom/jar/sources/javadoc plus four .asc each). The four auxiliary jars downloaded from `repo1.maven.org` match the locally signed artifacts by SHA-256; repo1 Cloudflare edges propagated directories unevenly at first and were confirmed converging to HTTP 200 after the short propagation window. The Central search index lags independently.
- Release engineering note: launching the project-external `invoke-release.ps1` through a nested `powershell -NoProfile -File` failed GPG key export (`Bad passphrase`) because that host's stdin pipe is rejected by the Git GnuPG agent; exporting inline from the console host succeeds. A same-machine companion `invoke-release-110.ps1` (outside Git) was used by dot-sourcing/calling it directly in the console host. No credential material entered the repository; temp diagnostics were deleted.
- Bilingual READMEs, plugin/testbed READMEs, `docs/maven-central.md`, TASKS/CONTEXT/MODULES and POMs were updated to 1.1.0. Git tag `v1.1.0` identifies the release source. Central releases are immutable; later changes need a new version and tag.

## 2026-09-14 - Bilingual Repository README Complete

- Added the default Chinese `README.md` and equivalent English `README.en.md`, with reciprocal language-switch links.
- Documented released coordinates, requirements, quick start, producer-before-plugin ordering, all user-facing plugin parameters, explicit required documents, manual frontend handoff, status diagnostics, development checks, and project links.
- Checked examples against the current POMs and Mojo. Both guides distinguish runtime `verify` from ordinary `compile`/`package`, Maven success from Skill success, and fixture evidence from deferred target/frontend acceptance.
- Documentation verification: relative links resolve, fenced XML examples parse, code/configuration examples match across languages, and `git diff --check` passes. No Java behavior changed; Maven tests were not rerun for this documentation-only task. Product stage statuses remain unchanged.

## 2026-09-09 - Swagger UI Follow-up Completed

- User-requested Swagger UI is available at `http://127.0.0.1:18080/swagger-ui.html` with account/business selection.
- Red: the new UI HTTP test failed on 404. Green: explicit fixture refresh ran clean test, 5 tests passed, 0 failures/errors; UI assets/configuration and original OpenAPI contracts are verified.
- JSON snapshot digests are unchanged; source metadata and README are refreshed. P0 and production integration status are unchanged.

## 2026-09-09 - P0 Complete

- Root mvn -B test red: 19 tests, 18 assertion failures, 1 placeholder error.
- Green after minimal validation: 19 tests, 0 failures/errors.
- Exact textual 3.1.0 only; distinct MISSING_VERSION, UNSUPPORTED_VERSION and INVALID_JSON. Invalid roots, duplicate keys and trailing JSON are rejected.
- New core POM and corrected parent description; no legacy IR. P2 is authorized next, independently of compilation integration.


## 2026-09-09 - P2 First Snapshot Skill Delivered (Intermediate Checkpoint)

- Test-first evidence: 5 new generator tests failed (2 assertions, 3 placeholder errors), with all 19 P0 tests still passing. Implementation then passed all 24. Two additional cases brought the total to 26; the missing catalog entry for unreferenced schemas failed before the fix. Final root `mvn -B test`: 26 passed, 0 failures/errors.
- Uses existing account/business bytes without starting the service. One Skill contains 4 operation files, 7 schema files, 2 document contexts, a catalog, source metadata and trusted SKILL.md (16 files).
- Tests compare complete operation/schema JSON, assert overrides, document/service identity, recursive/shared/multi-level and escaped local pointers, dangling/external reference failures, unsafe identities, case-safe filenames, input/schema-file bounds and link targets. Source text is excluded from SKILL.md; JSON code-fence escaping preserves data.
- Review artifact: `smartdoc-agent-core/target/smartdoc/springdoc-multi-package-api/`; root `mvn test` recreates it through a fixture test. Generated target files are not committed or installed.
- At this checkpoint P2 remained in progress. The completion record below supersedes the listed content/reference/limit gaps.
- No P3 or P4 started. Source freshness, safe publication, ordinary/repeated compile integration and actual consuming-agent acceptance remain unverified.
- P0 commit e623fa9 and the first P2 slice commit 4d14e52 were pushed to `origin/main`.
- Skill frontmatter and entrypoint were manually inspected. The initial skill-creator validation dependency attempt did not complete; final P2 validation below succeeded with a temporary target-local PyYAML installation.

## 2026-09-09 - P2 Complete

- Red-to-green continuation: 4 reference/navigation tests initially produced 2 failures and 2 errors; after Path Item, tag and source-data handling they passed. Two root/example-reference tests then errored before local-root and Example Object handling were added. The final contract suite exposed a null document identity as an unclassified `NullPointerException`; validation now reports `IDENTITY`.
- Final `mvn -B clean test`: 39 tests, 0 failures/errors. The output-file bound test builds two 5000-Schema documents and confirms the complete result is refused; other tests cover document/input/reference and nesting limits.
- The account/business snapshots produce 19 generated files: 4 operations, 7 schemas, 3 tag indexes, 2 contexts, `catalog.md`, `source.json` and trusted `SKILL.md`.
- `quick_validate.py` reports `Skill is valid!` using a temporary dependency under ignored Maven target output.
- Independent read-only forward use found the file-upload API, multipart `file` field, 200 response and optional int64 `size` through generated navigation alone. It correctly treated authentication as unknown for that operation and reported missing non-200 responses and production server facts rather than inventing them. This validates P2 content usability only; actual installation/discovery remains P5.
- P3 was the next stage at this checkpoint and is completed below. Source freshness, ordinary/repeated compile integration, independent service build isolation and actual consuming-project discovery remain unverified.

## 2026-09-09 - P3 Complete

- Behavioral red: the first updater tests ran with all 39 earlier tests green and produced 10 expected updater failures/errors. A later recovery-injection test exposed deletion of the only complete backup when both publication and restoration failed; it failed before cleanup was corrected.
- Green: final root `mvn -B clean test` runs 54 tests with 0 failures/errors. Fifteen P3 tests cover first and replacement success, complete group/operation stale-file removal, missing required input, invalid generated trees, manual/foreign output collision, generation/write/status/publish/recovery failures, timeout with a task that ignores interruption, same-output locking, conflicting service ownership, and independent concurrent service success/failure.
- `ServiceSkillUpdater` publishes only after in-memory and staged validation. It locks by final Skill output, moves a valid prior tree to a unique backup, restores it on publication failure, and retains the complete backup if restoration itself cannot finish. It never clears the shared parent.
- Last-attempt status is atomically replaced under `.smartdoc/status/<serviceId>.json`; locks, staging attempts, and backups remain outside the Skill. Status failure is observable and does not roll back a successfully validated Skill.
- P3 proves the reusable filesystem update boundary only. It does not prove document freshness, Maven lifecycle placement, plugin warning/exit behavior, multi-module generation ownership, final output placement, or consuming-project discovery; those remain P1/P4/P5 gates.

## 2026-09-10 - P4 Static-Document Maven Integration Slice Complete

- Red: three `GenerateSkillMojoTest` cases initially produced two failures and one error with the 54 core tests still green. The empty Mojo did not publish, warn, or preserve an existing tree because it performed no work. The implementation then passed all 57 root tests.
- At this checkpoint `smartdoc-agent-maven-plugin` entered the root reactor with a thread-safe `generate-skill` goal defaulting to `compile`; the later generated-directory decision removes that default and requires an explicit target phase.
- The standalone `testbeds/maven-plugin-integration/verify.ps1` ran successfully with Maven 3.9.16 and JDK 17.0.19. It installs the current snapshot, then verifies clean/ordinary/repeated compile, package traversal, targeted service compile, `-T 2` parallel services, one update per participating service, changed/deleted operation replacement, invalid/missing input with exact old-tree retention, first-run failure, invalid configuration, blocked output, peer-service continuation, and an intentional nonzero Java compilation failure.
- Testbed inputs under `src/main/openapi` are authoritative static JSON. Reading them on each invocation establishes currency for that input model. This does not establish freshness for the runtime springdoc producer: target integration must provide a positive preparation-success signal in the same build and prove its order before P1/P4 can be closed.
- Maven Plugin API 3.9.9 and Plugin Tools 3.15.2 follow the current official Java plugin guide checked 2026-09-10: [plugin development](https://maven.apache.org/guides/plugin/guide-java-plugin-development.html), [Plugin Tools 3.15.2](https://maven.apache.org/plugin-tools/maven-plugin-plugin/summary.html).

## 2026-09-10 - Runtime Springdoc Freshness Slice Complete

- Red: two new Mojo tests initially failed at test compilation because current-build configuration/session support did not exist. After implementation, all 59 root tests pass. A separate generated-integration verifier initially failed because no runtime Maven export or Skill existed.
- `requireCurrentBuildDocuments` is opt-in. It compares every configured document's last-modified instant with the current Maven session start and checks size/time stability around the byte read. Static authoritative documents retain the default behavior.
- The standalone Spring Boot fixture now uses springdoc Maven Plugin 1.5. A dynamically ported `clean verify` proves package → application start → account/business capture → application stop → one SmartDoc update, with five service tests still passing.
- The verifier then redirects both springdoc captures to a closed port without cleaning old output. Springdoc logs both connection failures but keeps Maven successful; SmartDoc rejects the old account document, records FAILED, warns with service/document context, and preserves the exact prior Skill digest and both old document timestamps.
- This validates runtime capture failure and stale-file detection at `verify`, not runtime generation during ordinary `compile`. Spring Boot `start` failure still fails Maven before SmartDoc runs, as observed when the fixed test port was occupied; production adoption requires an explicit target decision for that failure boundary.
- Sources checked 2026-09-10: [springdoc Maven plugin](https://github.com/springdoc/springdoc-openapi-maven-plugin), [Maven lifecycle](https://maven.apache.org/guides/introduction/introduction-to-the-lifecycle.html), [Spring Boot Maven integration tests](https://docs.spring.io/spring-boot/maven-plugin/integration-tests.html), and [Maven build timestamp/session start](https://maven.apache.org/guides/introduction/introduction-to-the-pom.html).

## 2026-09-10 - Generated JSON Directory Discovery Complete

- The accepted production boundary is SpringDoc / NextDoc4j JSON through Maven. Each target explicitly configures its service identity, owner module, producer directory, and phase after the producer; SmartDoc never guesses package/module/service relationships.
- Red: the generated-resources default assertion failed against the former plugin descriptor. The directory discovery and empty-directory tests then failed at test compilation before `documentsDirectory` existed. A descriptor assertion also failed while the goal still carried the old default `compile` phase.
- Green: root `mvn -B clean test` passes 62 tests. Eight Mojo tests now cover default output, explicit multi-document input, directory discovery/order/filtering, empty-directory SKIPPED behavior, invalid/missing input, current-build rejection, and rewritten-current acceptance.
- The SpringDoc testbed now configures one `documentsDirectory` instead of naming account/business files. Its real generated integration verifier passes both successful discovery and stale-file rejection after failed capture. The static multi-service Maven matrix also passes with the new `target/generated-resources/smartdoc` output root.
- Directory mode scans regular top-level `.json` files and uses safe lowercase filename stems as document IDs. Present files define the current set; an absent/empty directory produces no Skill. Explicit document entries remain mutually exclusive fallback configuration for fixed required paths/IDs.
- Default Skill output is `${project.build.directory}/generated-resources/smartdoc/<skillName>/`, so Maven `clean` removes it. Fixture source metadata was refreshed after the POM change; account/business JSON bytes remain unchanged.

## 2026-09-11 - Testbed Build And Skill Handoff Complete

- The user explicitly chooses the existing SpringDoc testbed, defers target-specific cases, and will use the generated Skill in their own frontend projects. Existing POM configuration already satisfies this selected build; no generator or POM changes were needed.
- `mvn -B install`: 62 tests passed, zero failures/errors. The testbed's initial sandbox build stopped at javac with the previously recorded resource-close error, before startup/export. Reinstalling the already tested plugin in the normal local Maven environment (`mvn -B -DskipTests install`) and rerunning the testbed resolved the environment issue without changing source or disabling testbed checks.
- Successful command: `mvn -B -f testbeds/springdoc-multi-package/pom.xml clean -Dsmartdoc.application.port=55815 -Dsmartdoc.springdoc.port=55815 -Dsmartdoc.jmx.port=55816 verify`. Both ports were selected dynamically. Five testbed tests passed; build and final SmartDoc status are SUCCESS.
- Build log order checked: application start → account capture → business capture → application stop → exactly one Skill update. Both generated JSON files precede the update attempt and their SHA-256 values match the Skill's source metadata. The started application process is no longer running.
- Delivered directory: `testbeds/springdoc-multi-package/target/generated-resources/smartdoc/springdoc-multi-package-api/`. It contains 19 files, account/business groups, four operations, seven document-local schemas, and 31 verified local Markdown links. Input hashes: account `686c1b8b9d3cddbda2e1aac5186640e0532c24a179ca0baa9d553e4649326d87`; business `ae7e7d844839c0fc2604714c5f9fa147b609a864d53740f797145f2ad74c290c`.
- The testbed README now documents a successful build, checking Skill status independently of Maven exit status, copying the complete folder into `.agents/skills/`, and a frontend prompt. Build artifacts/logs remain ignored; only documentation is committed. The successful local log is `target/testbed-skill-verified.log`.
- This completes the current requested delivery. Real target integration and P5 discovery/multi-service frontend acceptance remain deferred, not passed. No frontend project was modified and no additional product stage was started.

## 2026-09-11 - Maven Central Release Preparation

- Migrated root/core/plugin coordinates to `io.github.fyuanz:...:1.0.0`; synchronized both testbeds' plugin references. Added MIT license, developer/SCM metadata, source/Javadoc attachments, signatures, and an opt-in Central publishing profile. No business Java behavior changed.
- Signed local `-Pcentral-release install` passes all 62 tests. Both binary/source JAR pairs include MIT; Javadoc JARs contain generated documentation. Maven descriptor and core dependency use the new release coordinates; all nine PGP signatures verify. Javadoc reports missing-comment warnings but successfully generates both archives.
- The initial missing-coordinate probe could not resolve the new plugin before installation. After migration/install, the SpringDoc testbed's `clean verify` passes five tests and generates a SUCCESS Skill via `smartdoc-agent:1.0.0`; both account/business frozen contracts are unchanged. Only producer POM metadata is refreshed.
- `mvn -B -f testbeds/maven-plugin-integration/pom.xml -T 2 clean compile` succeeds for both service owners with the new plugin. When invoked from the repository root, this static fixture's configured output is the root `target/generated-resources/smartdoc/`; both status files were checked there.
- Signing key created and public key distributed. Private credentials are outside Git. Local signing required accounting for the Git GnuPG stdin CRLF convention; the helper handles it and all resulting signatures were independently verified. This is publishing-environment setup, not a product behavior change.
- Upload/public availability is pending at this checkpoint. Reference: `docs/maven-central.md`.

## 2026-09-11 - Maven Central Release Completed

- Release coordinates `io.github.fyuanz` version `1.0.0`, MIT. Published the root reactor only: parent POM `smart-doc-agent`, `smartdoc-agent-core`, and `smartdoc-agent-maven-plugin`.
- Signed install verification: `invoke-release.ps1 -Phase install -Clean` ran all 62 tests with 0 failures/errors and produced all nine PGP signatures with the BC signer.
- Upload and auto-publish: `invoke-release.ps1 -Phase deploy -Clean` uploaded the bundle; Central Portal returned deploymentId `a73c8db4-c37d-43e8-b288-05de5ea74500` with `autoPublish` enabled. The local `waitUntil=published` poll tracked `PENDING → PUBLISHING → PUBLISHED`; the deployment reached `PUBLISHED` (errors/warnings empty) after a short propagation window, and the background deploy task exited 0.
- Public availability: all twelve key artifacts on `https://repo1.maven.org/maven2/io/github/fyuanz/...` return HTTP 200 — parent `smart-doc-agent-1.0.0.pom(+.asc)`, core `pom/jar/sources/javadoc(+.asc)`, and plugin `pom/jar/sources/javadoc(+.asc)`.
- Published purls: `pkg:maven/io.github.fyuanz/smart-doc-agent@1.0.0`, `pkg:maven/io.github.fyuanz/smartdoc-agent-core@1.0.0`, `pkg:maven/io.github.fyuanz/smartdoc-agent-maven-plugin@1.0.0`.
- Central releases are immutable; subsequent changes require a new version and a matching Git tag. Credentials and the local release helper remain outside the project; private signing material was not committed.
