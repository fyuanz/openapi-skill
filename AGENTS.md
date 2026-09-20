# Project Instructions

## Spec-Driven Development (OpenSpec)

This project is developed with **OpenSpec** (`@fission-ai/openspec`, CLI 1.13.1). Any nontrivial
feature, refactor, or architectural change starts as an OpenSpec change proposal, not as code.

Workflow (invoke per tool):

| Step | CodeBuddy / Claude | Codex | Universal |
| --- | --- | --- | --- |
| Think it through | `/opsx:explore` | `$openspec-explore` | `/openspec-explore` |
| Propose a change | `/opsx:propose <idea>` | `$openspec-propose` | `/openspec-propose` |
| Implement | `/opsx:apply` | `$openspec-apply-change` | `/openspec-apply-change` |
| Update artifacts | `/opsx:update` | `$openspec-update-change` | `/openspec-update-change` |
| Reconcile specs | `/opsx:sync` | `$openspec-sync-specs` | `/openspec-sync-specs` |
| Archive when done | `/opsx:archive` | `$openspec-archive-change` | `/openspec-archive-change` |

Layout: `openspec/specs/` = agreed current truth; `openspec/changes/<name>/` = in-flight proposals
(`proposal.md`, `specs/`, `design.md`, `tasks.md`); `openspec/changes/archive/<date>-<name>/` = history.
Artifacts are written in **zh-CN**; keep structural headings and SHALL/MUST keywords in English
(`openspec/config.yaml`).

CLI reference (from the repo root):

- `openspec list` — active changes; `openspec list --specs` — specs
- `openspec validate [item]` — validate changes/specs
- `openspec show [item]` — read a change or spec
- `openspec status` — artifact completion for a change
- `openspec doctor` — relationship health
- `openspec update` — refresh generated agent instructions after a CLI upgrade

Rules:

- Do not write implementation code for a nontrivial change until its `tasks.md` exists and the
  proposal has been reviewed.
- Keep `openspec/specs/` in sync: when a change alters agreed behavior, reconcile it in the same
  slice rather than letting specs drift.
- Adding an OpenSpec proposal is not authorization to start unrelated product stages.

## Mandatory First Read

Before analyzing, planning, or modifying code, read these files when they exist:

1. `docs/codex/PROJECT_CONTEXT.md`
2. `docs/codex/PROJECT_STRUCTURE.md`
3. `docs/codex/MODULES.md`
4. `docs/codex/TASKS.md`
5. `docs/codex/DECISIONS.md`

Do not scan the whole repository before reading these files. Use targeted `rg` searches afterward.

## Development Rules

- Write tests before implementation and keep the red to green sequence.
- Keep source and test files below approximately 800-1000 lines; split files by responsibility before they become larger.
- Prefer decisions that are verifiable and maintainable.

## Documentation Updates

When a change affects documented facts, update the relevant `docs/codex/` files in the same task:

- Always update `TASKS.md` when task status changes.
- Update `DECISIONS.md` when a technical decision is proposed, accepted, rejected, or superseded.
- Update `MODULES.md` or `PROJECT_STRUCTURE.md` when responsibilities or paths change.
- Update `PROJECT_CONTEXT.md` when goals, users, workflows, commands, status, or constraints change.

## Verification

Run checks appropriate to the change and report them. If verification cannot run, explain why.

## Milestone Delivery

- After completing an independently reviewable part of the user's requested work, run appropriate verification, update the project docs, then commit and push to the configured GitHub remote without asking for confirmation again.
- Commit changes belonging to that completed work; do not include unrelated edits, secrets, generated build output, or temporary files.
- Use normal pushes. Do not force-push or overwrite remote history. If the remote is missing, authentication fails, or integration requires user input, finish the local work and report the specific blocker.
- This is the delivery workflow for requested work, not a schedule or authorization to start additional product stages autonomously.
