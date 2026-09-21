# Decisions

## 2026-09-21 - Keep Default Node CLI Diagnostics Safe And Put Full Causes Behind Debug

Status: Accepted

Node CLI diagnostics use a fielded internal error at the parsing boundary and a single renderer at the executable
boundary. Default failures identify owner, phase, code and safe message without printing stack traces, document snippets,
headers or sensitive URL components. The existing JSON duplicate-key scanner supplies deterministic UTF-16 offsets,
converted to one-based line and column positions, instead of parsing Node/V8-dependent `JSON.parse` error wording.

`--debug` is an explicit troubleshooting mode that appends the complete stack and `cause` chain with cycle detection and
a fixed depth bound. It can expose source details, so documentation warns users to redact output before public sharing.
Library entry points remain console-free, and diagnostic rendering does not move work across the atomic publication
boundary. A third-party parser and a general logging framework were rejected as unnecessary dependencies. This changes
CLI observability but not generated files, so the existing `2.1.1` source version remains appropriate until publication
is separately requested.

## 2026-09-21 - Treat Explicit Local JSON Paths As Node Document Sources

Status: Accepted and implemented

Context:

- The Node CLI previously required every configured document `url` to use HTTP(S), even when a project already had an
  exported OpenAPI JSON fixture or generated contract on disk.
- Starting a temporary HTTP server for offline tests, CI fixtures or service-not-running workflows added an unrelated
  runtime dependency. The downstream generator already consumes bytes and does not depend on transport.

Decision:

- Keep the public `services[].documents[].url` field and classify values beginning with `http://` or `https://` as
  remote sources; treat every other non-empty value as a plain local path. `file://`, glob and directory discovery are
  outside this contract.
- Resolve relative local paths from the CLI `cwd`, not from an explicitly selected configuration file's directory.
  This matches existing `output` and default project-root semantics; absolute paths remain absolute.
- Record source kind and resolved path only in the internal resolved configuration. Generated provenance continues to
  identify input snapshots by digest and does not expose local absolute paths.
- Read local sources only when they are regular files. Apply the same 8 MiB per-document and 32 MiB project budgets as
  HTTP input; `timeoutMs` remains network-only. Any local read or validation failure occurs before atomic publication,
  so the previous complete Skill remains unchanged.

Alternatives considered:

- Add a separate `file` or `path` field. Rejected because it creates mutually exclusive configuration fields and the
  requested compatibility surface is the existing `url` property.
- Resolve relative paths from the configuration file directory. Rejected because `--config` may select a shared file
  outside the consumer project, while current project-relative options resolve from `cwd`.
- Support `file://` and directory scans immediately. Rejected to keep the trusted input boundary explicit and small.

Consequences:

- Existing HTTP(S) configurations remain source-compatible and retain their current fetch behavior.
- Local fixtures and exported contracts can drive the same validation, generation and atomic replacement path without
  a running service.
- Documentation must describe `url` as an HTTP(S) URL or local JSON path rather than a network-only field.
- The implementation is confined to `openapi-skill-node`; Java core and the Spring Boot Starter remain unchanged.

Evidence: the Node suite passes 49 tests after adding config resolution and end-to-end local-source coverage, including
missing-file and byte-limit failures that preserve the previous Skill.

## 2026-09-20 - Make OpenSpec The Single Workflow Source

Status: Accepted and implemented

Context:

- OpenSpec adoption initially added a detailed workflow section to root `AGENTS.md`, including per-tool command names,
  CLI references, directory meanings, and lifecycle rules.
- Those rules are also provided by `openspec/config.yaml`, the files under `openspec/`, and the generated OpenSpec
  skills. Keeping a copied manual in `AGENTS.md` creates two sources that can drift after an OpenSpec CLI or workflow
  upgrade.
- Root `AGENTS.md` still contains project-specific rules that OpenSpec does not own, including the mandatory codex
  document first-read, red-to-green testing, documentation synchronization, verification, and normal push delivery.

Decision:

- OpenSpec is the single workflow source of truth for spec-driven development, change lifecycle, and agreed behavior.
  Agents must invoke the applicable OpenSpec workflow for nontrivial features, refactors, and architectural changes.
- Root `AGENTS.md` is retained but narrowed to repository-specific engineering rules. It must not duplicate OpenSpec
  command tables, CLI references, artifact language settings, directory explanations, or lifecycle instructions.
- `openspec/` remains the tracked source for OpenSpec configuration, current specs, active changes, and archived
  history. The generated `.agents/`, `.claude/`, and `.codebuddy/` trees remain ignored and refreshable through
  `openspec update`; they are not hand-maintained source.
- `docs/codex/` continues to record product context, module responsibilities, task status, and durable ADR history.
  It must describe the governance boundary without becoming a replacement for current OpenSpec specs.

This supersedes the 2026-09-20 OpenSpec adoption decision's instruction to record the CLI surface and per-tool command
spelling in `AGENTS.md`. That record moved into generated OpenSpec skills, which are refreshed with the installed CLI.

Alternatives considered:

- Keep a complete OpenSpec command table in `AGENTS.md`. Rejected because it creates a second manual that drifts when
  generated skills or CLI behavior change.
- Delete `AGENTS.md` entirely. Rejected because it would discard repository-specific engineering and delivery rules
  that are not owned by OpenSpec.
- Move the full repository rulebook into `openspec/config.yaml` context. Rejected because that context is attached to
  planning artifacts and is not the right home for commit, first-read, and verification policy.

Consequences:

- New agents can find concrete OpenSpec invocation through the applicable generated OpenSpec skills; root instructions
  only establish precedence and project engineering constraints.
- Future OpenSpec command or skill wording changes should be absorbed by regenerating skills rather than editing
  `AGENTS.md`.
- Product code, generated output, dependencies, and release behavior are unchanged; this is a governance and
  documentation decision.

Evidence: the change `streamline-agent-governance` is a `skip_specs: true` documentation/governance change. Root
`AGENTS.md` was reduced to governance precedence plus repository engineering rules, and `openspec validate` accepts the
zero product-spec delta. The generated agent trees remain outside tracked edits.

## 2026-09-20 - Read A Value Domain Where The Document States It

Status: Accepted and implemented

Context:

- A producer may declare the accepted values of a field in the `description` alone, leaving the type
  `integer` or `string`. SpringDoc does exactly this when a field is typed `Integer` and the schema
  annotation lists the meanings. The resulting document carries no `enum` keyword at all.
- A reader of the generated Skill then sees a field that looks unconstrained, even though the source
  document states its value domain in prose. The reader either types it as an open `number`/`string`
  or invents a set of values the document never named.
- The generator cannot fix this by parsing: extracting `1 超级管理员，2 普通管理员` out of free text
  with a regular expression is unreliable, and synthesizing an `enum` the document never declared
  would violate the faithful-export rule stated in `PROJECT_CONTEXT.md`.

Decision:

- Keep the generated output a faithful export. The generator must not synthesize an `enum` and must
  not rewrite the description. A stated value domain reaches the generated files verbatim.
- State the rule where the reader acts on it, following the point-of-use precedent of
  2026-09-14. `references/conventions.md` gains a `## Value domains` section declaring that a value
  domain may be stated by an `enum`, by a `const`, or in a `description`; that an `enum` and a
  `description` that disagree must be reported rather than silently resolved; and that an unstated
  domain is a question to ask of the API owner, never a gap to fill by inventing values.
- Repeat the guidance in `SKILL.md` so both levels agree, and keep the Java and Node copies of that
  text identical. The Node copy is a hand-maintained mirror; the two must not drift.
- Record the case in the producer testbed rather than only in a synthetic unit test. `UserView.role`
  is typed `Integer` with the value domain stated in its description, so the fixture, the contract
  test and the Skill end-to-end path all exercise a description-stated domain.
- Do not make a missing `enum` a generation failure. The upstream authoring habit is not a generator
  defect, and rejecting such input would break the faithful-export boundary.

This changes generated output, so it ships as `2.1.1-SNAPSHOT` source with a future release and tag.

Evidence: the new core test `explainsEnumerationSemanticsWithoutInventingValues` failed on the
description assertion before the conventions section existed, then passed; the Node
`generate.test.mjs` assertions mirror it and fail the same way against the pre-change source. The
regenerated fixtures record `role` as `integer` with the stated description and no `enum`, asserted
by `OpenApiContractTest`. Cross-implementation check: generating the same two documents with the
Java and Node generators produced 22 files whose values are identical, with `conventions.md` and
`SKILL.md` byte-identical. An empty-cache `npm ci` in the consumer testbed installed the pinned
`openapi-skill-2.1.1.tgz`, and the end-to-end run against the live testbed wrote 24 files carrying
the new section.

## 2026-09-20 - Adopt OpenSpec As The Development Workflow

Status: Accepted and implemented

Context:

- Planning and agreed behavior were spread across `docs/codex/TASKS.md` (stage table),
  `DECISIONS.md` (ADRs), and the bilingual README, with no single place holding the current agreed
  requirements in a form a coding agent reads before writing code.
- `AGENTS.md` stated a mandatory first read and per-stage rules, but nothing forced a change to be
  proposed, reviewed, and archived as a unit.

Decision:

- Adopt OpenSpec (`@fission-ai/openspec`, CLI `1.13.1`, requires Node >= 20.19.0) as the
  spec-driven development workflow. Any nontrivial feature, refactor, or architectural change starts
  as an OpenSpec change proposal before implementation code is written.
- Initialize with `--tools codebuddy,claude,codex,agents` and `--language zh-CN`, so the repository
  carries instruction trees for the three editors in use plus the universal `.agents/skills` tree.
- Track `openspec/` (specs and change proposals are versioned truth) and ignore the three generated
  instruction trees (`.agents/`, `.claude/`, `.codebuddy/`) with a comment recording that
  `openspec update` regenerates them. Generated instructions are per-machine and per-version output,
  not reviewable source.
- Keep `docs/codex/` as-is. OpenSpec owns *what is being built and what is agreed*; `docs/codex/`
  keeps owning *stages, ADR history, module responsibilities, and build context*. OpenSpec's
  `openspec/specs/` is synchronized by the change itself, not by hand-copied text.
- Originally recorded the CLI surface and per-tool command spelling in `AGENTS.md`; superseded later
  on 2026-09-20 by "Make OpenSpec The Single Workflow Source", which leaves command spelling to
  generated OpenSpec skills and narrows `AGENTS.md` to repository engineering rules.

Consequences:

- Existing `docs/codex/DECISIONS.md` entries remain the historical ADR record and are not migrated.
  New architectural decisions may live in an OpenSpec change's `design.md` while it is in flight; a
  decision that outlives the change is still recorded here.
- The `language: zh-CN` context in `openspec/config.yaml` makes new artifacts Chinese while keeping
  structural headings and SHALL/MUST keywords English, matching the repository's existing split
  between Chinese narrative and English contract language.

Evidence: `openspec init` created `openspec/{config.yaml,specs/.gitkeep,changes/archive/.gitkeep}` plus
6 skills and 6 commands under each tool tree. `openspec doctor` reports `OpenSpec root: ok`,
`openspec list` reports no active changes, and `openspec init` reported setup complete for all four
selected tools. `git check-ignore -v` confirms all three generated trees are ignored and
`openspec/config.yaml` is not. Official setup steps and the tool list were read from the project's
README on 2026-09-20; the registry was queried directly rather than through `npm view`, which
resolves this package incorrectly (a bare `openspec` placeholder exists at 0.0.0 and is unrelated).

## 2026-09-18 - Commit The One Tarball The Consumer Lockfile Pins

Status: Accepted and implemented

Context:

- `testbeds/vue-ts-consumer/package.json` and its lockfile reference
  `file:../../openapi-skill-node/openapi-skill-2.1.0.tgz`, but `.gitignore` ignored
  `openapi-skill-node/*.tgz`, so no tarball was ever tracked and a fresh clone could not install.
- On a clone with an empty npm cache, `npm ci` fails with `ENOENT` after first reporting
  `tarball data ... seems to be corrupted`. The message points at package contents rather than the
  real cause, the missing path.
- The failure is invisible on a machine whose npm cache already holds that tarball: npm restores it
  from cacache by the lockfile integrity, so `npm ci` passes locally while failing on every new
  machine and in CI.
- Repacking from source does not fix it. `npm pack` is deterministic only for a fixed line-ending
  checkout. `core.autocrlf=true` (the Git for Windows system default) checks out CRLF, `tsc` emits
  CRLF into `dist/`, and the packed sha512 then differs from the lockfile integrity, producing
  `EINTEGRITY`. Measured: 29,108 bytes / shasum `b155643989b6121e1c1b701affaffb71e7ac4be9` from an LF
  checkout versus 29,289 bytes / shasum `fc8762657b6e1f8b7fb4941c872f00ccedac60dc` from a default
  CRLF clone; the difference is exactly the line endings of the five files holding multi-line text.

Decision:

- Track exactly one tarball, the version the consumer lockfile pins, through a negated `.gitignore`
  exception (`!openapi-skill-node/openapi-skill-2.1.0.tgz`). Every other `openapi-skill-node/*.tgz`
  stays ignored, so packing remains a local build step that does not otherwise enter the repository.
- Keep the consumer on the packed tarball instead of switching to a directory dependency, so the
  package `files` whitelist and the compiled output keep being exercised exactly as published.
- Whenever the pinned version changes, update the exception path, the `package.json` reference, and
  the lockfile `resolved`/`integrity` together.
- Do not add a repository-wide `.gitattributes` with `eol=lf` in this change: the fixture snapshots
  in `testbeds/springdoc-multi-package/fixtures/` carry sha256 values in `metadata.json` computed over
  their CRLF bytes, so forcing LF would invalidate those records and change test input bytes. The
  line-ending reproducibility problem is recorded as its own slice.

Evidence:

- Fresh clone with an empty npm cache: `npm ci` failed with `ENOENT` and the misleading
  "seems to be corrupted" warning before this change, and passes after it.
- `git clone -c core.autocrlf=false`, then `npm ci && npm run build && npm pack`, reproduces 29,108
  bytes / shasum `b155643989b6121e1c1b701affaffb71e7ac4be9`, byte-identical to the committed tarball
  the lockfile pins — so the tarball is verifiable, not merely present.
- Full measurements and the failing npm output are in `testbeds/vue-ts-consumer/CLOSURE-REPORT.md`.

## 2026-09-18 - Accept OpenAPI 3.0.x And 3.1.x Root Markers

Status: Accepted and implemented test-first in Java and Node

Context:

- The compiler accepted one exact root marker, `openapi: 3.1.0`. Every other marker failed with
  `UNSUPPORTED_VERSION` before a single document byte was fetched.
- SpringDoc 2.8.15 defaults to OpenAPI 3.1, but the Node CLI is producer-agnostic. NestJS (`@nestjs/swagger`),
  .NET Swashbuckle, swaggo, and hand-exported specifications emit `3.0.x`, so a real consumer project was rejected on
  its root marker alone.
- The earlier decisions deferred OpenAPI 3.0 and "other OpenAPI 3.1 patch versions" rather than rejecting them on
  technical grounds.
- The compiler does not interpret JSON Schema semantics. `DocumentReferences` copies source nodes verbatim and links
  document-local JSON Pointers; it reads semantics in only three places — the root version marker, `security`/`servers`
  inheritance, and first-tag grouping — and those are identical in 3.0 and 3.1.

Decision:

- Accept any textual `openapi` value matching `3.[01].<digits>`. Reject everything else, including `3.2.x`, `2.0`, and
  the unsuffixed `3.1`, with `UNSUPPORTED_VERSION`.
- Record the input's own root marker in `references/source.json` instead of the previous hard-coded `3.1.0`. Provenance
  that misreports the dialect would make the snapshot's claim false.
- Capture real 3.0 snapshots from the existing testbed producer (`OpenApi30ContractTest`, property
  `springdoc.api-docs.version=OPENAPI_3_0`) beside the existing 3.1 snapshots, and consume both from core and Node tests.
- Leave `references/conventions.md` unchanged. It states absent/null/empty semantics only and contains no version claim,
  so every byte of existing 3.1 output stays identical.

Evidence:

- springdoc 2.8.15 emits `3.0.1`, not `3.0.0`. An exact-`3.0.0` gate would have rejected the very producer the fixture
  comes from, so the patch range is a measured requirement rather than convenience.
- Rebuilding the Vue consumer tree with the changed source produces a byte-identical 24-file tree, whole-tree SHA-256
  `745f0e0ec44a9eda52fb0868c00c0600b193307b19e2b39f0966f752721148bc`, unchanged from the tree the published `2.0.0`
  generated. The `openapi-skill-core/3` layout and its published hash remain valid.
- The same producer under 3.0 drops siblings of `$ref`: `UserView.address.description` and
  `CreateOrder.shippingAddress.description` are present under 3.1 and absent under 3.0. The compiler copies bytes and
  must not invent them back; both dialects' snapshots record this.
- Java passes 77 core tests and Node passes 43. Both suites compile the 3.0 snapshots and assert the recorded marker.

Consequences:

- Both dialects share one code path. No dialect-specific adapter, normalization step, or second pipeline was added.
- OpenAPI 3.0 `nullable`, boolean `exclusiveMinimum`/`exclusiveMaximum`, and `$ref` sibling semantics pass through as
  source text; the compiler claims nothing about them beyond copying bytes.
- Swagger 2.0, YAML, `3.2.x`, and cross-service aggregation remain deferred.

Alternatives considered:

- Accept only the exact `3.0.0` marker. Rejected because springdoc emits `3.0.1` and swagger-core emits `3.0.3`; a
  patch-exact gate rejects real producers.
- Accept every `3.x`. Rejected because 3.2 changes the document model and no fixture exists for it.
- Normalize 3.0 input into 3.1 before compiling. Rejected because it would rewrite source bytes, invalidate the recorded
  digest, and invent semantics the producer never emitted.
- Add a 3.0 section to `references/conventions.md`. Rejected because that shared file would change every tree and
  invalidate the published core/3 hash for no reader benefit.

## 2026-09-17 - Use A Single Version Tag Per Release Line

The repository had accumulated two tag shapes: `v1.1.0`/`v1.2.0` marking Maven Central release commits and
`smartdoc-agent-node-v1.4.0` marking an npm release. When `2.0.0` shipped to npm and Maven Central from one source
revision, there was no agreed rule for how many tags to create.

Use exactly one annotated tag per released version, `v<version>`, placed on the commit that cuts the release version.
The parallel Node-prefixed namespace is retired; `smartdoc-agent-node-v1.4.0` stays in history as a legacy tag and is
not moved or deleted. `v2.0.0` sits on `c221a3a` and covers both registry lines.

Rationale: both registries publish the same source revision, so a second tag would encode a distinction the build does
not have. One tag per version keeps `git describe` unambiguous and avoids guessing which coordinate a tag refers to.

Rejected alternatives:

- Keep a separate Node tag per npm release. Rejected because the Node and Java artifacts are cut from one commit;
  the prefix only made sense while the two packages versioned independently.
- Tag the documentation commit that records the release instead of the version-cut commit. Rejected because the tag
  would then point at prose rather than at the published sources.

Operational note: `git push` does not push tags, so a release is only complete after an explicit
`git push <remote> v<version>`.

## 2026-09-16 - Group Document Operations By Their First OpenAPI Tag

Status: Accepted and implemented test-first in Java and Node; unused 1.x numbers were never released

A real 124-operation OpenAPI 3.1.0 document (UAV Hub, 19 tag groups) produced a `context.md` that had to be read
completely before any interface could be opened, and the consumer reported the resulting prompt as too large. Measure
that as the design driver: the old per-document context was 28,084 bytes, of which a 2,644-byte raw JSON head
(`info`/`servers`/`security`/`tags`/`securitySchemes`) was mandatory reading for every question.

Group every document's operations by `tags[0]` — the operation's **first** OpenAPI tag — into one file per tag under
`references/documents/<docId>/groups/<tag>.md`. A tag name is used as the file name verbatim when it is path-safe, so
Chinese tag names stay readable (`用户管理.md`, `订单管理.md`); an operation with no tag at all goes to `untagged.md`.
An operation belongs to exactly one group, so the trusted instructions tell a reader to check the document's other
groups before concluding that an interface is undocumented. A tag declared more than once in `tags[]` contributes
every distinct description to its single file rather than creating a second file.

`context.md` stops being a per-operation directory and becomes a small group index: document keywords plus one link
per group with its interface count. Documented `servers` and `securitySchemes`/`security` facts move to the service
`catalog.md` as readable prose produced by a dedicated renderer, so a raw contract dump leaves the mandatory-read path
while the catalog still repeats the document's server addresses and authentication facts. Each group entry is one line,
`- [<semantic title>](../operations/<file>.md) — \`METHOD /path\``. `Source operationId` and `Tags` are dropped from
entries because the file path already identifies the contract and the group already states the tag; both remain
recoverable from `operations.jsonl`, which gains `group` and `groupFile` columns. The group index accepts CJK content,
so the publisher and both validators now accept Unicode generated paths instead of an ASCII-only allowlist.

Raise the semantic filename bound from 48 to 72 characters. The 48-character cap silently truncated real names —
`delete-drone-terra-reconstruction-model-file-by-f.md` lost the `fileId` that made it searchable — while the longest
stem in the sample document is 55 characters. Group files need a separate stem function: the ASCII `slug()` collapses
every CJK tag to the same `item` stem (19 tags produced 3 distinct stems), so tag stemming preserves `\p{L}\p{N}_-`
across scripts, normalizes to NFC, and still applies the collision and reserved-name fallbacks.

The changed required layout is `openapi-skill-core/3`. Because this breaks the generated tree that the published
artifacts produce, advance the npm package to `2.0.0` and the Maven reactor to `2.0.0`. Registry state at the
time of the decision, read directly rather than assumed: npm `openapi-skill` has `1.0.0` and `1.1.0` (`latest`),
Maven Central `io.github.fyuanz:openapi-skill{,-core,-spring-boot-starter}` has `1.0.0`, and the npm `1.1.0` tarball
shasum `2a2837a61ce3ddf5bb752f4620df12d0eaa3041c` equals the local file. The `1.1.0` Maven and npm numbers that were
never released are skipped rather than reused. Publication remains a separate, user-performed action.

Evidence:

- Node passes 41 tests (40 before this slice) and the Java reactor passes 71 (69 core + 2 Starter) on `mvn -B clean
  install`; the standalone SpringDoc testbed passes 6.
- On the 124-operation sample the generated tree is 151 files: `context.md` 1,660 B, `catalog.md` 513 B, 19 group files
  with the largest at 2,621 B. The worst-case mandatory read falls from 28,084 B to
  `catalog + context + largest group` = 4,794 B, about 17% of the former context.
- The runtime ZIP from the live SpringDoc testbed and the Node project's nested service tree contain the **same 21
  files in the same paths**, including the three Chinese group files. Six are byte-identical (`conventions.md`,
  `operations.jsonl`, `schemas.jsonl`, and all three group files), eleven are identical after re-serializing fenced
  JSON blocks, and the remaining four differ only by consumer-configured `sourceType`/keywords and the runtime's
  default `skillName`.
- The consumer testbed failed first with
  `OUTPUT: unsafe generated path .../groups/用户管理.md` — an ASCII-only path allowlist that the unit tests never
  reached. A new failing test reproduced it exactly before the fix.

Alternatives considered:

- Keep one flat `context.md` and rely on size. Rejected: it is the reported defect.
- Merge tags whose names look similar (for example two `设备管理` declarations). Rejected as unnecessary — grouping
  by `tags[0]` already puts both under one file, and OpenAPI tag names are the contract's own vocabulary, not
  something the generator should second-guess.
- Transliterate or slugify Chinese tag names to ASCII. Rejected: it discards the searchable vocabulary the contract
  already provides, and the 48-character truncation was a defect to remove, not a reason to keep naming lossy.
- Use `operationId` as the entry title. Rejected: it is optional and not guaranteed unique.

Known divergence recorded rather than silently accepted: Java (Jackson) and Node (`JSON.stringify`) indent embedded
JSON differently, so the eleven operation/schema files above are not byte-identical across implementations. This is
pre-existing, confined to pretty-printing inside Markdown code fences, and does not affect any parsed value; aligning
the serializers is deferred as its own slice instead of being rushed into this one.

## 2026-09-16 - Require Clean Builds For Inspected Artifacts And Self-Describing Tree Hashes

Status: Accepted as a verification rule

`mvn -B install` without `clean` packaged stale `com.smartdoc.agent.*` classes, left behind in `target/classes` by the
product rename, into `openapi-skill-core-1.1.0-SNAPSHOT.jar`. The same source with `mvn -B clean install` passes the
same 70 tests and yields 17 `io.github.fyuanz.*` classes with zero legacy entries. Any build whose output is inspected,
compared, or released must therefore run `clean` first; a green non-clean build says nothing about artifact contents.
This is not a source defect — the rename commit is correct — but it would have shipped a wrong JAR if a release had been
cut from that working tree.

Whole-tree determinism hashes must be recorded together with their normalization algorithm. Earlier entries recorded
bare digests (`b8940cff…`, `253e8c9d…`) produced by verification scripts that lived under the gitignored `target/`
directory and were not retained, so those values can no longer be reproduced or compared. The durable form is
"sha256 over the sorted `relpath\0sha256(content)` lines of the tree" plus the value; the current 21-file Vue consumer
tree is `99547bf1a8b8…` under that definition.

Alternatives considered:

- Keep building without `clean` because it is faster. Rejected: it hid a rename defect inside the published artifact.
- Record only the bare hash for brevity. Rejected: unreproducible evidence is worse than no evidence for a determinism
  claim, and it cannot be compared against a later run.

## 2026-09-16 - Make Document Context The LLM Navigation Surface

Status: Accepted and implemented test-first in Java and Node; registry publication remains separate

Replace the current LLM-facing JSONL-search workflow with deterministic Markdown navigation. Each OpenAPI document keeps
exactly one `context.md`, and that page becomes its complete interface directory: document description, explicitly
documented server and security facts, configured document keywords, and one direct link per operation with method/path,
summary, and tags. A document-level context is accepted as bounded, so pagination, sharding, and size-based splitting are
not proposed. Root and project catalogs continue to select a service/document and then link into its context.

Trusted `SKILL.md` instructions start from context and follow operation links. They do not require an LLM host to provide
`grep`, `jq`, JSONL parsing, or targeted file search, and they do not direct the model to open a complete
`operations.jsonl` or `schemas.jsonl`. Retain both JSONL files in this slice as deterministic machine/validator artifacts
and compatibility data, not as the human or LLM navigation contract.

Remove the routine digest suffix from operation and Schema filenames. ServiceId and documentId already isolate services
and documents. Allocate filenames in two deterministic passes within each directory: a unique safe semantic slug uses a
clean `.md` name; only a real case-insensitive collision group or a safe-encoding/path-length fallback receives a short
deterministic suffix. Keep full source digests in provenance. Do not use optional or duplicate-prone `operationId` as the
primary identity.

Precompute the complete document-local Schema/reference closure for every operation. The operation page lists direct and
transitive contract links in stable order, de-duplicates shared targets, terminates recursion with a visited set, and
records recursive edges. Schema bodies remain authoritative separate files and are not copied into every operation.
This removes multi-hop closure derivation from the LLM while retaining document-local reference semantics.

Security navigation must distinguish a defined security scheme from an explicitly declared document default, an
operation override, and an unstated fact. A scheme definition alone is not rendered as a global requirement. OpenAPI
summaries, descriptions, tags, examples, and configured navigation labels remain reference data and never become trusted
instructions or authorization to invoke an API.

The changed required layout and navigation contract is `openapi-skill-core/2`. Java and Node implement it with mirrored
contract tests, validators and project assembly; publishers recognize an owned core/1 tree only for safe atomic
replacement. Runtime and Vue consumer evidence is regenerated as part of the implementation. Publication remains a
separate explicit action and is not authorized by this decision.

Alternatives considered:

- Delete JSONL immediately. Deferred because it still provides compact deterministic machine validation and a
  compatibility surface without needing to remain in the LLM workflow.
- Remove every digest with no fallback. Rejected because normalization, truncation, Unicode, and case-insensitive
  filesystems can map distinct identities to the same path.
- Split a large document context into pages. Rejected for this proposal because the user explicitly accepts one
  document-level context as sufficiently bounded.
- Ask the LLM to traverse direct `$ref` links recursively. Rejected because multi-hop, shared, and cyclic graphs create
  avoidable omission and hallucination risk that the deterministic generator can remove.

## 2026-09-16 - Remove Maven Build-Time Compatibility Completely

Status: Accepted and implemented

The user explicitly chose not to retain Maven build-time compatibility. Remove `openapi-skill-maven-plugin`, its static
integration testbed, reactor membership, Central release entry, and active documentation. The new Java release contains
only the parent POM, core, and runtime Spring Boot Starter. Spring Boot applications use the runtime ZIP endpoint;
cross-service project Skills use the published npm CLI. Historical artifacts under the old product coordinates remain
immutable, but no Maven `generate-skill`, static-JSON lifecycle, or aggregate/both compatibility is promised under the
new `openapi-skill` coordinates. This supersedes the compatibility portions of earlier decisions without rewriting
their historical evidence.

## 2026-09-16 - Rename The Product And Start New Package Identities At 1.0.0

Status: Accepted and implemented; publication remains manual

Rename the repository and product to `openapi-skill`. Use the GitHub remote
`https://github.com/fyuanz/openapi-skill.git`, npm package and CLI `openapi-skill`, config file
`openapi-skill.config.json`, package key `openapiSkill`, Maven artifacts `io.github.fyuanz:openapi-skill*`, and Java
namespace `io.github.fyuanz.openapi.skill.*`. Rename runtime-facing identities to `openapi.skill.runtime.*`,
`/openapi-skill/skill.zip`, `.openapi-skill/`, and generated format `openapi-skill-core/1`.

Because npm and Maven artifacts receive new identities, start both at `1.0.0`. Previously published
`smartdoc-agent` and `smart-doc-agent` / `smartdoc-agent-*` artifacts remain immutable historical releases. Prepare and
verify the new npm tarball and Maven reactor, but do not publish either registry; the user will perform those credentialed
release actions. This decision supersedes current-name/version statements in older decisions without rewriting their
historical evidence.

## 2026-09-15 - Use Semantic Core/3 Indexes And Centralized Reading Conventions

Status: Accepted; implemented test-first in Java and Node

Generate new service trees as `smartdoc-agent-core/3`. Operation and schema primary keys describe their identity
directly (`operation:<service>:<document>:<method>:<path>` and
`schema:<service>:<document>:#/components/schemas/<name>`); SpringDoc `operationId` is retained only as nullable
`sourceOperationId` metadata. Generated contract filenames use a bounded ASCII semantic slug and a six-hex SHA-256
discriminator. Six characters are the normal form because collisions are rare; a detected case-insensitive filename
collision extends only that suffix by four characters at a time. Full SHA-256 remains in `source.json` for source
integrity, not navigation.

Each service reference tree includes sorted, compact `operations.jsonl` and `schemas.jsonl`. These are deterministic
machine lookup tables, not a search service or duplicated contract store: every row points to the authoritative Markdown
file and the validator rejects duplicate/unsorted IDs, missing targets, and count drift. Project Skills retain these
indexes inside each physical service subtree instead of building a second global copy. The trusted `SKILL.md` tells an
LLM to start from the target source file, extract method/path, search the operation index, and open only the matching
operation plus its linked schema/reference closure. This directly reduces broad catalog and repository scanning without
introducing RAG, embeddings, a database, or network dependency.

Keep `catalog.md` as a small human entry point with document context, counts, and links to the two indexes; remove its
exhaustive operation/schema listings and generated tag files. Tags remain searchable in operation-index rows and
document context. Move common OpenAPI absent/null/empty/default interpretation into one
`references/conventions.md`, linked from generated operation and schema files. Only genuinely operation-specific notes,
such as explicit empty security, remain inline. Publishers accept owned core/1 and core/2 trees for safe replacement,
but all newly generated service and project trees use core/3. Node source advances to `1.5.0`.

Follow-up 2026-09-15: the user manually published `smartdoc-agent@1.5.0`; registry verification reports
`dist-tags.latest = 1.5.0` and publication time `2026-09-15T09:19:57.619Z`.

Alternatives considered: retain full hashes (deterministic but costly to read), use SpringDoc operationId as identity
(not stable or guaranteed unique), put every row in catalog (poor targeted retrieval), or add RAG immediately (extra
operational complexity without evidence it is needed). All were rejected for this slice.

## 2026-09-15 - Generate One Self-Contained Node Project Skill For Multiple Services

Status: Accepted; verified end to end and released as `smartdoc-agent@1.4.0` on npm on 2026-09-15

Make one API-documentation Skill the normal unit for a consuming project. The preferred Node configuration has a
top-level `services` array and one optional top-level `skillName`, defaulting to `api-docs`. A service has a stable
`serviceId`, optional `sourceType=internal|third-party`, optional service keywords, and one or more explicitly configured
document ID/HTTP(S) URL pairs with optional document keywords. A project may also define project keywords. Service IDs
are unique within the project; document IDs are unique only within their service. Service-level `skillName` is rejected
because one project produces one installable Skill.

Keep the previous top-level `serviceId`, `skillName`, and `documents` configuration as a compatibility mode. It continues
to generate the existing `smartdoc-agent-core/1` single-service layout and still requires an explicit `skillName`.
Project and legacy shapes cannot be mixed, so configuration meaning remains unambiguous.

Generate project output as `smartdoc-agent-core/2`, `kind=project`, with exactly one trusted root `SKILL.md`, one root
service catalog, and one root provenance file. Build each service through the existing contract-preserving generator,
discard its intermediate `SKILL.md`, and physically include its complete reference tree beneath
`references/services/<serviceId>/references/`. Root and service catalogs use relative Markdown links. Do not create
filesystem symbolic links, depend on separately installed service Skills, merge OpenAPI objects, resolve references
across documents, infer gateway routes, or treat same-named schemas as shared types.

Root provenance retains sorted full member metadata plus a flattened service/document index. Each service records its
source type and service keywords; each document records its document keywords and existing input digest/version/count
facts. The project publisher validates core/2 project shape, sorted unique services, allowed source types, exact nested
provenance equality, flattened document membership, safe paths/links, and the absence of nested Skill entrypoints.

Keywords are trusted explicit configuration, not OpenAPI free text. At every configured level, trim and NFC-normalize,
reject controls and non-text values, de-duplicate and sort, allow at most 16 values, and bound each value to 1-64 printable
characters. Keep complete legal lists in catalog/provenance. Only a bounded project/service subset enters the single-line
root description; document keywords guide navigation after the Skill is selected. This preserves the 1024-character
frontmatter limit without sacrificing document-level search terms.

Treat all configured services/documents as one atomic project update. Download every source under the shared timeout and
input budget, generate and validate the full tree in staging, then replace `<output>/<skillName>` only after success.
Any download, parse, generation, provenance, link, or publication failure retains the previous complete Skill; never
publish a mixed old/new or partial service set. Permit 1-32 services, at most 32 documents across the project, at most
32 MiB total input, 10,000 generated files, and 64 MiB output while retaining the 8 MiB per-document and existing
document-local reference bounds.

This is client-side aggregation from URLs the project owner explicitly configured. It does not authorize the embedded
Spring Boot Starter to discover or fetch other services, and it does not add service-registry, gateway, repository, or
cross-project synchronization behavior. The Node source version is `1.4.0`, published to npm as the unscoped
`smartdoc-agent` on 2026-09-15 with `latest` resolving to it. Current test-first
evidence is 23 passing Node tests across configuration, deterministic generation, keyword/source-type metadata, strict
project validation, project-wide document/byte budgets, complete download/publication, failure retention,
stale-member removal, default project naming, and legacy compatibility; the packed tarball was additionally verified
end to end in the real Vue consumer against the running SpringDoc testbed.

Alternatives considered:

- Install one Skill per service and have a root Skill link to them. Rejected because discovery becomes fragmented and
  copied packages, Windows hosts, and npm archives cannot guarantee those external targets exist.
- Use operating-system symbolic links between service trees. Rejected because they are permission- and platform-sensitive,
  may not survive packaging, can escape the Skill root, and weaken complete-tree validation.
- Merge all service OpenAPI documents into one contract. Rejected because service/document identity, same-named schemas,
  servers, security, and local references would become ambiguous.
- Put every document keyword in root frontmatter. Rejected because it scales poorly and can exceed or dilute the trusted
  Skill discovery description; document keywords belong in service navigation and provenance.

## 2026-09-15 - Publish The Node Consumer Under An Unscoped Name With Chinese-First Documentation

Status: Accepted

Rename the Node package from `@fyuanz/smartdoc-agent` to the unscoped npm identity `smartdoc-agent`. Keep the executable
name, library exports, configuration file, generated format, and runtime behavior unchanged. Update the Vue consumer
fixture to use the new tarball identity; earlier closure evidence may retain the scoped name because it describes the
package that was installed during that historical run.

Make `smartdoc-agent-node/README.md` the default Chinese package guide and add an equivalent `README.en.md`, with
reciprocal language links. Include both files in the published tarball so npm and local-package consumers receive both
guides. Registry publication remains an explicit credentialed release action, separate from this repository change.

Evidence: the package identity/documentation test failed first on the missing English guide, then all 9 Node tests
passed. `npm pack --json` reported the unscoped name, the expected tarball filename, and both README files. The updated
Vue consumer installed the new tarball and passed its strict production build. A direct no-cache request to the official
npm registry returned HTTP 404 for `smartdoc-agent` on 2026-09-15, confirming it was unoccupied at verification time.

Follow-up 2026-09-15: the name was then claimed by this account and `smartdoc-agent@1.4.0` was published, becoming
`latest`. The registry artifact was confirmed byte-identical to the locally packed tarball, so the 404 above records
only the state at rename time and must not be read as the current package status.

## 2026-09-14 - Make The Skill Description A Bilingual Action-Triggered Trigger

Status: Accepted

Replace the keyword-list `description` with a single bilingual action sentence. An LLM selects a Skill by matching the
task it is doing, so the description names the tasks first — 查找、解释、实现或调试 / finding, explaining, implementing,
debugging frontend HTTP API calls — then the navigation path (locate endpoints via the catalog), the verification work
(parameters, request bodies, responses, status codes, schemas, authentication, errors), and the deliverable (generate or
modify frontend request code). A bilingual keyword tail keeps low-cost lexical matches in both languages. The aggregate
Skill uses the same shape with cross-service wording.

Only validated identities (serviceId, document IDs) are interpolated. Untrusted API source text such as info titles,
tags, and summaries still never enters the template, so domain synonyms (账单/计费/发票 style) cannot be sourced from the
contract; a user-configurable description override is deferred future work.

The description must remain one YAML plain scalar under 1024 characters. ASCII `: ` is forbidden inside the value, so
the sentence uses full-width punctuation and em-dashes. `boundedList()` bounds the interpolated group/member list —
sorted, `/`-joined, truncated past 200 characters with an explicit `…(+N)` marker — which keeps the worst case of 32
maximum-length identities inside the limit.

Evidence: the rewritten Java metadata test failed first on every new assertion, and the new 32-group bound test failed
before `boundedList` existed; the full reactor then passed 80 tests. The Node port mirrors both tests (7 passing). The
regenerated Vue-consumer Skill shows the final 587-character single-line description.

## 2026-09-14 - State OpenAPI Default Semantics At The Point Of Use

Status: Accepted

The consumer audit found that operation files faithfully export `security: null`, absent `required` lists, and
document-local same-named schemas, but a reader cannot tell an unstated fact from a declared one. Fix at the point of
use rather than in a distant convention note: every operation file ends with a "How to read the defaults above" section
generated from the contract, stating that null `security`/`servers` means the document does not state the fact (not
that authentication is unnecessary), an absent `required` list is an undeclared constraint, same-named definitions stay
within their source document, and only an explicit empty value is a declared override. `SKILL.md` repeats the guidance
so both levels agree.

The generated files remain faithful exports — no value is invented or merged. This changes generated output, so it
ships as `1.3.0-SNAPSHOT` source with a future release and tag, following the test-first core process.

Evidence: the Java semantics test and its Node equivalent failed before `DocumentReferences.semantics` existed, then
passed with all four operation files carrying the section; the explicit-empty-security case is asserted as a declared
override. Full reactor 80 tests, Node 7 tests, and the regenerated consumer Skill verified end to end.

## 2026-09-14 - Verify The Consumer Side With A Real Vue 3 Project

Status: Accepted

Add `testbeds/vue-ts-consumer` as a real Vue 3 + TypeScript consumer rather than another producer fixture. Every earlier
testbed verifies generation or publication; none verified that a real frontend project can install the Node package,
generate the Skill from a running service, and integrate against the documented contract. This testbed closes that gap.

The consumer installs `@fyuanz/smartdoc-agent` from a locally packed tarball instead of a registry, because npm
publication is still a separate credentialed action. Its typed client is written against the live OpenAPI documents, and
all calls go through a Vite dev-server proxy so they exercise genuine HTTP against the running testbed. Generated output
(`node_modules/`, `dist/`, `.agents/`) stays gitignored: the Skill is a build artifact and is regenerated on demand.

Scope boundary: this adds a consumer testbed only. It does not change core, Starter, Maven plugin, or Node package
behavior, and the recorded readability gaps in three OpenAPI default-semantics cases are documented rather than fixed,
because fixing them would alter generated output and require a new version and tag.

Evidence: `npm run build` passes strict type checking; seven live call scenarios across all five operations match the
generated contract; an independent read-only Skill audit could produce a correct typed client and reported three
readability gaps, each verified against source data in `testbeds/vue-ts-consumer/CLOSURE-REPORT.md`.

## 2026-09-14 - Add A TypeScript npm Consumer For Multi-URL Skill Generation

Status: Superseded for package identity/documentation and as the preferred configuration by the 2026-09-15 decisions;
the single-service generation behavior remains accepted as compatibility mode

Add `smartdoc-agent-node` as the publishable `@fyuanz/smartdoc-agent` package for Vue 3 and other Node.js 20+ projects.
The consuming project explicitly maps each document ID to an HTTP(S) OpenAPI URL; all documents form one atomic service
input and retain document-local references rather than being semantically merged. The default output parent is the
consumer root's `.agents/skills`, with relative and absolute overrides supported.

Keep the Java core's exact OpenAPI 3.1.0 boundary, identities, size/count limits, contract rendering, effective
parameter/server/security behavior, reference restrictions, metadata version, and complete-tree validation. URL
acquisition belongs only to this explicit Node CLI boundary: redirects and external `$ref` values remain rejected, and a
failed download or validation cannot replace a previous valid Skill. npm publication itself is a separate credentialed
release action; the repository delivers a tested, packable package without claiming it has been published.

Evidence: five Node tests cover deterministic two-document fixture generation, inherited overrides, local/external
reference boundaries, loopback HTTP download, default/custom output, and retention after download failure.

## 2026-09-14 - Publish Runtime Skill ZIP As Maven Central 1.2.0

Status: Accepted and executed

After confirming the Chinese, English, and Starter READMEs are updated, the user explicitly authorized publication.
Release the four-module reactor as immutable `io.github.fyuanz:1.2.0` using the existing `central-release` profile,
BC GPG signer, Central Portal auto-publish flow, and signing identity already documented for 1.1.0. The release adds
`smartdoc-agent-spring-boot-starter`; parent, core, and Maven plugin remain part of the same versioned reactor.

Bump the two non-published testbeds to consume the final `1.2.0` coordinates, rerun all unit and real runtime checks,
verify signed artifacts before upload, wait for Central `PUBLISHED`, and tag the exact release source as `v1.2.0`.
Central versions and tags are immutable; do not overwrite or force-push existing history.
This decision supersedes the earlier runtime-migration statement that 1.2.0 publication was not authorized.

Execution completed with deployment ID `5e3eba4c-1cc5-4feb-b720-93694413d290` in `PUBLISHED` state. The clean signed
reactor generated 13 independently verified signatures with fingerprint
`B8EDC9D7B1AEBDCA56A1DA28FD9316D8966A3116`; representative parent/core/plugin/Starter artifacts returned HTTP 200
from Maven Central. Verification and the exact tag/commit are recorded in TASKS.md.

## 2026-09-14 - Replace Build-Time SpringDoc Capture With A Runtime Starter

Status: Accepted and implemented

The user rejects the Maven `verify` chain that starts an application, downloads `/v3/api-docs`, stops the application,
and then generates a Skill. Make an embedded Spring Boot Starter the primary SpringDoc integration. After the normal
application starts, expose `GET /smartdoc/skill.zip`; generate from the current in-process SpringDoc model only when the
endpoint is requested. Do not bind SmartDoc generation to Maven phases or write OpenAPI/Skill intermediates to `target`.

Do not inject an application-defined `OpenAPI` bean as though it were the final document. That bean normally represents
base configuration and may not contain Controller-derived paths. Treat `GroupedOpenApi` as discovery/filter metadata.
Obtain final JSON through SpringDoc 2.8.x's public WebMVC resources: enumerate local groups and call
`MultipleOpenApiWebMvcResource`, or call `OpenApiWebMvcResource` when no groups exist. Supply a wrapped request matching
the SpringDoc document path so server URL calculation is equivalent to its HTTP endpoint, while making no network call.

Auto-configure only Servlet/WebMVC applications with SpringDoc present. Derive serviceId from `spring.application.name`
and default skillName to `<serviceId>-api`; expose only optional enabled/path/identity overrides. Hide the download
controller from OpenAPI to prevent recursive self-documentation. Reuse core unchanged for exact 3.1.0 validation and
Skill rendering, then write sorted fixed-timestamp ZIP entries under one `<skillName>/` root in memory. A failed request
returns no partial archive and changes no filesystem state.

The endpoint inherits the application's security chain and accepts no arbitrary input URL. Cross-service runtime
aggregation, WebFlux, management-port variants, repositories, caching, and installation remain separate work. Retain the
Maven plugin for static JSON and existing explicit aggregate/both users, but remove its runtime chain from the SpringDoc
testbed and stop recommending it for an application's own Skill.

Use development version `1.2.0-SNAPSHOT`; published `1.1.0` is immutable and no new release is authorized. Evidence is
recorded in TASKS.md. This supersedes current-scope statements that ZIP/HTTP download is deferred and that runtime
SpringDoc export at Maven `verify` is the primary workflow.

## 2026-09-14 - Publish Aggregate Skills As Maven Central 1.1.0

Status: Accepted and executed

The user authorized releasing the v3.6 aggregate feature after the 1.1.0-SNAPSHOT verification passed. Publish the unchanged root reactor (parent POM, core, Maven plugin) as immutable `io.github.fyuanz:1.1.0` using the existing opt-in `central-release` profile, BC GPG signer and Central Portal auto-publish flow; reuse signing identity `fyuan <624728873@qq.com>` (fingerprint `B8EDC9D7B1AEBDCA56A1DA28FD9316D8966A3116`). Mark the release source with Git tag `v1.1.0`.

Bump root/core/plugin POMs and both testbed plugin references from `1.1.0-SNAPSHOT` to `1.1.0`; the standalone testbeds' own module versions remain `1.0.0-SNAPSHOT` because they are never deployed. Bilingual READMEs and release documentation describe `1.1.0` as the current version while retaining `1.0.0` as the single-service-only release. Execution evidence (deploymentId `6f9cffda-6cd3-4236-857a-fc5c8a77d961`, 74 tests, nine signatures, testbed regressions, artifact reachability) is recorded in TASKS.md. This adds no new product feature or scope; deferred work stays deferred.

## 2026-09-14 - Accept Testbed Delivery And Add Configurable Aggregate Skills

Status: Accepted

The user removes web/frontend and real-environment acceptance from the plan and will review Skills manually, providing feedback later. Existing generation testbeds are sufficient for the agreed scope. Manual feedback is not an outstanding gate; do not request a frontend or real deployment project to close this work.

Add `outputMode=service|aggregate|both` to the existing Maven goal. Preserve the default single-service configuration. Multi-service mode takes an explicit `services` list, with `aggregateId` and `aggregateSkillName` required for aggregate outputs. Names and status owners must be unique before any publication. Every listed service is required; missing/empty member input is a failure, unlike a legacy single-service empty directory's SKIPPED behavior.

Switching a configured list to `service` ignores retained aggregate identity settings, so changing outputMode alone selects the desired outputs. Disabled output directories are retained unchanged.

Build a self-contained aggregate by relocating complete service references beneath `references/services/<serviceId>/references/`, with one trusted entrypoint and service catalog. Local links and original service/document identities remain intact; the aggregate does not merge OpenAPI documents or depend on installed service Skills. Source metadata has `kind=aggregate`, member metadata and documents keyed by service/document. Its `serviceId` field is the configured aggregate owner for reuse of the existing safe publisher/status contract.

In `both`, publish independent service outputs first and assemble only their successful current-invocation generated maps. Failed service generation/publication prevents aggregate replacement but does not block healthy peers. Aggregate publication failure leaves the individual results alone. No old files are read as a substitute for missing member inputs. Aggregate-only generation is one bounded read/convert/assemble task and publishes no standalone Skills. In both mode the timeout applies separately to each service task and aggregate assembly.

One coordinator explicitly runs after all required producers. Use reactor dependencies to establish order, including parallel builds; a parent POM running first cannot assume children are ready. Existing per-service owners may coexist with an aggregate-only coordinator. When the coordinator uses both, it owns the individual outputs too, so do not configure duplicate service writers. Services in separate repositories must provide local JSON to the configured coordinator; automatic collection/scheduling remains deferred.

Retain 32-member, 10000-file and 64-MiB aggregate bounds, per-document input limits, ownership validation, complete replacement and failure recovery. Switching modes or removing a member never deletes an independent output implicitly. Successfully replacing the aggregate removes obsolete member references. This supersedes the earlier decision to defer a combined microservice Skill, without adding global release/distribution coordination.

Use development version `1.1.0-SNAPSHOT` for this additive feature; published `1.0.0` remains immutable. Update both README languages and the design baseline to v3.6.0. No Central publication is requested here.

## 2026-09-11 - Publish The Maven Reactor Under io.github.fyuanz

Status: Accepted

The user requests Maven Central publication and confirms `io.github.fyuanz`, release `1.0.0`, MIT licensing and signing identity `fyuan <624728873@qq.com>`. Migrate parent/core/plugin coordinates and testbed plugin references together. Keep Java packages unchanged and testbeds outside the published reactor. Attach sources and Javadoc, include MIT license in binary/source JARs, and inherit correct project/developer/SCM metadata from the root. Git tag `v1.0.0` identifies the release source.

Use an opt-in `central-release` profile with Central Publishing Plugin 0.11.0, automatic publication and a wait for PUBLISHED. BC signing reads exported key material and passphrase from the process environment. A new password-protected RSA4096 signing key is held in the user's local GnuPG keyring; its public key is distributed through the supported Ubuntu keyserver. Credentials and the local helper are outside the project; stored credentials/passphrase use Windows user-bound DPAPI. Never include them in POMs, source JARs or commits.

Verification before upload: 62 tests, binary/source/Javadoc content checks, nine PGP signature verifications, runtime SpringDoc consumption and two parallel static-document service updates under the new coordinate. Maven artifact publication is separately authorized here; it does not add Skill distribution/install management or reopen deferred target-specific/P5 work.

Execution (2026-09-11): `invoke-release.ps1 -Phase deploy -Clean` uploaded the signed bundle; Central Portal deploymentId `a73c8db4-c37d-43e8-b288-05de5ea74500` reached `PUBLISHED` with empty errors/warnings, and all twelve published pom/jar/sources/javadoc/asc artifacts return HTTP 200 on `repo1.maven.org`. Central releases are immutable; later changes require a new version and a matching Git tag.

Scope at this release: product design v3.5.0 and the 2026-09-11 testbed decision applied. The 2026-09-14 decision above supersedes that scope with v3.6 aggregate outputs and removes web/real-environment acceptance. Earlier decisions remain historical; ZIP/download, CLI and package identity stay deferred.

## 2026-09-11 - Deliver The Existing Testbed Skill For Manual Frontend Use

Status: Accepted

The user selects the already created SpringDoc test application as the integration target for this delivery. Use its existing serviceId `springdoc-multi-package`, skillName `springdoc-multi-package-api`, sole owner POM, `target/generated-openapi` directory, and `verify` execution after runtime export. Build the current plugin, execute the real testbed Maven workflow, and hand off the complete generated directory for the user to copy into their frontend project.

Defer real target POM adoption, target-specific multi-module/partial-build ownership, and target startup-policy changes. The user will perform frontend consumption; actual Codex discovery and multi-service frontend acceptance remain unverified. These deferred cases do not block the selected testbed artifact, and delivery does not claim full production/P5 acceptance. Preserve existing output-under-target and manual-copy behavior; no installer, distribution module, or generator change is needed.

## 2026-09-09 - Remove The Project-Local Documentation Skill

Status: Accepted

The user requested removal of skills installed inside this project. Remove the documentation skill and its bundled templates and metadata. Retain `AGENTS.md` and `docs/codex/` as the direct project guidance and context, with no installed documentation skill dependency. This supersedes the earlier skill installation decision and does not change the product's API-to-Skill generation scope.

## 2026-09-07 - Initialize Git with a main primary branch

Status: Accepted

Context:

- The project had no Git repository or repository-level ignore rules.

Decision:

- Initialize the repository with `main` as the primary branch.
- Ignore Maven build output, Java compiler artifacts, IDE metadata, local environment files, logs, temporary files, and operating-system metadata.
- Do not ignore JAR files globally because JAR inputs and fixtures are part of the SmartDoc-Agent domain.

Consequences:

- Source, documentation, schemas, and potential JAR fixtures remain trackable.
- Generated Maven `target/` directories and machine-local files stay out of commits.

Alternatives considered:

- Ignore all `*.jar` files. Rejected because that could hide intentional test fixtures or sample inputs.

## 2026-09-07 - Separate mandatory project guidance from the documentation Skill

Status: Superseded by the 2026-09-09 removal of the project-local documentation skill; root guidance remains in effect.

Context:

- A `SKILL.md` stored directly under `docs/` is not in Codex's repository Skill discovery path.
- Implicit Skill activation depends on task matching and should not be the only mechanism for mandatory instructions.

Decision:

- Store the reusable documentation workflow at `.agents/skills/ai-project-docs/`.
- Store always-on first-read and development rules in the repository-root `AGENTS.md`.
- Use the Skill to create or refresh documentation, while ordinary development follows `AGENTS.md` and updates only documents whose facts changed.

Consequences:

- Codex can discover the Skill from the repository root and subdirectories.
- Every task receives the first-read instructions without forcing the complete documentation workflow to run.
- Templates and UI metadata remain self-contained inside the Skill directory.

Alternatives considered:

- Keep `docs/SKILL.md` and rely on agents to search for it. Rejected because the location is not automatically discoverable as a repository Skill.
- Force the complete Skill on every task. Rejected because it would add unnecessary documentation gates to routine code changes.

## 2026-09-07 - Preserve the original SmartDoc-Agent architecture

Status: Superseded

Context:

- `docs/smartdoc-agent-design.md` records the reviewed product and architecture direction.

Decision:

- Originally use Java 17 and Maven modules.
- Originally use bytecode and optional source inputs normalized into deterministic IR.
- Originally use build-time knowledge generation with local runtime retrieval and a probe fallback.

Consequences:

- The Java 17 and Maven foundation remains useful.
- The bytecode/source/probe product architecture was superseded by the accepted OpenAPI-first decision below before its parsers or runtime components were implemented.
- Existing v1 IR records remain legacy code only until the first v2 test-driven replacement task.

Alternatives considered:

- Refer to `docs/smartdoc-agent-design.md` for the detailed ADR alternatives and rationale.

## 2026-09-08 - Adopt an OpenAPI-first sidecar architecture

Status: Superseded

Superseded by the direct Skill compilation decision and the later generated OpenAPI 3.1.0 input decision. OpenAPI-first remains the direction, but this ADR's URL-acquisition and broad-version scope is no longer current.

Current scope note: the v3.2 MVP preserves OpenAPI-first input and the removal of source/bytecode/runtime probing, and accepts one frozen local JSON file per build whose root marker is exact OpenAPI 3.1.0. Swagger 2.0, other versions/formats, external references, and URL acquisition are deferred.

Context:

- RuoYi and similar services already expose a machine-readable Swagger/OpenAPI contract.
- Parsing source or bytecode would duplicate existing framework work while still failing to describe all externally observable HTTP behavior.
- The requested integration must not modify existing controllers or business APIs.

Decision:

- Treat frozen Swagger 2.0/OpenAPI 3.x specifications as the primary HTTP contract input.
- Acquire specifications from explicit files or approved URLs in a sidecar build workflow.
- Default URL acquisition to public HTTPS; allow loopback/private RuoYi endpoints only through an explicit, narrowly scoped network profile that pins scheme, host, port, and resolved IP/CIDR and rejects redirects or DNS rebinding outside that scope.
- Remove source parsing, bytecode parsing, decompilation, embedded runtime SDK, and runtime probes from product scope.
- Retain Java 17 and Maven as the implementation foundation.

Consequences:

- The first implementation unit is operation/schema/evidence normalization rather than class/method IR.
- The current six v1 IR records and schema will be replaced without a compatibility layer because no released consumer exists.
- The system can integrate with RuoYi without changing its API, but cannot infer facts absent or incorrect in OpenAPI.

Alternatives considered:

- Continue the ASM/source dual-channel design. Rejected because it is more invasive and expensive and is less aligned with the public API contract.
- Scrape Swagger UI HTML. Rejected because the UI is an unstable presentation layer while JSON/YAML is the machine contract.

## 2026-09-08 - Compile multiple governed knowledge sources into one Bundle

Status: Superseded

Superseded by the direct Skill package decision below.

Context:

- OpenAPI describes HTTP transport well but does not fully cover business workflows, troubleshooting, Excel layout, or Shapefile structure.
- Teams already maintain useful software and API usage documentation.

Decision:

- Support explicitly managed Markdown documents with versioned source rules and front matter.
- Support reviewed structured overlays for Excel, Shapefile, and audited HTTP-contract corrections.
- Use field-specific authority: OpenAPI owns HTTP facts, domain overlays own domain contracts, reviewed documents own guidance, and AI content is lowest-authority derived material.
- Preserve provenance for every indexed unit and reject stale, dangling, or conflicting protected facts in strict builds.
- Preserve applied ContractCorrection records and their original/effective values in the Bundle instead of only baking replacements into normalized operations.

Consequences:

- Users can add their own documentation without modifying service code.
- Rules must remain limited to inclusion, binding, classification, explanation, domain contracts, narrowly typed reviewed `ContractCorrection` records, and display; arbitrary patching is not an MVP feature.
- Managed document content is treated as untrusted evidence, not as agent instructions.

Alternatives considered:

- Index all repository files automatically. Rejected because it creates noise, leaks unintended content, and weakens provenance.
- Let Markdown or AI silently override OpenAPI fields. Rejected because it makes results order-dependent and unverifiable.

## 2026-09-08 - Use structured retrieval before optional vector retrieval

Status: Superseded

Superseded by the direct Skill package decision below; no retrieval engine is in the current MVP.

Context:

- OpenAPI is identifier-rich and graph-structured.
- Exact route, operation, permission, schema, and field queries are better served by deterministic indexes.
- The reviewed sample becomes small when split by operation and its referenced schema closure.

Decision:

- Build exact maps, structured filters, a Chinese-friendly BM25 index, and a relation graph during Bundle construction.
- At query time, retrieve candidate operations/documents first and only then expand the required schema/document closure.
- Keep vector search behind an optional `SemanticReranker` interface and enable it only after offline evaluation proves a stable gain.
- Enforce a default 12,000-token hard limit for retrieved evidence supplied to an LLM.

Consequences:

- MVP has no vector database or mandatory embedding model.
- TypeScript generation follows the schema graph directly and never uses RAG or an LLM.
- Low-confidence queries return candidates or abstain instead of guessing.

Alternatives considered:

- Always embed the complete OpenAPI. Rejected because it adds cost and version coupling without solving exact lookup, cyclic references, or contract quality problems.
- Put the complete OpenAPI in every prompt. Rejected because it wastes context and scales poorly.

## 2026-09-08 - Make deterministic offline builds the default

Status: Superseded

Superseded as a Bundle/AI-cache design. The narrower direct Skill build remains deterministic and offline under the current decision below.

Context:

- Repeated package builds must not regenerate unchanged AI documentation or consume tokens.
- CI needs reproducible artifacts and clear network boundaries.

Decision:

- Separate `snapshot`, deterministic `validate/build/verify`, and explicit `enrich --allow-ai` operations.
- Default SmartDoc builds use `reuse-only` mode and never fetch business sources, invoke documented APIs, or call an LLM. Maven/toolchain dependency resolution is outside this runtime boundary; the release offline gate uses pre-provisioned locked dependencies and `mvn -o` under network denial.
- Cache optional AI artifacts by canonical unit, dependency closure, overlay, prompt, model, locale, and policy digest.
- Store stable canonical EvidenceAnchors in reusable AI content artifacts, then deterministically bind them to the current snapshot evidence IDs when assembling a Bundle; an evidence-ID change alone must not force another model call.
- Publish immutable, checksummed Knowledge Bundles; pin each session to one concrete bundle ID.

Consequences:

- Unchanged inputs produce zero LLM calls and zero AI tokens.
- Partial changes invalidate only affected units and their dependent summaries.
- Bundle import cannot trigger hidden generation.

Alternatives considered:

- Invoke AI automatically during every Maven package. Rejected because it is costly, nondeterministic, and requires network access in ordinary builds.
- Mutate a published knowledge database in place. Rejected because it prevents reliable rollback and session reproducibility.

## 2026-09-08 - Provide an independent grounded-chat service

Status: Superseded

Superseded by the direct Skill package decision below; AI chat is deferred until after real Skill usage validation.

Context:

- Users need a conversation window to ask how features, API parameters, Excel files, and Shapefiles should be used.
- Browser clients must not receive LLM credentials or the complete unrestricted knowledge corpus.

Decision:

- Implement a separate Spring Boot service that imports verified Bundles, exposes search/evidence/TypeScript/session APIs, and serves a minimal built-in web page.
- Filter access before retrieval, pack only relevant evidence, require citations, and abstain when evidence is insufficient.
- Keep the MVP read-only; it explains and generates code but never invokes the documented business APIs.

Consequences:

- The same Bundle powers the web page, API, and separately exported Agent Skill sidecar.
- Local use can bind to loopback; shared use requires an authentication/authorization adapter.
- Actual API execution, workflow automation, and write-operation confirmation remain separate future decisions.

Alternatives considered:

- Embed a runtime SDK into every target application. Rejected because a separate service is easier to update, secure, and reuse.
- Let the browser call the LLM directly. Rejected because it exposes credentials and weakens evidence and access controls.

## 2026-09-08 - Adopt Skill-first developer delivery and defer Agent plugins

Status: Superseded

Superseded as a Bundle-derived export/install design. Skill-first delivery remains, but the current product generates the Skill ZIP directly and uses manual installation.

Context:

- Opening a fresh conversation is convenient but repeatedly requires developers to restore project and API context.
- Frontend developers need a directly installable, version-pinned knowledge artifact after a backend/API release.
- A platform plugin can provide live tools and runtime authorization, but generating or republishing one for every business build would couple tool lifecycle, permissions, and project knowledge unnecessarily.
- Storing an installable Skill inside its source Bundle would either prevent it from naming the final `bundleId` or create a digest self-reference; prebuilding every audience profile would also make export policy changes alter Bundle identity.

Decision:

- Make an OpenAPI-only Codex project Skill part of MVP-1B, after the canonical Bundle, search, and TypeScript foundations; extend it with managed documents, domain rules, and multiple policy profiles in MVP-2.
- Generate each installable Skill as a deterministic sidecar from a freshly verified immutable Bundle and an explicit, versioned export-profile file. Do not store Skill payloads or export profiles inside the source Bundle.
- Pin `projectId`, `releaseVersion`, `knowledgeId`, exact `sourceBundleId`, export-policy digest, target adapter, security metadata, payload digests, and `skillPackageId` in the package manifest and project-level `smartdoc.skills.lock.json`.
- Support only explicit, offline Codex project installation/update in MVP. Builds and exports never mutate developer projects, installation never follows `latest`, and local drift is not overwritten implicitly.
- Generate the Agent instruction surface only from trusted fixed templates; untrusted source and AI text may appear only in filtered references.
- Apply dependency-closed export filtering. Static-package authorization ends at export and controlled distribution; installed files are not protected by Server ACL.
- Do not create an Agent-platform plugin/MCP connector in MVP-1/2. If Production later needs dynamic revocation, cross-project search, or runtime ACL, consider one separately versioned, knowledge-free connector whose every request names an exact `bundleId` and never silently falls back to `latest`.

Consequences:

- Web developers can install a reviewed API knowledge snapshot directly in their repository and use it without a running SmartDoc Server or model credential.
- Bundle, Skill, and any future connector have separate identities and release cadences; one Bundle can produce multiple audience-specific packages without changing `bundleId`.
- Export, package verification, safe atomic installation, drift detection, lock maintenance, trusted-template generation, and Codex discovery become MVP-1B acceptance work.
- A copied static Skill cannot be revoked dynamically; restricted packages require classification labels, controlled artifact distribution, and repository/filesystem protection.

Alternatives considered:

- Generate a new Agent plugin for every business build. Rejected because it couples permissions and runtime tooling to fast-changing knowledge and adds unnecessary installation and compatibility overhead.
- Put generated Skill payloads inside the canonical Bundle. Rejected because post-Bundle identity, per-audience export, and independent target-adapter evolution are cleaner and more verifiable as sidecars.
- Defer all Skill work until the session service. Rejected because an OpenAPI-only project Skill delivers the primary developer workflow earlier and remains useful offline.

## 2026-09-08 - Narrow the product to direct Skill compilation and immutable download

Status: Superseded

Context:

- Swagger UI already provides a suitable human-facing rendering of the API contract.
- The immediate developer need is not a general knowledge platform; it is an LLM-friendly, downloadable project Skill derived from the same OpenAPI.
- The previous design combined canonical Knowledge Bundles, multiple governed sources, search, TypeScript generation, Skill export and installation, RAG, and a session service before any v2 implementation or test existed.
- That combined scope created disproportionate implementation, security, evaluation, and operational risk.

Decision:

- Define the current product as an OpenAPI-to-Codex-Skill compiler plus a minimal read-only package download service.
- Use one frozen local OpenAPI file as the MVP source and never scrape Swagger UI HTML.
- Generate one directly installable Skill ZIP containing trusted-template instructions, a compact catalog, and separate tag, operation, and shared Schema references.
- Preserve local `$ref` edges and render recursive relationships as links rather than recursively expanding complete Schema closures.
- Make the Skill ZIP the only current product artifact; do not introduce a separate Knowledge Bundle.
- Keep builds local, deterministic, and free of LLM, business-API, or external-reference network calls.
- Publish only verified immutable packages, addressed by exact `projectId`, `releaseVersion`, and `skillPackageId`.
- Make installation a manual developer action in MVP. The product does not modify consuming projects.
- Defer search, RAG, AI enrichment, chat UI, TypeScript, managed documents, automatic installation, and broader format compatibility until real usage demonstrates a need.

Consequences:

- The first implementation has three primary hard problems: safe OpenAPI splitting, correct local Schema-reference navigation, and deterministic verifiable packaging.
- The server becomes a small artifact distributor rather than a knowledge runtime.
- Existing accepted decisions for multiple-source Bundles, structured retrieval, independent grounded chat, and Bundle-derived automatic Skill installation are superseded for the current product.
- Deterministic offline behavior remains, but only for direct Skill generation and verification; the previous Bundle and AI-cache identity system is removed.
- At the time of this decision, the exact OpenAPI version still required confirmation. The later generated OpenAPI 3.1.0 input decision resolves it as exact `openapi: 3.1.0` for the current MVP.
- Future capabilities require separate accepted decisions and must not be pre-built as speculative extension modules.

Alternatives considered:

- Keep the full knowledge compiler and session-service roadmap. Rejected because it solves several unvalidated future problems before delivering the primary developer workflow.
- Build an AI chat page first. Rejected because it adds model, retrieval, citation, ACL, and evaluation complexity before the Skill content and splitting strategy are validated.
- Parse rendered Swagger UI pages. Rejected because presentation HTML is less stable and less complete than the underlying machine-readable OpenAPI contract.
- Let the server generate packages on demand. Rejected for MVP because offline CI generation and read-only distribution are easier to test, secure, cache, and operate.

## 2026-09-08 - Support OpenAPI 3.1 And Swagger 2.0 With Pinned RuoYi Fixtures

Status: Superseded

Superseded by the generated OpenAPI 3.1.0 input decision below after the producer boundary was clarified.

Context:

- The product scope is already limited to compiling one frozen API contract into one Skill ZIP and distributing verified packages.
- The target input range is now explicitly OpenAPI 3.1.0 and Swagger 2.0 rather than one still-unknown first protocol.
- A realistic project fixture is needed to validate splitting, shared schemas, Chinese tags, authentication, common response wrappers, uploads, and deterministic package behavior at useful scale.
- RuoYi is a project family whose current and historical releases use different documentation stacks; a floating branch or an assumed dependency-to-spec mapping would not be a reproducible fixture.

Decision:

- Make `openapi-3.1-json` and `swagger-2.0-json` first-class MVP source profiles. Each build still consumes exactly one frozen local JSON file.
- Accept OpenAPI 3.1.x as one feature set, while requiring the first OpenAPI project-level fixture to declare exact `openapi: 3.1.0`; require Swagger input to declare exact `swagger: "2.0"`.
- Require an explicit source profile and cross-check it against the root marker. Do not auto-detect, silently switch, or rewrite protocol versions.
- Implement two thin source adapters that normalize into one minimal model. Reference graph construction, Markdown rendering, Skill packaging, verification, CLI, and download service remain shared.
- Preserve source-specific semantics and JSON Pointers. In particular, do not first convert Swagger 2.0 into OpenAPI 3.1 and risk losing body/formData, consumes/produces, collectionFormat, reusable response, or security-definition details.
- Use the official `yangzongzhuan/RuoYi-Vue` project family for both project-level fixtures:
  - OpenAPI baseline: v3.9.2, commit `0e2d75c23c0d7a1fa85f660f06a59a4dd1ba14c0`, captured from a versioned test-only `full` group and admitted only if the root marker is exact 3.1.0.
  - Swagger baseline: v3.5.0, commit `5e64a93d115cfc65ef76eb0e4612d9a313448e29`, captured from `/v2/api-docs` and admitted only if the root marker is exact 2.0.
- Commit only frozen, sanitized, attributed snapshots with source URL, tag, full commit, startup/capture procedure, root marker, raw/sanitized digests, license notice, sanitization changes, test-only overlay, and expected size/count metadata.
- Keep small synthetic fixtures for profile conformance, cross-profile equivalence, recursion, dangling/external references, unsupported keywords, limits, and hostile free text. RuoYi complements rather than replaces edge-case tests.
- Keep OpenAPI 3.0, YAML, URL acquisition, and external `$ref` outside the MVP.
- This decision supersedes only the single-OpenAPI-3.1-profile assumption in the direct Skill compilation decision; the Skill-only artifact, deterministic offline build, manual installation, read-only download, and deferred chat scope remain unchanged.

Consequences:

- MVP adds one bounded parsing adapter and profile-specific conformance tests, not a second rendering or delivery pipeline.
- The normalized model must include a small security-scheme representation and preserve dialect-specific source metadata needed by generated references.
- Fixture acquisition is a release gate: library versions may select a candidate but cannot prove the emitted specification version.
- Tests do not start RuoYi or access GitHub/Gitee; they consume committed snapshots only.
- Package identity includes source profile, declared version, raw source digest, and original pointers, so semantically equivalent 3.1/2.0 inputs need not produce the same package ID.

Alternatives considered:

- Support only OpenAPI 3.1 and defer Swagger 2.0. Rejected because Swagger 2.0 is an explicit target and is represented by real RuoYi deployments.
- Maintain two complete compiler pipelines. Rejected because all behavior after dialect normalization is shared and duplicated implementations would drift.
- Use only a large RuoYi fixture. Rejected because a real project does not reliably cover malformed inputs, recursion, profile mismatches, or every dialect-specific edge.
- Test against a live RuoYi branch or endpoint. Rejected because upstream drift and network/runtime dependencies would make tests slow and irreproducible.

## 2026-09-08 - Treat Generated OpenAPI 3.1.0 JSON As The Sole Current Input

Status: Accepted

Scope amendment: the OpenAPI 3.1.0 JSON/core boundary remains accepted. The v3.3 compile-update decision below supersedes manual production snapshot refresh, mandatory testbed-first work, deterministic ZIPs, and immutable downloads. Production freshness must be established for each compilation; frozen fixtures remain appropriate for core tests.

v3.4 amendment: the single-document-per-build limit is superseded. One service update accepts one or more required OpenAPI 3.1.0 JSON documents, parsed independently with document-local references.

Context:

- The target service uses springdoc-openapi 2.8.15 to generate its machine-readable API description.
- Knife4j is an enhanced presentation/integration layer around the OpenAPI document and is not the data contract SmartDoc needs to compile.
- SmartDoc's goal is to convert an already generated API document into an LLM-friendly Skill, not to test documentation UIs, reproduce framework scanning, or certify every historical specification version.
- The proposed RuoYi and Swagger 2.0 fixture matrix added producer and compatibility work that is unnecessary for the first usable product.

Decision:

- Make one frozen local JSON document with exact root marker `openapi: 3.1.0` the sole current compiler input.
- Treat the resulting JSON bytes as the authority. Core has no dependency on Spring Boot, springdoc internals, Knife4j, Swagger UI, or the running business application.
- Use one small standalone Spring Boot fixture producer with Java 17, a pinned compatible Spring Boot 3.5.x patch, and `springdoc-openapi-starter-webmvc-api:2.8.15`.
- Do not add Knife4j or a Swagger UI starter to the testbed. Set `springdoc.api-docs.version=OPENAPI_3_1`, expose representative controllers, and capture `/v3/api-docs` on loopback only during explicit fixture generation or refresh.
- Commit the generated JSON plus exact dependency versions, capture command, root-version assertion, SHA-256, and operation/Schema counts. Ordinary core tests consume the frozen file and do not start Spring Boot.
- Cover path/query/header parameters, JSON and multipart requests, multiple responses, shared/recursive schemas, security, examples, and Chinese tags in the one testbed.
- Keep only small hand-written negative JSON fixtures for states a valid generator will not normally emit, such as dangling/external references, configured limit violations, unsupported versions, and hostile free text. These are data files, not additional sample projects.
- Defer Swagger 2.0, OpenAPI 3.0, other OpenAPI 3.1 patch versions, YAML, and producer/UI-specific compatibility tests.
- This decision supersedes the dual-profile and pinned-RuoYi fixture decision. It does not change direct Skill generation, deterministic packaging, manual installation, immutable download, or the decision to leave AI chat until last.

Consequences:

- The current parser, fixture set, and acceptance matrix become substantially smaller.
- Knife4j can be added, removed, or upgraded by a source application without affecting SmartDoc, provided the frozen `/v3/api-docs` JSON remains within the accepted contract.
- The testbed verifies that SmartDoc sees realistic springdoc output; it does not attempt to test or reimplement springdoc itself.
- Supporting another document version later requires an explicit fixture-backed decision, not speculative adapter code now.

Alternatives considered:

- Keep RuoYi as the primary fixture. Rejected because it brings database, security, configuration, release, and upstream-drift variables that do not improve validation of the document-to-Skill compiler.
- Include Knife4j in the testbed. Rejected because UI behavior is outside the product input boundary and the API-only springdoc starter already exposes the required JSON endpoint.
- Start the Spring Boot testbed in every core test. Rejected because a committed snapshot is faster, deterministic, and sufficient for parser tests; the producer is only needed when refreshing the representative fixture.
- Continue testing Swagger 2.0 now. Rejected because it is not part of the clarified target input and would double compatibility work before the main workflow exists.


## 2026-09-08 - Require Per-Compilation Skill Updates Without Blocking The Business Build

Status: Accepted

Context:

- The user defines the sole current product goal as generating an API Skill for frontend development.
- Every compilation must update the Skill, and generation exceptions must not interrupt compilation. All other work is deferred.
- v3.2 emphasized frozen-input conversion, deterministic ZIPs, immutable downloads, and manual installation but did not define compilation integration or non-blocking failure handling.

Decision:

- Restrict current work to API-document conversion, usable Skill content, compilation-triggered updates, and the checks required to make those updates correct and safe.
- Preserve the OpenAPI 3.1.0 JSON input boundary and trusted-template/reference separation.
- Require each configured compile invocation to attempt an update, including repeated no-change compilations. Identical API content may generate identical output.
- Coordinate current-document preparation and Skill conversion within the same update flow. Failed preparation must not fall back to an old JSON and claim current-code synchronization.
- Stage and validate a complete result before replacing the generator-owned output. Failed updates retain the previous complete Skill when one exists and clearly report stale/no-output status.
- Isolate Skill configuration, preparation, conversion, timeout, and filesystem errors at the compilation boundary. Emit warnings and preserve the business build's own outcome; never suppress normal business compilation failures.
- Retain basic resource/path limits, reference correctness, source metadata, external update status, and meaningful tests. Defer ZIP packaging, package identity, standalone CLI, download service, deployment, and cross-project installation management.
- A standalone Spring Boot fixture producer is no longer a prerequisite. Start core tests with sanitized JSON and add a minimal integration fixture only when needed to verify actual document production.
- Do not implement other product capabilities in this task or add speculative extension modules.

Consequences:

- Product design v3.3.0 and the documentation pack replace the old ZIP/download implementation roadmap.
- The first integration question is how the target compile obtains a current contract, not how to publish a package.
- Source digests identify input bytes; they cannot prove current-code freshness by themselves.
- The current repository cannot yet demonstrate the required behavior: core files are deleted, the parent cannot load the missing core POM, and no target build/document configuration is present.
- Maven/IDE entry-point coverage, exact ordering, timeout isolation, and replacement behavior require integration tests before implementation is called complete.
- Process termination or failure to load Maven/plugin infrastructure is outside what an executing generator can catch.

Alternatives considered:

- Retain immutable ZIP/download MVP stages. Rejected for current scope because distribution infrastructure is not required for the specified generation workflow.
- Recompile a manually frozen old snapshot every time. Rejected as proof of current-code synchronization; valid only when the static file is itself the authoritative contract.
- Fail the business build on invalid documentation. Rejected because the user explicitly requires generation failures not to interrupt compilation.
- Catch the entire business build or force its exit code to zero. Rejected because genuine business compilation failures must remain visible.
- Write generated files over the previous output in place. Rejected because a failed run can leave an incomplete Skill and removed APIs can remain as stale files.

## 2026-09-08 - Use A Thin Maven Integration For The First Compile-Update Slice

Status: Proposed

Context:

- The repository currently uses Java 17 and a Maven parent.
- A separate manual CLI does not satisfy the compilation trigger requirement.

Decision:

- Propose `smartdoc-agent-core` plus a thin `smartdoc-agent-maven-plugin` as the initial implementation boundary.
- Verify the actual lifecycle binding and current-document preparation order with the target compile workflow before accepting the integration as complete.
- Propose `target/smartdoc/<skillName>/` as the default generator-owned output. Confirm the actual destination and whether retention across `clean` is required.
- Keep current-document production as an explicit integration dependency whose concrete mechanism is unknown; do not assume ordinary compilation already produces springdoc JSON or start business services implicitly.

Consequences:

- No plugin, output directory, or IDE coverage is documented as implemented.
- An independent IDE compiler needs its own verified integration or delegation to the agreed build entry point.
- The final output path and lifecycle details can be chosen during the first tested integration without restoring deferred distribution work.

Alternatives considered:

- Implement CLI and server first. Rejected for current scope because neither establishes the required per-compile update behavior.
- Claim a Maven hook covers every possible compiler invocation. Rejected because the target entry points have not been established.

## 2026-09-09 - Support Microservices And Multiple Documents Per Service

Status: Accepted

Context:

- The user confirms microservices and multiple packages as essential project scenarios, not future extensions.
- The previous single-document workflow did not define service ownership, multiple document inputs, or multi-module compilation coordination.

Decision:

- Generate one Skill per service from one or more explicitly configured required OpenAPI 3.1.0 JSON documents. Services update independently in shared or separate repositories.
- Distinguish Java packages, Maven modules, document groups, and services. Existing document producers own package scanning; no source/framework scanner is added to core.
- Require stable serviceId/skillName and service-local documentId values. Namespace operations by service/document/method/path, and schemas/security/references by originating document and pointer.
- Parse each document independently, preserving same-named content and group provenance. Do not merge raw OpenAPI objects, infer equivalence, match references across documents, or invent gateway routing.
- Require all configured documents to be ready for a service update. One failure retains that service's complete previous Skill, emits a warning/status, and permits other services and business compilation to continue.
- Scope staging, replacement, write exclusion, and status to one service; detect output collisions without overwriting results or clearing a shared parent.
- Assign one generation owner per service and verify full, single-service, partial-module, no-change, and parallel compilation. Partial builds with incomplete service inputs must diagnose the missed update rather than publish stale or mixed inputs.
- Explicit document removal removes its references on the next successful service update; missing required input is an update failure, not an implicit deletion.
- Keep global cross-service Skill aggregation, release/version coordination, and cross-repository scheduling deferred.

Consequences:

- Multi-service and multi-document fixtures and integration cases are part of current acceptance, not optional later tests.
- Core adds document provenance and service-level content organization; the proposed Maven integration adds service-level readiness and output ownership. No new platform module is needed.
- Product design v3.4.0 and all active project docs reflect this scope. Generation and integration remain unimplemented.
- Actual module mappings, document production, partial-build entry points, and Maven execution ordering remain unknown and require a target integration test before a complete estimate or coverage claim.

Alternatives considered:

- Restrict current scope to one document only. Rejected because it excludes explicitly required service/group scenarios.
- Produce a Skill for every Java package or Maven module. Rejected because those boundaries do not necessarily represent independently usable APIs.
- Merge every microservice into one global Skill during each service compilation. Deferred because it adds unrelated build dependencies and global freshness coordination.
- Publish a partial service Skill when one document fails. Rejected because it silently removes usable API knowledge or mixes revisions in a result labeled current.

## 2026-09-09 - Establish The Implementation Plan With An Early Integration Gate

Status: Accepted

Context:

- The user asks whether product design is ready and when the work plan will be updated.
- v3.4 defines required service/document scope and failure behavior, while the real document producer, module ordering, and compile entry points are still unverified.

Decision:

- Treat v3.4 as the current implementation planning baseline; do not claim all technical integration choices are settled.
- Maintain one executable P0-P5 plan in TASKS.md: build/test foundation, early integration validation, content conversion, complete safe updates, real compile integration, and frontend acceptance.
- Start with the buildable foundation and investigate current-document/compile feasibility early. Source-independent conversion and update work can proceed on fixtures while target evidence is unavailable.
- Require observed behavior and exact verification results to close stages. Synthetic document producers cannot certify the actual code-to-document production workflow.
- Keep the thin Maven plugin proposal pending actual lifecycle/producer validation; do not introduce new product features or convert the requirement to package-time generation to hide a failed integration assumption.
- Re-estimate remaining work after integration feasibility is established; the earlier single-document estimate is not a committed delivery date.

Consequences:

- Work-plan preparation is complete; no implementation stage is marked complete or started by this documentation task.
- P0 is ready. Missing target configuration gates final integration verification but does not block local core development.
- Product acceptance and implementation status remain distinct, and completed tasks require red-to-green/integration evidence appropriate to the behavior.

Alternatives considered:

- Keep revising product design until every implementation detail is known. Rejected because core requirements are sufficiently bounded and remaining uncertainty is better resolved by concrete probes.
- Build the complete converter/plugin before investigating fresh-document production. Rejected because the highest integration uncertainty should be tested early.
- Mark fixture-only generation as end-to-end completion. Rejected because it does not prove per-compilation freshness or target build behavior.

## 2026-09-09 - Use A Multi-Package Spring Boot Service As The First Realistic Fixture

Status: Accepted

Context:

- The user proposes annotated endpoints in a multi-package Spring Boot test service, multiple OpenAPI 3.1.0 JSON outputs, then Skill implementation.
- This provides realistic producer input but requires explicit grouping and a distinction between fixture export and per-compilation updates.

Decision:

- Select one minimal standalone multi-package test service with two explicit document groups as P1's first realistic fixture, following P0's build/test setup.
- Write assertions for version, group membership, API/field descriptions, and references before completing the matching sample behaviors. Persist only validated sanitized documents and reproducible producer metadata for core tests.
- Use API mappings, explicit OpenAPI annotations, and validation metadata; do not rely on source comments being exported implicitly.
- Keep test-service startup/capture bounded and isolated to fixture generation/integration tests. It does not authorize an implicit production service startup requirement.
- Record the lifecycle distinction: the official springdoc Maven plugin reads a running application during integration-test; its example runs `mvn verify`. A default `mvn package` or `mvn compile` does not by itself demonstrate that export path or satisfy the product compile-update requirement.
- Generate one service Skill from the resulting multiple documents in P2. Continue to verify ordinary compilation freshness/failure handling and separate-service/multi-module cases before closing P1/P4.

Consequences:

- TASKS.md contains the concrete P1 fixture steps; the planned path is `testbeds/springdoc-multi-package/`, not an implemented module.
- The minimal fixture is now selected current work; a full microservice platform remains deferred. No generator or sample code was created by this workflow-clarification task.
- The sample addresses one-service/multiple-package/group coverage; it cannot alone certify independent microservices, reactor order, or production compile-time generation.

Sources checked on 2026-09-09:

- [springdoc v2 grouping and properties](https://springdoc.org/v2/)
- [springdoc Maven plugin](https://github.com/springdoc/springdoc-openapi-maven-plugin)
- [Maven build lifecycle](https://maven.apache.org/guides/introduction/introduction-to-the-lifecycle.html)

## 2026-09-09 - Implement The Standalone Testbed Before Core

Status: Accepted

The user requests the minimal Spring Boot test service first. Advance the independent P1.3 fixture ahead of P0; keep the user's deleted core files unchanged and leave root-reactor repair in P0. This supersedes the earlier sequencing dependency for this standalone probe only.

- Pin Java 17, Spring Boot 3.5.9 and springdoc API-only 2.8.15. The official springdoc 2.8.15 release uses Boot 3.5.9; the actual combination passes our four tests. No UI, persistence, service registry or real authentication is added.
- Use explicit account (user) and business (order/file) package groups. Shared Address and ApiError schemas remain local in each exported document; recursive UserView is preserved.
- Export through a real random loopback port in SpringBootTest with HTTP and fork timeouts and context cleanup. A fixed documented default server address prevents random port differences in snapshots.
- Freeze only asserted documents using an explicit refresh script. Store JSON digests, producer source digests, versions and operation/schema counts. Core will consume these bytes offline; ordinary test runs do not modify frozen files.
- Keep the standalone POM outside the root reactor. Test-phase startup is intentionally confined to this sample; compile does not export documents and no Skill generation or production lifecycle decision is implied.

Evidence: four behavioral failures (404) before controllers/groups, then four passing tests, a passing clean refresh, and successful executable JAR packaging with previously tested code. P1.3 is complete; P0 and the remaining P1/P4 production gates are open.

Source: [springdoc 2.8.15 release](https://github.com/springdoc/springdoc-openapi/releases/tag/v2.8.15), checked 2026-09-09.

## 2026-09-09 - Add Swagger UI To The Testbed

Status: Accepted

At the user's request, replace the testbed's API-only starter with `springdoc-openapi-starter-webmvc-ui:2.8.15`. This supersedes the earlier no-UI constraint for this testbed only. Keep the existing grouped OpenAPI JSON contract and core dependency boundary. The standard `/swagger-ui.html` entry discovers account/business groups automatically; no duplicate group configuration or custom UI is necessary.

Verification: the new HTTP test first failed with 404; after the dependency change all five tests passed. It checks the redirect, HTML, JavaScript resource and exact two-group swagger-config mapping. Fixture refresh passed; both JSON digests remain unchanged, while producer POM metadata is refreshed.

Reference: [springdoc Swagger UI setup](https://springdoc.org/v2/), checked 2026-09-09.

## 2026-09-09 - Deliver Completed Milestones Through GitHub

Status: Accepted

The user requests updated implementation plans and a project commit/push, and authorizes the same delivery sequence for future completed parts. Record the workflow in AGENTS.md: complete the requested slice, verify it, update relevant docs, commit related changes, and perform a normal push to the configured GitHub remote. Report the resulting commit and verification evidence. Missing remote/authentication or a conflict requiring user input is reported without force-pushing. This does not schedule background work or authorize starting unrelated stages.

The current milestone includes the v3.4 scope/docs, previously requested legacy/local-skill removal, the standalone P1.3 producer and Swagger UI. P0 and production integration remain incomplete; the known missing core POM is documented rather than repaired as part of this delivery.

## 2026-09-09 - Establish Minimal Core Input Boundary

Status: Accepted

Use existing managed Jackson/JUnit versions with explicit JUnit 5 discovery. Accept one JSON object with textual openapi exactly 3.1.0; distinguish missing version, unsupported version and invalid JSON. Reject duplicate keys and trailing tokens. This is not full specification validation. No legacy IR is restored. Root tests demonstrate 19-test red-to-green. Proceed to fixture-based P2 separately from unverified production integration.

## 2026-09-09 - Deliver A Fixture-Based Core Skill Before Publication Integration

Status: Accepted

At the user's request, consume the existing account/business snapshots after P0 and render one service Skill. Use a thin JSON tree and retain full operation/schema contract data in Markdown code blocks instead of introducing legacy IR or lossy field summaries. Add effective parameter/server/security context and document-local graph links; recursion remains edges. Keep trusted instructions fixed except validated service/Skill identities, and keep source free text in references.

Core returns an immutable relative-path/content map. Test code exports the sample under target; production writes, complete replacement, locking and compile coordination remain P3/P4. Explicit required map entries fail as a set. Stable safe names and pointer/path hashes isolate files, while a group-aware catalog supplies readable navigation. Reject unsupported reference semantics explicitly and leave broader P2 acceptance open. Input digests identify snapshots and cannot establish compilation freshness.

## 2026-09-09 - Complete P2 With Document-Local Navigation And Exact Contract Data

Status: Accepted

Complete P2 without introducing a normalized legacy-style IR. Preserve the exact operation and Schema JSON in untrusted reference files, and add only the effective context frontend work needs: service/document/method/path ownership, path/operation parameter overrides, server inheritance and security inheritance/clearing. Render every configured document independently inside one service Skill.

Support document-local JSON Pointer references, including root, escaped, recursive and multi-level pointers, reusable components, and bare Path Item aliases. Treat example/default/enum/const values and vendor extensions as source data so a literal `$ref` is not fetched or interpreted. Reject external, dangling, anchored, dynamic/rebased references, cyclic aliases and ambiguous Path Item `$ref` siblings with document-specific diagnostics. These explicit failures keep the current implementation bounded without claiming full OpenAPI specification validation.

Generate stable hashed paths for operations, Schemas, tags and other targets; expose readable operation, tag and Schema navigation in the catalog. Record `smartdoc-agent-core/1` as the generated content format version along with service/Skill/document identities, input digests, declared OpenAPI/API versions and counts. Core returns one immutable file map only; staging, writes, replacement and status remain P3.

Evidence: 39 root tests pass after observed red-to-green cycles. The two frozen documents generate a 19-file Skill that passes the skill-creator structural validator. An independent read-only frontend scenario located and used the multipart upload operation from generated navigation alone, while preserving documented unknowns. This completes P2, but does not prove production document freshness, compilation integration, filesystem update safety or consuming-project discovery.

## 2026-09-09 - Keep Safe Publication In Core Behind An Explicit Result

Status: Accepted

Implement P3 as a reusable core boundary rather than guessing the Maven lifecycle contract. `ServiceSkillUpdater.update(...)` accepts one service/Skill identity, a controlled output parent, a positive timeout, and a callable that returns the complete generated file map. It returns SUCCESS, FAILED, TIMED_OUT, or LOCKED plus availability, retention, status-write, message, and path facts. The later Maven integration will translate this result into warnings without weakening ordinary business build failures.

Before publication, validate safe normalized paths, case-insensitive and file/directory conflicts, bounds, trusted entrypoint/source ownership, strict source JSON, reachable local Markdown links, and filesystem entry types. Lock by final Skill output, write and recheck a unique staging directory, move an existing validated generator-owned Skill to a unique backup, and publish the complete staged tree. Restore the old tree after an ordinary publication failure; if restoration itself fails, retain the complete backup for explicit recovery. Never adopt or clear manual/foreign output or the shared parent.

Keep last-attempt status under `.smartdoc/status/<serviceId>.json`, outside the published Skill. Status-write failure is part of the returned message and does not undo a valid publication. Run only generation inside a bounded daemon executor; the updater thread alone can publish the returned map, so a timed-out task that ignores interruption cannot later write output. Service-specific locks and unique staging/backup paths allow unrelated services to proceed independently.

Evidence: the updater suite first failed in 10 behavioral cases while all 39 existing tests remained green. A separate recovery test then caught unsafe backup cleanup before the fix. The final root suite runs 54 tests, including whole-tree comparisons, stale group/operation removal, missing required documents, output collisions, injected writes/moves/status failures, timeout, locking, recovery, and concurrent service isolation. P3 does not settle source freshness, Maven binding/order, non-blocking build behavior, multi-module ownership, production output location, or discovery.

## 2026-09-10 - Bind One Non-Blocking Goal In Each Service Owner Module

Status: Accepted for authoritative static documents; generated-document preparation remains open

Add `smartdoc-agent-maven-plugin` with one `generate-skill` Mojo whose default phase is `compile`. Configure its execution explicitly in the module that owns one service Skill and set `<inherited>false>` so a parent declaration cannot turn child modules into duplicate writers. The configuration is one serviceId, one skillName, a controlled output parent, a timeout, and a complete list of document id/path pairs.

Read every configured local file during each Mojo invocation and perform read, conversion, timeout, validation, and publication through the P3 failure boundary. Report SUCCESS as Maven info. Convert configuration, input, generation and output failures into service-specific warnings; do not throw a Maven failure for the Skill update. Normal compiler and other Maven failures retain their exit status. Output below `target` is a convenient default but is removed by `clean`; a target requiring retention across failed clean builds must configure a durable controlled parent.

This contract establishes currency only when the configured local JSON files are authoritative source. Runtime springdoc documents require application startup and are not made current by this goal. A generated-document integration must provide a positive same-build readiness/freshness signal and prove its lifecycle order; an old file or digest is insufficient.

Evidence: three Mojo tests failed before implementation and the root suite now passes 57 tests. A real Maven 3.9.16/JDK 17.0.19 two-service reactor verifies ordinary and repeated compile, changed input, deleted stale operation, package traversal, targeted and parallel builds, single owner invocation, failure isolation, exact tree retention, configuration/output warnings, and an unmasked Java compiler failure. Maven Plugin API 3.9.9 and Plugin Tools 3.15.2 follow the official [Java plugin development guide](https://maven.apache.org/guides/plugin/guide-java-plugin-development.html) and [Plugin Tools project summary](https://maven.apache.org/plugin-tools/maven-plugin-plugin/summary.html), checked 2026-09-10.

## 2026-09-10 - Treat Runtime Springdoc As A Verified Later-Phase Input Mode

Status: Accepted for the standalone fixture; production adoption remains target-specific

Runtime springdoc needs compiled application classes and a running application. Keep the static authoritative-document route at `compile`. For the runtime route, package and start the test application at `pre-integration-test`, capture each required group with springdoc Maven Plugin 1.5 at `integration-test`, stop at `post-integration-test`, and bind SmartDoc once at `verify`. Do not describe `compile` or `package` as covering this route.

Add opt-in `requireCurrentBuildDocuments` to the SmartDoc goal. When enabled, inject the Maven session, require every configured document's last-modified instant to be at or after the session start, and verify size/last-modified stability around the byte snapshot. A producer may rewrite identical bytes successfully; an old file left by a failed capture is rejected. Keep the option disabled for version-controlled authoritative contracts, whose currency comes from their source status rather than generated-file timestamps.

Configure springdoc capture with `failOnError=false` in the fixture so an HTTP capture failure reaches SmartDoc's failure boundary. A failed no-clean capture proves the old JSON remains untouched, SmartDoc records FAILED and retains the previous complete Skill, and Maven succeeds. The Spring Boot `start` goal remains outside SmartDoc; startup failure still fails Maven. This limitation prevents declaring the runtime route a universal production default or P4 complete before the actual target's entry point and failure policy are reviewed.

Use dynamic loopback HTTP and JMX ports in automated verification so an unrelated local process is never stopped or reused. The fixture's documented `18080` remains only the manual-run default.

Evidence: the two new freshness tests failed before implementation and bring the passing root suite to 59. The generated-integration verifier first failed because the runtime documents and Skill did not exist, then passed both a clean successful export and a no-clean failed-capture case with exact tree/timestamp checks. Official references checked 2026-09-10: [springdoc runtime Maven export](https://github.com/springdoc/springdoc-openapi-maven-plugin), [Maven lifecycle phases](https://maven.apache.org/guides/introduction/introduction-to-the-lifecycle.html), [Spring Boot Maven plugin](https://docs.spring.io/spring-boot/3.5/maven-plugin/), and [Maven session start time](https://maven.apache.org/ref/3.9.9/maven-core/apidocs/org/apache/maven/execution/MavenSession.html).

## 2026-09-10 - Discover Generated JSON Within An Explicit Maven Boundary

Status: Accepted

Production OpenAPI JSON comes only from SpringDoc or NextDoc4j. NextDoc4j itself uses SpringDoc/OpenAPI 3 as its engine; SmartDoc consumes exported JSON and does not integrate with its UI or internal APIs. The supported build entry point is Maven. Every target project explicitly selects the service identity, one owner module, the producer output directory, and a SmartDoc phase after that producer. Service/package/module/group relationships are never inferred.

Add `documentsDirectory` to the Maven goal. It scans regular top-level `*.json` files in deterministic filename order and derives `documentId` from a safe lowercase filename stem. The files present define the current service input set; an absent or empty directory logs SKIPPED and does not invoke core. JSON content or groups that are absent are not invented. Retain explicit document entries as a mutually exclusive fallback when a target needs fixed IDs/paths and wants every listed group to be required. Remove the goal's default lifecycle phase so a target cannot accidentally run it before its chosen producer.

Set the default output parent to `${project.build.directory}/generated-resources/smartdoc`, so Maven `clean` removes generated Skills. No durable cross-clean retention path is required. Runtime SpringDoc still needs compiled classes and a running application, so its verified ordering remains capture at `integration-test` and SmartDoc at `verify`; this is consistent with Maven-only target builds but is not ordinary `compile`.

Evidence: the default-output descriptor test first failed against the former `target/smartdoc` value. Two directory-discovery tests then failed to compile before the parameter existed. The focused Mojo suite passes 8 tests after implementation. Full Maven and integration verification is recorded in TASKS.md.

References checked 2026-09-10: [SpringDoc Maven plugin](https://github.com/springdoc/springdoc-openapi-maven-plugin), [NextDoc4j quick start](https://nextdoc4j.top/guide/start/started.html), and [NextDoc4j architecture](https://nextdoc4j.top/guide/).
