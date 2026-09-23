# Project Instructions

## Governance

OpenSpec is the single workflow source of truth for spec-driven development, change lifecycle, and agreed behavior.
Invoke the applicable OpenSpec workflow before any nontrivial feature, refactor, or architectural change.

This file only records repository-specific engineering rules. It must not duplicate OpenSpec command tables, CLI
references, artifact language settings, directory explanations, or lifecycle instructions; those are owned by
`openspec/` and the generated OpenSpec skills.

Do not scan the whole repository before reading these files. Use targeted `rg` searches afterward.

## Development Rules

- Write tests before implementation and keep the red to green sequence.
- Keep source and test files below approximately 800-1000 lines; split files by responsibility before they become larger.
- Prefer decisions that are verifiable and maintainable.

## Verification

Run checks appropriate to the change and report them. If verification cannot run, explain why.

## Milestone Delivery

- After completing an independently reviewable part of the user's requested work, run appropriate verification, update the project docs, then commit and push to the configured GitHub remote without asking for confirmation again.
- Commit changes belonging to that completed work; do not include unrelated edits, secrets, generated build output, or temporary files.
- Use normal pushes. Do not force-push or overwrite remote history. If the remote is missing, authentication fails, or integration requires user input, finish the local work and report the specific blocker.
- This is the delivery workflow for requested work, not a schedule or authorization to start additional product stages autonomously.
