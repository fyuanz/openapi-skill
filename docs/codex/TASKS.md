# Tasks

## Current Scope

The 2026-09-14 user decision removes web/frontend environment validation and real-target deployment/integration acceptance from the work plan. The existing testbeds are the accepted generation evidence. The user will manually review generated Skills and provide feedback; that feedback is not a pending acceptance gate or a scheduled task.

Product design v3.6.0 adds configurable coexistence of a complete aggregate Skill and individual microservice Skills. Cross-project installation, web environments, global release scheduling, and distribution remain outside scope.

## Work Plan

| Stage | Deliverable | Status |
| --- | --- | --- |
| P0 | Buildable Java 17/Maven core and exact OpenAPI 3.1.0 JSON input | Complete |
| P1 | SpringDoc multi-package/group testbed and current-document contract | Complete within the accepted testbed scope |
| P2 | Contract-preserving per-service Skill generation | Complete |
| P3 | Validated complete publication, timeout, locking, recovery and isolation | Complete |
| P4 | Static multi-service and runtime SpringDoc Maven integration | Complete within the accepted testbed scope |
| P6 | Configurable individual / aggregate / both Skill outputs | Complete; unit and real Maven verification passed |
| Release | Maven Central 1.0.0 | Published 2026-09-11 |
| Documentation | Chinese-default README and equivalent English guide | Complete; synchronized for P6 |

## Current Implementation

- Backward-compatible single-service configuration remains the default (`outputMode=service`). An explicit `services` list can select `service`, `aggregate`, or `both` output modes.
- Aggregate configuration uses a distinct `aggregateId` and `aggregateSkillName`. Every listed member is required. Empty/missing/invalid/stale inputs fail the aggregate instead of silently producing a subset.
- The aggregate is self-contained: one `SKILL.md`, a service catalog, member source metadata, and service/document-isolated references. It does not merge OpenAPI documents or require installed individual Skills.
- In `both`, service updates run independently. Only complete successful member results from the current invocation enter the aggregate; no previous output is substituted. A failed member retains the previous aggregate while healthy peers can publish. An aggregate output failure cannot roll back individual updates.
- Removing a member removes its references on the next successful aggregate update. Disabled or removed standalone outputs are not deleted. Each output has separate ownership, locking, staging and status.
- One explicit coordinator runs after all document producers. The static reactor fixture orders its coordinator through module dependencies. There is no automatic cross-repository collection or build scheduling.
- Development version is `1.1.0-SNAPSHOT`; the new configuration is not available in published `1.0.0`. No new Central publication is part of this task.

## Verification

- Test first: four aggregate core tests failed before implementation; after core passed, six multi-service Mojo tests failed before coordinator implementation. Existing tests remained green.
- Final root `mvn -B install`: 74 tests pass (59 core, 15 plugin), zero failures/errors. The added aggregate file-budget test checks combined output beyond 10000 files; a mode-switch test first failed before retained aggregate settings were allowed in service mode. Final log: `target/aggregate-final-tests.log`.
- `verify-aggregate.ps1` passes real Maven parallel reactor ordering, all three modes, coexistence, repeated execution, required-member failure with unchanged old trees, healthy-peer continuation and successful recovery. Final review outputs under `testbeds/maven-plugin-integration/target/aggregate-verification/both/` contain orders-api, billing-api and platform-api, with all three statuses SUCCESS. Verifier logs remain in its ignored probe directory.
- Original `verify.ps1` static integration matrix, SpringDoc `refresh-fixtures.ps1` (5 tests), and `verify-generated-integration.ps1` runtime export/stale-capture checks pass. The SpringDoc fixture JSON bytes remain unchanged; only producer POM metadata changes for the snapshot version.
- Local verification encountered the previously recorded sandbox javac issue; integration passed in the normal local Maven environment. One final recovery attempt encountered a Windows directory-move failure and correctly retained both old member/aggregate outputs; a full verifier rerun passed. A root clean attempt failed because its redirected log was inside target; the successful final command was install, not clean install.
- Bilingual README links, XML snippets, command/configuration parity, PowerShell syntax and diff whitespace checks pass. Code, docs and test fixtures are delivered together; generated artifacts/logs remain ignored. No real frontend/web environment or new Central publication is required.
- The SpringDoc sample still exports at `verify`, not ordinary `compile`/`package`. Startup failures remain owned by the Spring Boot plugin. These are documented support boundaries, not requests for a real web environment.

## Deferred Work

- ZIP/package repositories, download/HTTP services, independent CLI or YAML configuration platform.
- Automatic cross-project installation/synchronization, locks/drift management, global version coordination and cross-repository scheduling.
- A full microservice/web platform, databases, service discovery, gateways, or custom UI.
- Other OpenAPI versions, Swagger 2.0, YAML, external references, generic URL ingestion, full specification validation.
- Search, RAG, AI enrichment, chat, TypeScript generation, additional knowledge sources, Agent plugins or MCP.

## Blockers

No external project path or web environment is required. Future user feedback may create a separate requested task; it does not block this delivery.

## Historical Evidence

The records below retain the decisions and verification at their original dates. Older statements about pending P5/target acceptance and deferred aggregation are superseded by the current scope above.

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
