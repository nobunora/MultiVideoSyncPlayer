# Chat → GitHub → Codex Workflow

## Purpose

Keep requirements explicit in GitHub and keep repository-agent work bounded by an approved contract.

For MultiVideoSyncPlayer, chat history is not the source of truth once requirements are merged. The authoritative contract is the repository specification.

## Responsibility split

### Specification / adjudication role

Responsible for:

- clarifying requirements;
- updating `docs/specs/multi-video-sync-player-spec.md`;
- deciding architecture/scope/non-goals;
- deciding whether a new dependency or external feature is acceptable;
- adjudicating repository conflicts.

### GitHub

GitHub stores the durable contract:

- product specification;
- prior-art/reuse decisions;
- implementation plan;
- test specification;
- test implementation plan;
- PR review evidence;
- verification evidence.

### Codex / repository agent

Responsible for:

- inspecting actual repository state;
- using CodebaseMemory plus targeted source evidence;
- validating the specification against repository reality;
- implementing only validated scope;
- running deterministic checks;
- reporting conflicts instead of silently inventing behavior.

## State flow

```text
SPEC_READY
   |
   v
REPOSITORY_REVIEW
   |
   +-- material conflict --> SPEC_REVISION --> SPEC_READY
   |
   v
VALIDATED
   |
   v
IMPLEMENTATION
   |
   v
VERIFICATION
   |
   v
IMPLEMENTATION_REVIEW
   |
   +-- defect --> FIX / REVERIFY
   |
   v
READY_TO_MERGE
```

## Phase 1 — Repository review

Use `.codex/repository-review.md` before implementation.

The review must:

1. read `AGENTS.md`;
2. read the specification and relevant implementation/test docs;
3. inspect repository metadata and CodebaseMemory if available;
4. identify affected paths and boundaries;
5. check reuse opportunities and dependency implications;
6. resolve the Phase 0 technical questions with focused spikes where needed;
7. not modify production code during the review pass.

Disposition:

- `validated`;
- `spec-change-required`;
- `blocked`.

Implementation must not start while a material conflict remains unresolved.

## Phase 2 — Implementation

Use `.codex/implementation.md` after validation.

Rules:

- use `docs/implementation/implementation-plan.md` as the ordered default;
- keep PRs bounded and independently reviewable;
- do not combine broad refactors with feature delivery;
- reuse platform/existing solutions before custom subsystems;
- preserve local-only invariants;
- keep tests close to implementation;
- run focused checks before broad checks;
- update `THIRD_PARTY_NOTICES.md` in the same change if copied/derived third-party code is introduced.

## Phase 3 — Verification

Use:

- `docs/testing/test-spec.md` for required behavioral evidence;
- `docs/testing/test-implementation-plan.md` for tooling/fixture approach.

Each implementation PR report must include:

- specification revision/commit;
- changed paths and reason;
- reuse/dependency decisions;
- exact test/check commands;
- exact outcomes;
- unresolved risks;
- manual Windows/real-video evidence when required.

Passing unit tests alone do not prove multi-video timing correctness.

## Phase 4 — Review and convergence

Review must trace changed execution paths, not only inspect test green status.

For non-trivial synchronization/persistence/security changes verify:

- no unresolved Critical/High issue remains;
- specification and implementation still agree;
- local-only invariants remain intact;
- project persistence compatibility is deliberate;
- third-party licensing notices are current;
- tests cover the failure/regression being addressed.

## CodebaseMemory handoff

When a graph exists:

- query before editing;
- verify graph evidence with source;
- after source-bearing changes, refresh the tracked graph snapshot once;
- commit the graph artifact last.

Do not use graph metrics as deletion/refactor proof.

## Cost and scope discipline

Prefer:

- specification before broad traversal;
- reuse research before code invention;
- pure unit-tested synchronization math before UI wiring;
- small technical spikes for browser/media uncertainty;
- deterministic tests over repeated manual guessing;
- manual real-camera validation only where decoder/timing reality matters.

Do not spend implementation effort on deferred features until v1 core acceptance shows they are necessary.
