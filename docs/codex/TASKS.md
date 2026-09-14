# Tasks

## Current Phase

Scope review completed: one or more API documents per service → one frontend Skill per service, updated after SpringDoc / NextDoc4j in an explicitly configured Maven build, with generation failures isolated from the business build and other services. Product design v3.5.0 is the implementation baseline. P0, P2, and P3 are complete. P4 is in progress: directory discovery and a representative runtime SpringDoc route are verified; each target project supplies its concrete service/module/phase mapping.

2026-09-11 delivery scope: the user selects the existing `testbeds/springdoc-multi-package` application to verify the Maven-to-Skill build. Real target POM integration and target-specific multi-module/partial-build cases are deferred. Deliver the complete generated Skill directory; the user will use it in other frontend projects. Actual P5 discovery and multi-service consumption are not acceptance gates for this delivery and must not be marked verified.

## Completed Tasks

| Task | Acceptance |
| --- | --- |
| Establish repository guidance and AI documentation | Root instructions and five core context files exist |
| Remove the project-local documentation skill | Skill, templates, and active configuration references removed; project guidance and context documents retained |
| Establish historical project baseline | Git and Maven parent exist; the earlier baseline passed with no tests before core deletions |
| Adopt OpenAPI document input | Source/bytecode scanning and UI scraping are superseded |
| Retain current input boundary | Exact OpenAPI 3.1.0 JSON; broader formats and UI compatibility deferred |
| Review current product scope | Design v3.3 distinguishes required conversion/compile updates from deferred distribution and platform work |
| Document non-blocking updates | Defines per-compile execution, fresh-input dependency, staging/replacement, warnings, and retained old output on failure |
| Include microservices and multi-document services | v3.4 defines service/document ownership, namespace isolation, complete-service replacement, and independent failures |
| Synchronize project docs | Context, structure, modules, tasks, and decisions match v3.4 scope |
| Establish implementation work plan | P0-P5 define dependencies, acceptance evidence, and target-integration gates; no implementation is marked complete |
| Select the first realistic fixture workflow | Plan a minimal multi-package Spring Boot service with explicit document groups; distinguish fixture export from compile-time integration |
| P1.3: Implement the standalone test service | Java 17 / Boot 3.5.9 / springdoc 2.8.15; four packages, two explicit groups, sample endpoints and validated frozen JSON |
| Add Swagger UI for manual inspection | UI entry, JavaScript assets and exact account/business configuration verified; 5 total tests pass |
| Establish milestone delivery workflow | AGENTS.md records verification, documentation updates, commit and normal push after each completed part of requested work |
| P0: Establish the core foundation | Root Maven tests execute; exact 3.1.0 JSON input boundary and explicit diagnostics pass |
| P2: Generate a usable per-service Skill | Two grouped snapshots generate one navigable Skill; contract, reference, isolation, navigation and limit tests pass |
| P3: Publish complete service updates safely | Staging, validation, ownership, timeout, locking, recovery, status, stale-removal and service-isolation tests pass |
| P4 static-document Maven slice | Compile goal, repeat/package/targeted/parallel entry points, warnings, retention, and normal Java failure semantics pass in a standalone reactor |
| P1.5 generated-document freshness slice | Runtime springdoc export order succeeds; failed capture cannot bless old JSON or replace the prior Skill |
| Confirm generated-input Maven contract | SpringDoc / NextDoc4j only; Maven entry point; explicit service owner/phase; scanned JSON directory; clean-scoped generated-resources output |
| Deliver the user-selected testbed Skill (2026-09-11) | Fresh runtime export and Skill publication pass; complete 19-file folder and manual frontend-copy instructions provided |

## Active Tasks

Maven Central release is complete (2026-09-11): the parent POM, core, and Maven plugin under `io.github.fyuanz:1.0.0` were signed, uploaded, and reached `PUBLISHED` on the Central Portal; all twelve pom/jar/sources/javadoc/asc artifacts return HTTP 200 on `repo1.maven.org`. See the release-completion entry below. The earlier testbed-only task remains complete.

P0, P2, and P3 are complete. The Maven goal and representative runtime SpringDoc route are implemented and verified. The requested testbed build and Skill handoff are complete; the user will try the artifact in their frontend projects. Remaining P1/P4 target-application configuration and producer/startup failure evidence are deferred, as is actual P5 consumption acceptance.

P1.3 evidence:

- Red: `mvn -B -f testbeds/springdoc-multi-package/pom.xml clean test` executed 4 tests, 4 assertion failures, 0 errors (missing group and sample endpoints returned 404).
- Green: the same service's `test` passed 4 tests, 0 failures/errors. `refresh-fixtures.ps1` repeated `clean test` successfully and saved both validated snapshots and metadata.
- Actual HTTP output: exact OpenAPI 3.1.0; account = 2 operations/3 schemas, business = 2 operations/4 schemas. Descriptions, group boundaries, parameters, requests/responses, required/minimum constraints, security, shared/recursive local refs and multipart are asserted.
- Environment: Maven 3.9.16, Azul JDK 17.0.19. Initial sandbox javac resource-close failures were setup failures, not behavioral red evidence; successful verification ran outside that sandbox.
- The later P1.4-P1.6 probes now add static multi-service Maven evidence and runtime SpringDoc `verify` evidence. The actual target deliberately owns its service/module/phase mapping; the fixture does not prove its producer/startup failure behavior.

## Work Plan

Status vocabulary: **Ready** means it can be started; **In progress** means a verified slice exists with remaining acceptance; **Pending** means listed dependencies must be met; **Needs target evidence** identifies an external-information gate; **Complete** requires recorded verification evidence.

| Stage | Deliverable | Dependencies | Status |
| --- | --- | --- | --- |
| P0 | Buildable core foundation and first tested input rule | Existing repository | Complete |
| P1 | Verified current-document and Maven integration contract | Standalone testbeds; target configuration for generated documents | Contract/testbed complete; real target application deferred |
| P2 | Usable per-service Skill from one or more documents | P0; independent of the target producer | Complete |
| P3 | Complete service updates with observable failure and preserved output | P2 | Complete |
| P4 | Real per-compilation integration, including multiple services/modules | P1 verified, P2, P3 | Static compile and testbed runtime verify paths pass; target-specific remainder deferred |
| P5 | End-to-end/frontend acceptance and minimal usage instructions | P4 | User will try the delivered Skill; discovery and multi-service acceptance deferred |

P0, P2, and P3 are complete. The selected runtime testbed scans SpringDoc output at `verify` with current-session checks. Its fresh Skill has been delivered; resume real target integration only when requested.

### P0 — Establish The Build And First Red-To-Green Slice

- P0.1: Establish a minimal core POM consistent with the Java 17 parent and correct the obsolete bytecode description. Do not implicitly restore deleted legacy IR or add a compatibility layer.
- P0.2: Add a tiny sanitized input fixture and a meaningful failing test for the retained OpenAPI root-version rule; implement only that first rule and verify green.
- P0.3: Confirm the test runner actually discovers and executes tests. A missing-POM error, test compilation error, or `No tests to run` is not the intended behavioral red/green evidence.

The user-selected first realistic integration test is the Spring Boot producer in P1.3 below. P0's small version-rule test remains the fast unit-test foundation; neither a running sample application nor exported files alone count as effective assertions.

Exit evidence: runnable `mvn test`, nonzero test count, the first behavior's observed failure followed by success, and recorded commands/results. Initial POM wiring is setup; behavioral implementation follows failing tests.

### P1 — Verify Current Documents And Compile Entry Points

- P1.1 — **Policy complete (2026-09-10)**: production JSON comes only from SpringDoc / NextDoc4j; builds use Maven; every target explicitly configures serviceId/skillName, producer directory, one owner module, and a phase after the producer. Output defaults to `target/generated-resources/smartdoc/` and is not retained across `clean`. Package/group relationships are never inferred.
- P1.2 — **Representative contracts complete (2026-09-10)**: static authoritative files are read directly; generated files can opt into `requireCurrentBuildDocuments`, which requires every document to be rewritten after the Maven session begins and stable while read. Apply and verify the choice in the target.
- P1.3 — **Complete (2026-09-09)**: The standalone fixture at `testbeds/springdoc-multi-package/` uses Java 17, Spring Boot 3.5.9 and `springdoc-openapi-starter-webmvc-ui:2.8.15`. No database, registry or gateway is required; Swagger UI supports manual inspection. This is a test service, not a production dependency. The following acceptance requirements are implemented, except the explicitly separate P1.4/P4 probe:
  - Write failing assertions for the expected groups, exact `openapi: 3.1.0`, operation membership, field descriptions, required fields, responses, and local schema references before adding the corresponding controllers/models/configuration.
  - Use packages such as `user`, `order`, `file`, and `common`; define two explicit groups, for example `account` (user) and `business` (order/file). Packages do not automatically produce separate documents.
  - Add a few representative endpoints with Spring mappings, validation, and explicit `@Operation`, `@Parameter`, `@Schema`, and response annotations where needed. Assert descriptions actually reach JSON; do not assume ordinary source comments are exported by default.
  - Include query/path parameters, a JSON request, multipart upload, multiple responses, security metadata, and shared/recursive DTOs. Keep the sample small and supplement malformed/colliding inputs with focused core fixtures.
  - Explicitly set `springdoc.api-docs.version=OPENAPI_3_1`; start only the test service on loopback during fixture export/integration tests, retrieve `/v3/api-docs/account` and `/v3/api-docs/business`, and assert both documents before accepting the set. Ensure bounded startup/capture and process cleanup on failure.
  - Freeze the passing JSON set with exact producer versions, capture command, source digests, and expected operation/schema counts for ordinary offline core tests. These snapshots now drive the completed P2 service Skill tests.
  - Official springdoc Maven export uses a running application and the integration-test phase (`mvn verify` in its example). This fixture path is not proof of `mvn compile` coverage; ordinary `mvn package` does not reach integration-test under the default lifecycle. Verify exact commands rather than call all three entry points equivalent.
  - A single multi-package application proves multi-group input, not independent microservices or multi-module reactor ordering. Add a second minimal service/multi-module probe for P1.4/P4's isolation and ordering cases, without building a full microservice platform.
- P1.4 — **Fixture evidence complete (2026-09-10)**: ordinary/repeated compile, full/service-only/parallel reactor, and package traversal are verified with two static-input service owners. The SpringDoc fixture verifies package → start → two captures → stop → directory discovery → Skill update through `mvn verify`. A service spanning a partial module build remains target-specific; independent IDE compilation is outside scope.
- P1.5 — **Representative capture failure complete (2026-09-10)**: after a successful runtime export, both springdoc requests are forced to fail while old JSON remains. Maven succeeds, SmartDoc records FAILED, emits a document-specific freshness warning, and preserves the exact previous Skill tree.
- P1.6 — **Integration decisions recorded (2026-09-10)**: target builds use SpringDoc / NextDoc4j JSON and Maven only. Each service has one explicit owner/phase after its producer. Runtime SpringDoc uses current-build checking and a goal after capture at `verify`; production startup/error policy remains a target decision.

Exit evidence: repeatable command/configuration, observed preparation/generation ordering, current-input evidence, and the stale-input failure case. Final acceptance requires target configuration or a confirmed representative equivalent. A synthetic producer proves orchestration only; it does not prove the actual springdoc integration.

If the existing producer requires application startup or a later lifecycle phase, resolve that conflict in this stage rather than silently changing the product to package-time/runtime generation. Do not add automatic business-service startup without an explicit reviewed integration decision.

Producer reference: [springdoc grouping and properties](https://springdoc.org/v2/), [springdoc Maven export workflow](https://github.com/springdoc/springdoc-openapi-maven-plugin), and [Maven lifecycle](https://maven.apache.org/guides/introduction/introduction-to-the-lifecycle.html), checked 2026-09-09. Tool versions and actual outputs still require implementation-time verification.

### P2 — Convert Documents Into A Usable Service Skill — Complete

- P2.1 complete: required document-set failures and same-named operation/Schema/security ownership are tested across documents and separate service results.
- P2.2 complete: operation JSON and Schema JSON remain semantically exact; effective path/operation parameters, servers and security cover inheritance and explicit empty overrides. Tests cover request/response media types, multipart, response headers/statuses, examples, nullable/required/readOnly/writeOnly fields, arrays, maps and composition.
- P2.3 complete: document-local shared, recursive, multi-level, inline, escaped and root pointers are navigable. Reusable parameters/request bodies/responses/headers/examples and bare Path Item aliases are covered. Dangling, external, cross-document fallback, cyclic aliases, invalid pointer escapes, dynamic/rebased references and ambiguous Path Item siblings fail explicitly.
- P2.4 complete: trusted `SKILL.md`, group-aware catalog, per-document context/operation/schema/reference files, tag navigation and source metadata are generated with stable links and filenames. Source metadata includes generator format version, service/Skill/document identity, source digests, OpenAPI/API versions and counts.
- P2.5 complete: tests cover safe lowercase identities, case-safe hashed filenames, stable paths, untrusted source-text isolation, malformed containers, nesting/input/document/reference/output-file limits, complete link resolution, deterministic immutable results and two-document snapshot output.

Exit evidence: root tests pass 39 cases. The account/business fixtures produce one 19-file Skill with 4 operations, 7 schemas, 3 tag indexes, 2 document contexts, catalog, source metadata and trusted entrypoint. The skill-creator validator reports `Skill is valid!`; an independent read-only frontend scenario navigates `SKILL.md → catalog → POST /files → UploadReceipt` and identifies the exact multipart field and response semantics without consulting source fixtures. Core verification uses fixed local files with no LLM, business API, or external-reference calls.

### P3 — Make Service Updates Complete And Failure-Safe (Complete)

- P3.1: Test first, then implement complete staging, validation, and replacement of only the generator-owned service directory. Do not clear the shared parent.
- P3.2: Verify modified/deleted interfaces and explicitly removed groups leave no stale references after success. A missing required input is a failure, not an implicit removal.
- P3.3: Cover first-run failure, failed updates with existing output, and one-of-many document failure. Preserve the entire old valid service result and record last-attempt status outside it.
- P3.4: Exercise denied writes, replacement failure, timeout, same-service write contention, and conflicting service outputs. Timed-out work cannot publish later; replacement failure must preserve/recover the old result.
- P3.5: Verify two independent services update concurrently and one service's failure cannot mutate or prevent the other's result. Keep status and temporary files isolated by service.

Exit evidence complete: targeted failure-injection tests and whole-tree comparisons prove the old service tree remains complete/unchanged on ordinary failure, deleted files/groups disappear on success, catastrophic restore failure retains a recovery backup, and unrelated service/manual outputs remain untouched. These tests do not yet prove Maven's exit behavior; P4 does.

### P4 — Integrate The Complete Update Into Compilation (In Progress)

- P4.1: **Generated-file consumption complete.** The thin plugin has no default phase, discovers top-level JSON files from one explicit directory in stable order, retains explicit file entries as a fallback, reads the discovered set inside the failure boundary, optionally enforces current-Maven-session writes, and calls P2/P3. An absent/empty directory logs SKIPPED. It does not own application startup or SpringDoc/NextDoc4j capture.
- P4.2: **Fixture matrix substantially complete.** Real builds cover full, service-only, repeated, parallel, and package entry points with one explicit owner per service and no inherited execution. Partial builds for a service spanning modules remain open.
- P4.3: **Input/output and generated-capture slices complete.** Real builds cover invalid/missing/stale documents, invalid configuration, blocked output, peer-service continuation, and exact prior-tree retention. P3 covers timeout and move-level injection. Spring Boot startup failure remains outside the running SmartDoc goal and still fails Maven.
- P4.4: **Complete.** An opt-in module with invalid Java proves the normal compiler failure remains nonzero without shell exit suppression.

| Scenario | Required observation |
| --- | --- |
| Ordinary compile, first run | Participating service produces a complete Skill |
| Repeat compile, no source change | Update still executes; content may remain identical |
| Edit API contract/code and compile | Correct fresh contract reaches the corresponding Skill |
| Delete operation/group and compile | Stale files removed on complete success |
| Full multi-module compilation | Exactly one complete update per participating service |
| Compile one service | Other service outputs unaffected; no dependency on unrelated services being online |
| Partial module compilation | Verified update entry point; incomplete required input produces a clear service warning and preserved prior output |
| Parallel compilation | Service outputs isolated, no interleaved writes or silent output collision |
| Packaging through compilation | Update occurs without a second duplicate service generation |
| One document/service generation fails | Old affected service preserved; other services and valid business compilation continue |
| Business compilation fails | Build failure remains visible |

Exit evidence: exact Maven commands, observed update invocation counts, expected output/source identities, warnings, and exit outcomes for this matrix. Unit tests alone cannot close P4. Independent IDE entry points are outside the agreed workflow.

### P5 — Validate Frontend Use And Close The MVP

- P5.1: Put generated test Skills into a consuming test project and verify discovery/routing with the actual supported agent workflow.
- P5.2: Use two service Skills together: locate same-named interfaces, explain required versus nullable fields, authentication, responses, and service/group ownership; check frontend call examples against the contract.
- P5.3: Confirm multi-package producer coverage using expected operations and record missing/unknown source facts without fabricating them.
- P5.4: Add concise verified setup/build/output/failure-diagnosis instructions, including how discovered JSON groups form one service update and what a failed update means. Document actual commands only after they work.
- P5.5: Close tasks with evidence and update current status/decisions. Keep downloads, ZIP infrastructure, installation management, and other deferred capabilities out of acceptance.

Exit evidence: P0-P4 checks pass, representative frontend tasks are recorded, and the actual producer/compile workflow has no unacknowledged coverage gaps. Remaining target-specific uncertainty prevents claiming full MVP completion.

## Plan Tracking And Estimates

- Every stage records status, dependencies, actual verification commands/results, and remaining blockers when work changes.
- Work test-first: observe a behavioral failure, implement the smallest matching behavior, verify green, then run appropriate integration checks.
- Keep source and test files below approximately 800-1000 lines by responsibility.
- Do not require target access to begin P0 or core conversion; do require it (or a confirmed equivalent) to close P1 and production integration acceptance.
- Earlier single-document effort estimates are provisional. Re-estimate the remaining work after P1 confirms producer/lifecycle feasibility; no fixed delivery date is committed by this plan.

## Deferred Work

- Deterministic ZIP packaging, full file digest/identity envelopes, independent verification CLI, immutable publishing, and package repositories.
- Read-only download service, HTTP manifests, cache headers, gateways, deployment, and public/internal distribution decisions.
- Independent CLI and separate YAML configuration platform.
- Cross-project automatic installation/update, locks, and drift handling.
- A single merged Skill for all microservices, global service version coordination, and cross-repository build scheduling.
- A full microservice test platform with database, service discovery, gateway, or custom UI. The minimal multi-package producer and bundled Swagger UI are implemented P1.3 work.
- Other OpenAPI versions, Swagger 2.0, YAML, external references, generic URL ingestion, and UI-specific behavior.
- Knowledge Bundles, search, vectors, RAG, AI enrichment, chat/SSE, TypeScript generation, additional knowledge sources, Agent plugins, and MCP.

## Blockers And Unknowns

- No real target or frontend project path is required for the user-selected testbed delivery. The following are deferred production/frontend acceptance gaps, not blockers for generating that Skill.
- Root Maven loading is repaired; no P0 blocker remains.
- The target application and its current OpenAPI production configuration are absent; the fresh-document integration cannot be verified from this repository.
- Actual target build entry points and final output destination need to be established before claiming end-to-end coverage.
- The target service/module/document mapping, application-start failure policy, and partial-build generation owner strategy are not yet available or verified.

Distribution visibility, storage, gateway deployment, and a pinned Spring Boot testbed patch are no longer blockers for the current scope.

## Known Gaps

P0, P2, and P3 are complete. P4's Maven entry point, JSON directory discovery, and representative runtime SpringDoc `verify` path are implemented and verified. Target POM application, producer/startup failure behavior, a service spanning partial modules, and P5 discovery remain open. Core still intentionally does not perform full OpenAPI schema validation or external reference access.

## Last Updated

2026-09-14.

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
