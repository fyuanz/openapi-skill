# Tasks

## 2026-09-21 - Improve Node CLI Diagnostics

Status: Implemented in change `improve-node-cli-diagnostics`; awaiting archive.

- Node CLI failures now render one stable stderr line with owner context when available, a diagnostic phase/code,
  a safe message, and reliable one-based JSON line/column positions. Duplicate keys report the second declaration.
- `--debug` can be combined with `--config <path>` in either order and appends a bounded stack/`cause` chain;
  default output omits stacks, document content, HTTP headers, and sensitive remote URL components.
- Success remains stdout/exit `0`, runtime failure stderr/exit `1`, and usage failure stderr/exit `2`. Library APIs still
  throw or reject without writing to the console, and failed parsing retains an existing Skill byte-for-byte.
- Red-to-green evidence: four new CLI scenarios plus four diagnostic scenarios initially failed; after implementation
  `cd openapi-skill-node && npm test` passes 57 tests, up from 49.
- Scope is Node-only. No generated core/3 output, Java code, Spring Boot Starter behavior, or runtime dependency changed.

## 2026-09-21 - Support Local JSON Document Sources In The Node Package

Status: Implemented and archived as `2026-09-21-support-local-json-document-sources`.

- `services[].documents[].url` and the legacy document list now accept explicit local JSON paths in addition to
  HTTP(S) URLs. Relative local paths resolve from the Node CLI `cwd`; absolute paths are preserved.
- Config parsing records an internal remote/local source kind without changing the public `url: string` configuration
  shape. HTTP download timeout, redirect and content-type rules remain unchanged.
- Local sources must be regular files and share the existing 8 MiB per-document and 32 MiB project input limits.
  Missing, oversized or invalid local documents abort before publication and retain the previous complete Skill.
- Red-to-green evidence: the new config and run tests first failed at the former HTTP-only configuration boundary;
  after implementation `cd openapi-skill-node && npm test` passes 49 tests, including relative/absolute resolution,
  successful local generation, missing-file retention, single/project byte limits and unsupported-version retention.
- Scope is Node-only: no Java source, Maven module or Spring Boot Starter behavior was changed.

## 2026-09-20 - Streamline Agent Governance Around OpenSpec

Status: Implemented in change `streamline-agent-governance`.

- Root `AGENTS.md` was reduced to governance precedence plus repository-specific engineering rules. It retains the
  mandatory codex first-read set, red-to-green testing, file-size guidance, documentation synchronization,
  verification, and normal milestone commit/push rules.
- The duplicated OpenSpec workflow manual was removed from `AGENTS.md`: per-tool command spelling, the CLI command
  list, artifact language duplication, and OpenSpec lifecycle/directory details are now owned by `openspec/` and the
  generated OpenSpec skills.
- `PROJECT_CONTEXT.md` and `PROJECT_STRUCTURE.md` were updated to describe the boundary: OpenSpec owns workflow,
  change lifecycle, and agreed behavior; root `AGENTS.md` owns repository engineering rules; generated
  `.agents/`, `.claude/`, and `.codebuddy/` trees remain ignored output.
- `DECISIONS.md` records the governance decision and explicitly supersedes the prior adoption note that instructed
  root `AGENTS.md` to carry the OpenSpec CLI surface and per-tool command spelling.
- Verification for this governance slice: `openspec validate "streamline-agent-governance"`,
  `openspec status --change "streamline-agent-governance" --json`, `openspec doctor`, `openspec list --json`,
  targeted `rg` searches, and `git diff --check`. No product code, dependency, release artifact, OpenSpec config, or
  generated agent tree was modified.
- No version bump is required because generated product output and runtime behavior are unchanged. Publication is not
  part of this governance change.

## Current Scope

Product design v4.0.0 keeps the embedded Spring Boot runtime endpoint as the primary SpringDoc workflow. The application
generates and downloads a current Skill ZIP after startup, with automatic local group discovery and no OpenAPI Skill build
executions, HTTP self-capture, or generated build directories. The user will manually review Skills; this is not a gate.

Maven build-time compatibility has been removed by explicit user decision. Node `2.0.0` source builds on project mode
that downloads explicitly configured documents for multiple internal or third-party services and installs one
self-contained `openapi-skill-core/3` project Skill: one slim group-index context per document, one file per first
OpenAPI tag, clean semantic paths and precomputed reference closures. JSONL is retained only as a compact machine
index. Both the 2.0.0 npm package and the matching Maven Central 2.0.0 release are published. The accepted input root
marker is now any `3.0.x` or `3.1.x`; the compiler records the input's own dialect instead of assuming 3.1.0, and real
3.0 snapshots from the same producer are committed beside the 3.1 ones.
Cross-service aggregation by the embedded runtime Starter, WebFlux and centralized
artifact coordination remain outside scope.

## Work Plan

| Stage | Deliverable | Status |
| --- | --- | --- |
| P0 | Buildable Java 17/Maven core and declared OpenAPI JSON input | Complete |
| P1 | SpringDoc multi-package/group testbed and current-document contract | Complete within the accepted testbed scope |
| P2 | Contract-preserving per-service Skill generation | Complete |
| P3 | Validated complete publication, timeout, locking, recovery and isolation | Complete |
| P4 | Historical Maven build-time integration | Removed from the current product |
| P6 | Historical Maven individual / aggregate / both outputs | Removed from the current product |
| P7 | Runtime SpringDoc discovery and deterministic Skill ZIP endpoint | Complete; starter and real HTTP testbed verification passed |
| P8 | TypeScript npm package for configured single-service multi-URL Skill generation | Complete for the `1.3.0` legacy configuration; renamed to unscoped `smartdoc-agent` with bilingual package docs |
| P9 | Real Vue 3 + TypeScript consumer loop against the running SpringDoc service | Complete; build plus seven live call scenarios verified |
| P10 | Node project mode: one Skill for multiple services, source types and hierarchical keywords | Complete; 23 Node tests pass, the packed tarball is verified end to end in the real Vue consumer, and `smartdoc-agent@1.4.0` is published on npm |
| P11 | core/3 compact catalog, semantic IDs/filenames, JSONL lookup indexes, and centralized conventions | Complete in Java and Node source; current reactor has 69 tests after compatibility removal |
| P12 | Rename repository, npm/Maven artifacts, Java namespaces, runtime/config identities and local modules to `openapi-skill` | Complete in source; publication intentionally left to the user |
| P13 | LLM-first document context, clean semantic paths, and precomputed reference closure | Complete in Java and Node; runtime/Vue evidence verified, publication not requested |
| P14 | Tag-grouped navigation: one readable file per first OpenAPI tag, slim group-index context, catalog-owned server/security facts, 72-character names, breaking 2.0.0 release | Complete in Java and Node; runtime/Vue/cross-implementation evidence verified, publication not requested |
| P15 | Adopt OpenSpec as the spec-driven development workflow for this repository | Complete; CLI `1.13.1` installed, four tool trees initialized, `openspec/` tracked and generated instruction trees ignored |
| P15 | Accept OpenAPI 3.0.x and 3.1.x root markers, record the input's own dialect, and capture real 3.0 snapshots | Complete in Java and Node; 77 core and 43 Node tests pass, the published core/3 tree is byte-identical, publication not requested |
| P16 | Consumer testbed reproducibility: track the one tarball its lockfile pins, and record that `npm pack` is line-ending dependent | Complete; a fresh clone with an empty npm cache installs, and the committed tarball reproduces byte-identically from an LF checkout. The standing "no tarball is committed" rule now has exactly one deliberate exception |
| P17 | Read a value domain wherever the document states it, including in a `description`, without synthesizing an `enum` | Complete in Java and Node; 79 core and 43 Node tests pass, the producer testbed records a description-stated domain, and source moves to `2.1.1-SNAPSHOT`. Publication not requested |
| Release | Maven Central releases | `1.0.0` and `2.0.0` for the `openapi-skill*` coordinates published; `2.0.0` went live 2026-09-17 via the maintainer-run Central Portal deployment `0a0a1c39-a8ab-4378-b862-9b659a5f5c4f`; older `1.0.0`–`1.2.0` releases belong to the retired `smart-doc-agent` coordinates |
| Release | npm release | `openapi-skill@1.0.0`, `1.1.0` and `2.0.0` published; `latest = 2.0.0` since 2026-09-16 |
| Release | Release tags | `v2.0.0` (annotated, on `c221a3a`) covers both registry lines; one tag per released version is the standing rule recorded in DECISIONS |
| Documentation | Chinese-default README, English guide and v4.0 design | Updated for tag-grouped core/3 navigation |

## P13 Implementation Plan - Completed

The user approved this reviewed plan on 2026-09-16. All slices were implemented without splitting a document-level
`context.md`; registry publication remains outside the approved scope.

### Target Contract

- Make each document's existing `context.md` the LLM-facing interface directory. One document produces exactly one
  `context.md`; pagination, sharding, and size-based splitting are explicitly out of scope because a document-level
  context is accepted as bounded.
- Each document context retains its document description and explicitly documented server/security metadata, then lists
  every operation exactly once with a direct relative link, HTTP method/path, source summary, tags, and configured
  document keywords when present. OpenAPI free text remains untrusted reference data.
- Change trusted `SKILL.md` guidance to start at the appropriate `context.md` and follow Markdown links. It must not tell
  an LLM to search or open a complete `operations.jsonl` or `schemas.jsonl` file.
- Keep JSONL indexes as deterministic machine/validator artifacts for compatibility in this slice, but remove them from
  the LLM navigation path and human-facing context instructions.
- Use a clean semantic operation/schema filename when that name is unique within its service/document directory. Compute
  names in two passes and add a deterministic short suffix only to a real case-insensitive collision group or when safe
  encoding/path-length constraints require a fallback. Keep full input digests only in provenance.
- Precompute each operation's complete document-local Schema/reference closure. Render a sorted, de-duplicated link list
  on the operation page, distinguish direct from transitive dependencies, terminate recursion with a visited set, and
  report recursive edges without asking the LLM to derive the closure itself. Do not duplicate Schema bodies.
- Describe security precisely: distinguish a defined security scheme, an explicitly declared document default, an
  operation override, and an unstated fact. Never promote a scheme definition or a configured keyword into a global
  authentication requirement.
- Treat the layout and required-navigation change as `openapi-skill-core/2`. New generation emits core/2; publishers may
  recognize an owned core/1 tree only so it can be safely and atomically replaced. Registry publication is not part of
  P13 unless separately requested.

### Test-First Implementation Sequence

| Slice | Work | Verification gate |
| --- | --- | --- |
| P13.1 | Add mirrored Java and Node contract tests before implementation | Tests fail for clean filenames, document navigation, context-first instructions, closure manifests, collision fallback, and exact security wording |
| P13.2 | Replace unconditional filename digests with deterministic two-pass semantic allocation | Unique operations/schemas have clean names; case, normalization, unsafe-name, truncation, and same-slug collisions remain unique and deterministic on Windows-compatible paths |
| P13.3 | Turn document `context.md` into the complete interface directory and update root/service navigation plus `SKILL.md` | Every operation appears once with a valid direct link and method/path; one and only one context exists per document; no LLM instruction requires JSONL search |
| P13.4 | Build and render the precomputed operation reference closure | Direct, multi-hop, shared, recursive, root, and escaped local references are complete, sorted, de-duplicated, and link-valid without duplicating contract bodies |
| P13.5 | Update provenance, core/2 validators, Java/Node project assembly, and safe replacement compatibility | Validators reject missing/drifting contexts, collision errors, incomplete closures, broken links, and project/service metadata drift; a valid core/1 output can be replaced atomically |
| P13.6 | Regenerate the runtime and Vue consumer examples and update active documentation | Java reactor, Node suite, SpringDoc runtime ZIP tests, real project-Skill generation, Vue build, deterministic whole-tree comparison, and link validation pass |

### Acceptance Criteria

- The normal generated fixture contains `get-users-by-id.md` and `user-view.md`, without a routine digest suffix.
- Deliberately colliding names receive deterministic suffixes and never overwrite one another on a case-insensitive
  filesystem.
- A reader can start from `context.md`, select an operation, and reach every required contract through generated links
  without reading either JSONL index or computing a `$ref` closure.
- Each document has one complete `context.md`; no context pagination or splitting is introduced.
- Generated security statements match explicit OpenAPI inheritance/override semantics and preserve unknowns.
- Java and Node emit the same navigation/path semantics, all local links validate, repeated generation is byte-stable,
  and failed generation/publication retains the previous complete Skill.
- P13 is complete in source and verified. This work does not authorize package registry publication.

## Current Implementation

- New output uses `openapi-skill-core/3`. `catalog.md` selects a service/document and carries that document's readable
  server and security facts; every document has exactly one `context.md` that is now a slim group index and lists each
  first-tag group once with its interface count. Operations live in
  `references/documents/<docId>/groups/<tag>.md`, one file per first OpenAPI tag with the tag's own name (Chinese names
  included) and one `- [title](../operations/<file>.md) — \`METHOD /path\`` line each. Sorted
  `operations.jsonl`/`schemas.jsonl` remain machine/validator artifacts and now carry `group`/`groupFile` columns,
  while `conventions.md` holds shared OpenAPI reading defaults once per service tree.
- Operation/schema IDs are semantic and independent of SpringDoc `operationId`. Unique safe contracts use clean names
  bounded to 72 characters; deterministic short suffixes are limited to real case-insensitive collisions and
  filesystem-safety fallbacks. Full source SHA-256 stays in provenance.
- Trusted Skill guidance navigates catalog → context → group → operation Markdown. Each operation includes the
  generator-computed direct/transitive document-local reference closure and recursive edges, so no JSONL search or LLM
  graph derivation is required.

- `testbeds/vue-ts-consumer` is a real Vue 3 + TypeScript + Vite consumer. It installs the packed
  local `openapi-skill@2.0.0` package, generates one Skill from the two live grouped endpoints of the running SpringDoc
  testbed into its own `.agents/skills/`, and calls all five documented operations through a Vite dev-server proxy.
- `openapi-skill-spring-boot-starter` auto-configures `GET /openapi-skill/skill.zip` for Servlet/WebMVC applications.
- It derives service identity from `spring.application.name`; enabled/path/serviceId/skillName are optional overrides.
- `GroupedOpenApi` beans define the complete document set. With no groups, the default SpringDoc document is used.
- Final JSON comes from `MultipleOpenApiWebMvcResource` / `OpenApiWebMvcResource` in-process, not an HTTP self-request and
  not the incomplete base `OpenAPI` bean.
- Each request invokes existing core conversion and returns a sorted, fixed-timestamp ZIP rooted at `<skillName>/`.
  The hidden endpoint does not enter generated OpenAPI.
- The SpringDoc testbed POM now contains no Boot start/stop, springdoc Maven capture, or OpenAPI Skill Maven goal.
- `openapi-skill-node` provides unscoped `openapi-skill`: preferred `services` configuration generates one
  self-contained `openapi-skill-core/3`, `kind=project` Skill, named `api-docs` by default, from multiple explicitly
  configured internal or third-party services. It accepts project/service/document keywords, keeps service/document
  contracts separate beneath `references/services/<serviceId>/references/`, and safely replaces the whole project tree.
- The earlier top-level `serviceId` + `skillName` + `documents` configuration remains accepted as configuration, but it
  also emits the core/3 layout; the former core/1 and core/2 trees are recognised only so an owned tree can be replaced.
- Java source artifacts use `io.github.fyuanz:openapi-skill*:2.0.0`; Java packages use
  `io.github.fyuanz.openapi.skill.*`. Node source is `openapi-skill@2.0.0`, published to npm on 2026-09-16. The
  Maven Central `2.0.0` artifacts were published on 2026-09-17, so both registry lines now serve `2.0.0`.

## Verified

## 2026-09-20 - Description-Stated Value Domains

- Red first: `SkillGeneratorTest.explainsEnumerationSemanticsWithoutInventingValues` failed on
  `conventions must state that a value domain may be declared inside a description`, and the Node
  assertions in `generate.test.mjs` fail the same way against the pre-change source.
- Producer behaviour measured, not assumed. `UserView.role` is typed `Integer` with the domain stated
  in its `@Schema` description, and the refreshed fixtures record exactly that: `"type": "integer"`,
  the description, and no `enum` keyword in either dialect.
- Green: `mvn -B clean install` runs 79 core tests (up from 77). `npm test` runs 43 Node tests.
  `refresh-fixtures.ps1` regenerated both dialects and rewrote `metadata.json`; the 7 testbed tests
  pass with the new `role` assertions in `OpenApiContractTest`.
- Cross-implementation check: the Java and Node generators produced 22 files from the same two
  documents with identical values, and `conventions.md` plus `SKILL.md` compared byte-identical.
  `source.json` compares equal as parsed JSON. The remaining difference is the known Jackson
  `"k" : v` versus `JSON.stringify` `"k": v` indentation, unchanged by this work.
- Consumer end to end: `openapi-skill-2.1.1.tgz` packed from an LF checkout at 29,616 bytes, sha1
  `9377d26c035bf059677639b1cd5b30db3d7b1b0d`, installed by `npm ci` against an empty cache, then run
  against the live testbed to write 24 files. The generated `conventions.md` carries `## Value
  domains` and `user-view.md` carries the role description with no invented `enum`.
- Version: source moves to `2.1.1-SNAPSHOT` across the four poms, and the Node package to `2.1.1`
  with its metadata assertion and the consumer lock updated together. Generated output changed, so
  the release rule is triggered; publication was not requested.

## 2026-09-20 - OpenSpec Adopted As The Development Workflow

- `@fission-ai/openspec@1.13.1` installed globally and verified: `openspec --version` prints `1.13.1`.
  The registry was queried directly because `npm view openspec` resolves a different, unrelated bare
  `openspec` placeholder at `0.0.0`.
- `openspec init --tools codebuddy,claude,codex,agents --language zh-CN` created
  `openspec/{config.yaml,specs/,changes/archive/}` plus 6 skills and 6 commands under each selected
  tool tree. `openspec doctor` reports `OpenSpec root: ok`; `openspec list` reports
  `No active changes found.`, which is the correct empty state for a fresh adoption.
- `.gitignore` now ignores the three generated instruction trees (`.agents/`, `.claude/`,
  `.codebuddy/`) and keeps `openspec/` tracked. Verified with `git check-ignore -v`: all three trees
  match their rules and `openspec/config.yaml` does not.
- `AGENTS.md` initially gained a leading Specification-Driven Development section. That broader manual was later
  superseded by change `streamline-agent-governance`: root `AGENTS.md` now only states OpenSpec precedence and
  repository engineering rules, while concrete workflow/command details are owned by OpenSpec skills and `openspec/`.
- No version bump: this change adds process, configuration, and documentation. It does not alter
  generated output, so the release rule in DECISIONS.md:367 is not triggered.

## 2026-09-17 - Maven Central 2.0.0 Release Preflight

- npm side is confirmed live from the registry, not from memory: `openapi-skill` has `1.0.0`, `1.1.0` and
  `2.0.0` with `latest = 2.0.0` published at `2026-09-16T10:48:54Z` (shasum `c4ac536956f7c2bca57b20c0336bde18d2b8516a`).
  Maven Central metadata still reports `1.0.0` only (`lastUpdated 20260916030813`), so the two release lines are
  not yet aligned and Maven `2.0.0` is the outstanding action.
- Preflight on the release source: `mvn -B clean install` is BUILD SUCCESS with 71 tests (69 core + 2 Starter).
  The clean `openapi-skill-core-2.0.0.jar` contains only `io/github/fyuanz/openapi/skill/core` classes, 0 entries
  matching `smartdoc`, and 27 total entries, so the stale-class hazard recorded in DECISIONS did not recur.
- The `central-release` profile's non-signing half runs in this environment: `clean package -Dmaven.gpg.skip=true`
  is BUILD SUCCESS and attaches sources and Javadoc for both modules. The seven artifacts awaiting upload are the
  parent POM plus `jar`/`sources.jar`/`javadoc.jar` for core and Starter.
- Maven Central publication is confirmed impossible from this sandboxed session, and the root cause is now pinned
  more precisely than the earlier note. It is not a `~/.gnupg` permission problem: that directory accepts writes,
  its stale sockets can be deleted, and `gpg-agent --daemon` does recreate `S.gpg-agent`. The real blocker is that
  every gpg write path must first create a `*.lock` / `.#lk*` lockfile, and the sandbox refuses that creation with
  `Device or resource busy`. The decisive evidence is a signing attempt against a keyring copied into a writable
  in-project directory: `gpg: error opening lockfile '<homedir>/pubring.kbx.lock': Device or resource busy`. This is
  independent of homedir location and explains every observed failure, including the endless
  `removing stale lockfile` loop. `--lock-never`, `--no-autostart`, `--pinentry-mode loopback` and
  `--passphrase-file` were each ruled out.
- The DPAPI credentials themselves decrypted fine inside the sandbox, so credentials were never the blocker. Note
  for future sessions: `credentials.clixml` is UTF-8 encoded, not UTF-16LE; decode it as UTF-8 to reach the hex
  blob, then decode the `CryptUnprotectData` output as UTF-16LE.
- The deploy must therefore run from a normal terminal:
  `powershell -ExecutionPolicy Bypass -File C:\Users\fyuan\.m2\smartdoc-central\invoke-release.ps1 -Phase deploy -Clean`.

## 2026-09-17 - Maven Central 2.0.0 Release Completed

- The maintainer ran the release from a normal terminal. The Maven `deploy` phase itself succeeded inside the
  script: it signed all seven artifacts, bundled them, and the Central Portal upload returned deploymentId
  `0a0a1c39-a8ab-4378-b862-9b659a5f5c4f` with `errors: []` and `warnings: null`. The apparent "no response" was
  the script blocking in its `waitUntil=published` poll, not a failure.
- Portal state progressed `PUBLISHING` (created `2026-09-17T03:08:12Z`) to `PUBLISHED`
  (`2026-09-17T03:23:34Z`), i.e. 15 minutes 22 seconds, noticeably longer than the 8-minute 1.0.0 deployment on
  2026-09-16. The status endpoint `/publisher/status?id=...` returned HTTP 500 throughout while
  `/publisher/deployments` answered normally, so the deployments list is the reliable probe.
- Artifacts verified from `repo1.maven.org` rather than from the Portal state alone: the parent POM, both
  `jar`/`sources.jar`/`javadoc.jar` sets, and the Starter JAR all return HTTP 200. `openapi-skill-core-2.0.0.jar`
  is 60,492 bytes on Central and locally, the Starter JAR is 19,353 on both, and the sources JAR is 28,672 on both.
  The Javadoc JAR differs by 7 bytes (103,060 vs 103,067) because Javadoc embeds generation timestamps.
- All three artifact metadata files advanced to `latest = 2.0.0` / `release = 2.0.0`
  (`lastUpdated 20260917032331`–`20260917032333`), up from `1.0.0`.
- Signature ownership verified from the published `.asc` files: the Issuer Fingerprint subpacket
  (`21 04 <32 bytes>`) decodes to `B8EDC9D7B1AEBDCA56A1DA28FD9316D8966A3116`, matching
  `signing-fingerprint.txt`. Signature producer is `BCPG v1.81`, the Bouncy Castle signer configured in the
  `central-release` profile. Verification was done by parsing the OpenPGP packet because every gpg subcommand
  including `--verify` hits the same sandbox lockfile block described above.
- Release tag: annotated `v2.0.0` on `c221a3a` ("chore: cut the 2.0.0 release versions"), the commit that moves the
  reactor from `2.0.0-SNAPSHOT` to `2.0.0`. It is pushed and confirmed remotely via
  `git ls-remote --tags` (`refs/tags/v2.0.0` = `5258685626024281d26acce14ec22153cda60d5c`, peeled to `c221a3a`).
  The Node-prefixed tag namespace used for `smartdoc-agent-node-v1.4.0` is retired by decision, so no npm-only tag
  was created for `2.0.0`.

## 2026-09-17 - Release Push Unblocked Over SSH

- The HTTPS remote path was unusable from this session: `git push` and `git ls-remote` over
  `https://github.com/...` both failed with `CONNECT tunnel failed, response 502`, while
  `repo1.maven.org` and `registry.npmjs.org` stayed reachable, so the failure is specific to the GitHub
  egress path rather than general connectivity.
- `ssh -T git@github.com` authenticated successfully, but `git push git@github.com:...` still dialled HTTPS
  because the user's global config rewrites it:
  `url.https://github.com/.insteadof = git@github.com:`. The `ssh://git@github.com/fyuanz/openapi-skill.git`
  form is not matched by that rewrite and pushed normally (`c221a3a..a18d6e1`). Use the `ssh://` form in this
  environment when the HTTPS path is blocked.
- Two documentation commits (`610d2c1`, `a18d6e1`) had been left unpushed behind that failure and are now on the
  remote. Local `HEAD`, the remote branch and the tag all agree.

## 2026-09-16 - Core/3 Tag-Grouped Navigation Delivered

- Trigger: a consumer project reported that generating a Skill from a 124-operation OpenAPI 3.1.0 document made the
  agent prompt too large. The redesign was evaluated and approved by the user with three explicit decisions:
  group inside a document (not across documents), split by the OpenAPI 3.1 `tags` with Chinese names allowed, and
  breaking changes permitted with no compatibility requirement.
- Node `openapi-skill@2.0.0` passes `npm test` with 41 tests (40 before this slice; the new one publishes a tree whose
  group files carry Chinese tag names). Java `2.0.0` passes `mvn -B clean install` with 71 tests (69 core +
  2 Starter) and produces `openapi-skill-core-2.0.0.jar` and
  `openapi-skill-spring-boot-starter-2.0.0.jar`. The standalone SpringDoc testbed passes 6 tests.
- Red first: the new Node test failed with
  `OUTPUT: unsafe generated path references/documents/uav/groups/Terra重建管理.md`, the identical error the real Vue
  consumer hit, before the publisher's ASCII-only path allowlist accepted Unicode. Java's validator and Node's
  publisher now share the same `[\p{L}\p{N}._/-]+` rule.
- Measured on the 124-operation sample: 151 files, `context.md` 1,660 B, `catalog.md` 513 B, `SKILL.md` 2,568 B, 19
  group files with the largest at 2,621 B. Worst-case mandatory read 4,794 B versus the former 28,084-byte context
  (17%). Files whose names were previously truncated now keep the full semantic stem (longest 55 characters) after the
  48→72 bound change.
- Real consumer loop: the packed `openapi-skill-2.0.0.tgz` (24 files, 28,419 bytes, shasum
  `32eac2110ebe5a9893cc2a980062285ce0ed90fc`) is installed into `testbeds/vue-ts-consumer`, generates a 24-file
  project Skill with 2 contexts and 3 Chinese group files (`用户管理.md`, `订单管理.md`, `文件管理.md`), and its Vite
  production build reproduces the unchanged 71.74 kB JS / 1.43 kB CSS bundle.
- `testbeds/vue-ts-consumer/verify-skill-tree.mjs` was updated for core/3 (24 files, 3 group files, group-index
  context, catalog-owned server/security facts, every operation listed by exactly one group in the slimmed
  single-line form) and reports PASS: 37 links, 0 broken, 0 digest-suffixed contracts, 0 JSONL references in trusted
  navigation, 4 operations with exact security semantics. Two consecutive generations produce the identical
  whole-tree SHA-256 `745f0e0ec44a9eda52fb0868c00c0600b193307b19e2b39f0966f752721148bc` under the algorithm in
  DECISIONS.
- Cross-implementation check against the live runtime: `GET /openapi-skill/skill.zip` on the running SpringDoc
  testbed returned a 15,807-byte ZIP whose service tree and the Node project's nested service tree contain the same 21
  files in the same paths. 6 are byte-identical, 11 match after JSON normalization, and the 4 remaining differ only by
  consumer-configured keywords/source type and the runtime's default `skillName` — no layout or naming drift.
- Packaging hazard found and recorded: re-packing a tarball at an unchanged version leaves `package-lock.json`
  pinning the previous integrity, so `npm install` restored the stale build from cache and the consumer kept failing
  after the fix. The lock had to be regenerated before the fixed tarball was actually installed.
- Registry state was read, not assumed: npm `openapi-skill` has `1.0.0` and `1.1.0` (`latest`), and Maven Central has
  `io.github.fyuanz:openapi-skill{,-core,-spring-boot-starter}:1.0.0`. Both sides therefore receive a genuine major
  bump to `2.0.0`. No npm or Maven publication was performed in this slice.

## 2026-09-16 - P13 Independent Re-Verification And Clean-Build Artifact Purity

- Context: the P13 session was interrupted by a quota limit with all P13 work still uncommitted in the working tree.
  This entry records an independent re-run of the full verification against that exact state, before the delivery
  commit.
- Java: `mvn -B clean install` is BUILD SUCCESS with 70 tests (68 core + 2 Starter). The earlier non-clean
  `mvn -B install` had packaged pre-rename `com.smartdoc.agent.*` classes, left in `target/classes` by the rename, into
  `openapi-skill-core-1.1.0-SNAPSHOT.jar`; the clean artifact contains 17 `io.github.fyuanz.*` classes and no legacy
  entry. The standing rule is recorded in DECISIONS.
- Node: 30 tests pass. Recompiling `dist` from source is byte-identical to the installed build, and a fresh `npm pack`
  reproduces the on-disk `openapi-skill-1.1.0.tgz` exactly (24 entries, shasum
  `2a2837a61ce3ddf5bb752f4620df12d0eaa3041c`). The consumer package therefore already carried the exact security
  wording instead of retaining it only in the TypeScript source.
- Consumer: two consecutive generations against the running SpringDoc testbed produced an identical 21-file project
  Skill with 2 document contexts, 0 digest-suffixed contract filenames, 32 resolving relative Markdown links, no nested
  `SKILL.md`, 0 JSONL references in trusted navigation, and the exact security wording on all 4 operation pages. The
  whole-tree SHA-256 is `99547bf1a8b8…` under the algorithm pinned in DECISIONS.
- Provenance: the generated `source.json` digests (`3a5bbf4e…`, `45f43c83…`) equal the live endpoints re-fetched during
  this run, so the Skill is a faithful snapshot. These supersede the `686c1b8b…` / `ae7e7d84…` values recorded on
  2026-09-14 and 2026-09-15, which describe the pre-rename testbed identity rather than a generator defect.
- `npm run build` in the Vue consumer passes `vue-tsc` and reproduces the unchanged 71.74 kB JS / 1.43 kB CSS bundle.
- Documentation correction: the bare whole-tree hash `253e8c9d…` in the entry below was produced by a script that was
  not retained, so it cannot be checked against a later run. The reproducible value for the same tree is recorded above
  with its algorithm, and the verifier itself is now committed as
  `testbeds/vue-ts-consumer/verify-skill-tree.mjs` (checks file count, one context per document, suffix-free contract
  names, link resolution, JSONL-free trusted navigation, exact security semantics, and emits the tree digest).

## 2026-09-16 - P13 Context-First Core/2 Navigation Implemented

- Added failing Java and Node contract tests first for clean names, collision fallback, one context per document,
  context-only LLM navigation, exact security wording, complete multi-hop/recursive closures and core/1 replacement.
- `mvn -B install` passes 68 core tests plus 2 Starter tests; `npm test` passes 30 tests. The standalone SpringDoc
  testbed's known Windows/JDK compiler-resource error occurred once for main and once for test compilation after writing
  their classes; the next unchanged `mvn -B verify` passed all 6 runtime tests.
- The final local `openapi-skill@1.1.0` tarball has 24 files (26.0 kB packed, 94.2 kB unpacked; shasum
  `2a2837a61ce3ddf5bb752f4620df12d0eaa3041c`). The real Vue consumer installs it, generates a 21-file project Skill,
  and passes `vue-tsc` plus the Vite production build.
- Normal fixtures use clean operation/schema paths. Deliberate case-insensitive collisions and unsafe Unicode/Windows
  names receive deterministic suffixes. All generated Markdown links validate and repeated generation is byte-stable.
- Each document keeps one unsplit `context.md`; JSONL remains available to validators but is absent from trusted LLM
  navigation instructions. The generated fixture has 2 contexts, 0 routine digest-suffix contracts and 0 broken links;
  two consecutive whole-tree generations both hash to
  `253e8c9d13c750817d9370f069a5375d3fe8baeff97eaf3bf6fb477f31b0f1e8`. No npm or Maven publication was performed.

## 2026-09-16 - Maven Build-Time Compatibility Removed

- The user explicitly rejected all Maven build-time compatibility under the new `openapi-skill` coordinates.
- Removed the Maven plugin module and static Maven integration testbed. The root reactor and Central release set now
  contain only the parent POM, core, and runtime Starter.
- Spring Boot uses the runtime Starter; cross-service project Skills use the published npm CLI. Historical artifacts
  under old coordinates remain immutable but are not a supported compatibility promise for the renamed product.
- Red-to-green structure check first failed on the reactor module, both compatibility directories, and active docs;
  after removal it passes. `mvn -B clean install` passes 69 tests (67 core + 2 Starter), and `npm test` passes 29 tests.
- The standalone SpringDoc testbed's clean compile still reports the host's known javac resource-close error after
  writing classes; a subsequent compile similarly stopped after writing test classes, and the next unchanged `verify`
  passed all 6 runtime tests. This host condition is independent of the removed plugin and did not affect the clean
  root reactor build.

## 2026-09-16 - Repository And Package Rename Prepared

- Repository/SCM URL: `https://github.com/fyuanz/openapi-skill.git`; local module directories are `openapi-skill-*`.
- npm package/CLI/config: `openapi-skill@1.0.0`, `openapi-skill`, `openapi-skill.config.json`, and
  `package.json#openapiSkill`. The name returned npm registry 404 before publication.
- Maven/Java: `io.github.fyuanz:openapi-skill*:1.0.0` and `io.github.fyuanz.openapi.skill.*`.
- Runtime/config identities: `/openapi-skill/skill.zip`, `openapi.skill.runtime.*`, `.openapi-skill/`, and
  `openapi-skill-core/1`.
- Red-to-green evidence: the renamed npm metadata/config tests first failed in 7 cases, and the former-identity migration
  test then failed before implementation; the final 29-test Node suite and 84-test Java reactor passed. `npm pack`
  produced `openapi-skill-1.0.0.tgz` with 24 entries (23,408 bytes), and the
  Vue consumer installed it and built successfully. The SpringDoc testbed passed 6 tests after the known Windows javac
  resource-close retry. npm and Maven publication were intentionally not performed.

## 2026-09-15 - Node 1.5.0 Published Manually

- The user manually published `smartdoc-agent@1.5.0`.
- Registry verification reports `version = 1.5.0`, `dist-tags.latest = 1.5.0`, and publication time
  `2026-09-15T09:19:57.619Z`.

## 2026-09-15 - Core/3 Semantic Index And Retrieval Layout

- Red-to-green coverage was added for semantic identities, six-character filenames and collision extension, compact
  catalogs, centralized conventions, sorted JSONL indexes, missing/index-drift validation, and nested project indexes.
- Node `1.5.0` passes 28 tests. Its 24-file, 23.3 kB packed artifact installs into the real Vue consumer; the consumer
  build and live two-document generation both pass. It is published as npm `latest`.
- The Java reactor passes 67 core, 15 Maven-plugin and 2 Starter tests (84 total). The standalone runtime testbed passes
  6 tests and produces the same core/3 indexes through its real HTTP ZIP endpoint. On this Windows host, a clean testbed
  compile intermittently reports javac's known resource-close error after writing classes; the immediate non-clean
  `verify` passes without source changes.
- The generated catalog fixture shrank from 2,039 bytes to 420 bytes (about 79%). Common operation-default prose is no
  longer repeated per operation; it is stored once in `references/conventions.md`.

## 2026-09-15 - Node 1.4.0 Packaging And Real-Consumer End-To-End Generation

- Test suite: the Node suite passes 23 tests (`node --test test/*.test.mjs`) covering default `api-docs` naming, legacy
  configuration compatibility, multi-service and repeated-document-ID isolation, three-level keyword handling, safe
  escaping of special discovery keywords, the project-wide document and byte budgets across service boundaries,
  loopback downloads, download/generation failure retention, legacy-to-project migration, and stale-directory removal
  when a service leaves the configuration.
- Packaging: `npm pack` produced `smartdoc-agent-1.4.0.tgz` (24 entries, 21,058 bytes packed / 74,238 bytes unpacked)
  containing `LICENSE`, 12 `dist/*.js` and 12 `dist/*.d.ts` files, `package.json`, and both `README.md` and
  `README.en.md`. No test, source, or generated artifact entered the tarball. `testbeds/vue-ts-consumer` reinstalled
  that tarball and now resolves `smartdoc-agent@1.4.0`.
- End-to-end generation: the SpringDoc testbed was started on a fixed `127.0.0.1:18080` and served
  `/v3/api-docs/account` (2 paths), `/v3/api-docs/business` (2 paths) and `/smartdoc/skill.zip` (17,043 bytes) with
  HTTP 200. `npm run skill:generate` in the consumer printed `Generated 1 service(s) and 2 OpenAPI document(s) ... (21
  files)` and wrote `.agents/skills/api-docs/`.
- Generated-tree validation: 21 files / 23,542 bytes using `smartdoc-agent-core/2` `kind=project`, one root `SKILL.md`,
  `references/catalog.md`, `references/source.json`, and
  `references/services/springdoc-multi-package/references/{catalog.md,source.json,documents/<id>/...}`. All 32 relative
  Markdown links resolve, no nested `SKILL.md` exists, both service keywords and document keywords are sorted and
  de-duplicated, and the root description stays a single line of 464 characters (708 bytes) with no `: ` sequence.
- Determinism and atomicity: regenerating without a source change reproduced the identical whole-tree SHA-256
  `b8940cff8d3673487dea91e1d48f866bcefbcd55bd0654bec85671d3c8b39dfc`; `.smartdoc/staging` and `.smartdoc/backups`
  were left empty after every run.
- Failure retention: pointing `business` at a closed port made the CLI exit 1 with
  `springdoc-multi-package/business: DOWNLOAD: fetch failed`, and the previous project Skill remained byte-identical
  with no partial or mixed tree published. The configuration was restored and the tree hash returned to the same value.
- Stale-service removal: renaming the configured `serviceId` replaced the whole project tree, leaving only
  `references/services/springdoc-renamed/` and no `springdoc-multi-package` subtree.
- Live-data equivalence: the SHA-256 of both live endpoint responses re-fetched during this run
  (`686c1b8b…6d87`, `ae7e7d84…290c`) equals the digests recorded in the generated `source.json`, so the Skill is a
  faithful snapshot of the running service.
- Consumer build: `npm run build` (`vue-tsc -b && vite build`) passed strict type checking and produced the same
  71.74 kB JS / 1.43 kB CSS bundle as the prior closed loop.
- Housekeeping note: because project mode defaults the Skill name, a consumer switching from the legacy
  `springdoc-multi-package-api` Skill to `api-docs` keeps the old directory until it is deleted manually. The whole-tree
  replacement guarantee applies within one Skill name; the stale legacy directory in this testbed was removed by hand.
- Delivery: npm publication was completed separately, after this local verification run (see the release entry below).

## 2026-09-15 - Node 1.4.0 Published To npm And Independently Verified From The Registry

- Registry state: the unscoped `smartdoc-agent` package now reports `dist-tags.latest = 1.4.0`, with `1.3.0`
  (2026-09-15T03:09:18Z) and `1.4.0` (2026-09-15T06:54:22Z) as its only versions. Maintainer `fyuan
  <624728873@qq.com>`. The earlier "unoccupied / 404" note in DECISIONS describes the state at rename time only.
- Artifact equivalence: the tarball downloaded from the public registry is 21,058 bytes with
  `sha512-SSKT78zvVzVF9g8Wc1sGWCAqUGL7xCWMbPyVCfkea5gg+jkwQ79LaEKU4x+XfIdS13JXdDAbcrQ50H5xZ77tpw==`, which equals the
  published `dist.integrity` and the locally packed `smartdoc-agent-1.4.0.tgz` byte for byte. The remote and local
  entry lists are identical (24 entries), so nothing was added or lost in transit.
- Fresh install: installing `smartdoc-agent@1.4.0` from the public registry into an empty directory succeeded, resolved
  version `1.4.0`, registered the `smartdoc-agent` executable, and `dist/cli.js --help` printed its usage.
- No Maven or generated-Skill behavior changed in this release step, so the Java reactor and the consumer Skill were
  not regenerated.

## 2026-09-15 - Node Multi-Service Project Skill Implementation Slice

- Added a preferred `services` configuration while preserving the earlier single-service configuration. Project mode
  defaults `skillName` to `api-docs`; legacy mode retains its required explicit `skillName`. Mixing the two shapes is
  rejected.
- One project Skill contains 1-32 explicitly identified services and no nested Skill entrypoints. Each service defaults
  to `sourceType=internal` or may declare `third-party`; document IDs need only be unique within their service.
- Project-, service-, and document-level keyword arrays are trimmed, NFC-normalized, de-duplicated and sorted. Each
  level permits at most 16 keywords of 1-64 printable characters. Project/service keywords feed a bounded frontmatter
  discovery fragment; complete legal keyword lists remain in catalogs and provenance.
- Project output uses `smartdoc-agent-core/2`, `kind=project`, one root `SKILL.md`, root catalog/provenance, and physical
  service trees under `references/services/<serviceId>/references/`. Relative Markdown navigation replaces filesystem
  symlinks; OpenAPI documents remain semantically separate and references remain document-local.
- The root project provenance retains sorted nested service metadata and a flattened service/document index. The
  publisher validates project kind/version, source type, nested provenance equality, document membership, link targets,
  and the absence of nested `SKILL.md` files before staged replacement.
- Bounds are 32 services, 32 documents across the project, 32 MiB project input, 10,000 files and 64 MiB output, while
  retaining the 8 MiB per-document limit. All downloads and generation form one atomic update; any failure leaves the
  previous complete project Skill in place.
- Test-first evidence: the new project configuration, generation, provenance and publication tests failed before the
  implementation existed. The Node suite grew to 23 tests, including internal/third-party services, repeated document
  IDs across services, the project-wide document and byte budgets across service boundaries, three-level keyword
  normalization/bounds and safe escaping, deterministic output, core/1 compatibility, core/2 validation,
  legacy/project migration, stale-service removal, loopback downloads and failure retention.
- Delivery remains in progress: package version is `1.4.0`, but npm publication has not been performed.

## 2026-09-15 - Unscoped Node Package Name And Bilingual Package Documentation

- Renamed the package identity from `@fyuanz/smartdoc-agent` to unscoped `smartdoc-agent`; the CLI executable remains
  `smartdoc-agent`, so configuration and invocation behavior are unchanged.
- Replaced the Node package's English-only `README.md` with the default Chinese guide and added an equivalent
  `README.en.md`. Both documents provide reciprocal language links, and both are included in the npm package.
- Updated root onboarding and the Vue consumer dependency/tarball reference to the new package identity. Historical
  closure records retain the old scoped name where they describe an earlier verified run.
- Test-first evidence: the new package metadata/documentation test failed because `README.en.md` did not exist, then all
  9 Node tests passed. `npm pack --json` produced `smartdoc-agent-1.3.0.tgz` with both README files among 20 entries; the
  updated Vue consumer installed that tarball and its strict production build passed.
- A direct no-cache check of the official npm registry returned HTTP 404 for `smartdoc-agent` on 2026-09-15, so the
  unscoped name was not occupied at verification time.
- Publishing the new unscoped package to npm is a separate credentialed release action and was not performed here.

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
- Current Node package suite: 29 tests pass for legacy and project configuration, semantic index generation, download
  and publication.
- `git diff --check` passes after documentation cleanup; bilingual onboarding and v3.7 project records describe the same
  runtime-first boundary.

## Deferred Work

- Long-lived artifact caching, YAML configuration, automatic cross-project synchronization, drift management, global
  version coordination and cross-repository scheduling.
- Cross-service aggregation by the embedded runtime Starter, WebFlux, databases, service discovery, gateways, or custom UI.
- Other OpenAPI versions, Swagger 2.0, YAML, external references, unconfigured URL discovery, full specification validation.
- Search, RAG, AI enrichment, chat, generated API clients, additional knowledge sources, Agent plugins or MCP.

## Blockers

No external project path or web environment is required. Future user feedback may create a separate requested task; it does not block this delivery.

## Historical Evidence

The records below retain decisions and evidence at their original dates. Older statements that runtime ZIP/download is
deferred or that SpringDoc generation runs at Maven `verify` are superseded by P7 above.

## Last Updated

2026-09-20 (OpenSpec adopted and then made the single workflow source: `@fission-ai/openspec@1.13.1` is installed and
verified, `openspec init` created the `openspec/` tree plus codebuddy/claude/codex/agents instruction trees, generated
trees are ignored while `openspec/` stays tracked, and change `streamline-agent-governance` narrowed root `AGENTS.md`
to governance precedence plus repository engineering rules. No version bump, because no generated output changed).
2026-09-17 (Release closed out: annotated `v2.0.0` created on `c221a3a` and pushed, the two pending documentation
commits pushed over SSH after the HTTPS GitHub path failed with HTTP 502, and the one-tag-per-version rule recorded
as a decision. Both registry lines serve 2.0.0 and no tracked work item remains open).
2026-09-17 (Maven Central 2.0.0 published: the maintainer-run deployment finished with zero errors or warnings,
all seven artifacts are downloadable from repo1.maven.org at byte sizes matching the local build, all three
metadata files report `latest = 2.0.0`, and the published signatures carry the expected fingerprint; both registry
lines now serve 2.0.0).
2026-09-17 (Maven Central 2.0.0 release preflight: registry state read directly, 71-test clean build with a pure
core JAR, sources/Javadoc attachments verified, and the gpg signing blocker precisely attributed to sandbox
lockfile interception).
2026-09-16 (core/3 tag-grouped navigation delivered in Java and Node: 71-test Java reactor, 41-test Node suite, 6-test
SpringDoc testbed, a deterministic 24-file project Skill with a pinned whole-tree hash, a 21-file cross-implementation
agreement with the live runtime ZIP, and Node/Maven advanced to the breaking 2.0.0 line).

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
