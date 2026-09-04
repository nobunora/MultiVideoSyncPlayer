# Documentation Index

Read only the document relevant to the current task.

## Product and architecture

- `specs/multi-video-sync-player-spec.md` — authoritative product specification and acceptance criteria.
- `architecture/preimplementation-decisions.md` — frozen implementation-detail choices before source work.
- `research/existing-solutions.md` — prior art, reuse decisions, and wheel-reinvention guardrails.

## Implementation

- `implementation/implementation-plan.md` — ordered implementation procedure and proposed module boundaries.
- `implementation/initial-repository-review.md` — validated repository review for the first source-bearing change.
- `implementation/implementation-readiness.md` — exact handoff/checklist immediately before implementation.
- `19_chat_github_codex_workflow.md` — specification → repository review → implementation workflow.

## Testing

- `testing/test-spec.md` — behavioral and non-functional test requirements.
- `testing/test-implementation-plan.md` — test tooling, fixture strategy, and implementation order.
- `testing/acceptance-matrix.md` — requirement-to-evidence matrix for PR/release review.

## Repository-agent rules

- `../AGENTS.md` — root rules for Codex/repository agents.
- `15_codebase_memory_and_quality.md` — CodebaseMemory and quality-audit policy.
- `../.codex/implementation.md` — general implementation contract.
- `../.codex/next-task.md` — current ready-to-run Codex implementation task.

## Current state

Repository review is `validated`; no production source exists yet. The next source-bearing change should follow `.codex/next-task.md` rather than reopening architecture design.
