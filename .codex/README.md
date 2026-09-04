# Codex Contracts

This directory contains repository-agent contracts for MultiVideoSyncPlayer.

- `repository-review.md` — reusable read-only repository/spec compatibility review contract.
- `implementation.md` — implementation and verification contract after review disposition is `validated`.
- `next-task.md` — the current bounded implementation task that is ready to run.

Always read root `AGENTS.md` first.

The authoritative specification is:

`docs/specs/multi-video-sync-player-spec.md`

Current supporting documents:

- `docs/architecture/preimplementation-decisions.md`
- `docs/implementation/initial-repository-review.md`
- `docs/implementation/implementation-plan.md`
- `docs/implementation/implementation-readiness.md`
- `docs/testing/test-spec.md`
- `docs/testing/test-implementation-plan.md`
- `docs/testing/acceptance-matrix.md`
- `docs/research/existing-solutions.md`

The initial repository review disposition is already `validated`. Unless repository reality has materially changed, the next source-bearing action should execute `next-task.md` rather than perform another architecture-selection pass.
