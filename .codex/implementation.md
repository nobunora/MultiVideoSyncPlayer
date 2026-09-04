# Implementation Contract

Implement the validated MultiVideoSyncPlayer specification against the actual repository.

Specification:

`docs/specs/multi-video-sync-player-spec.md`

Frozen implementation-detail decisions:

- `docs/architecture/preimplementation-decisions.md`
- `docs/architecture/module-boundaries.md`

Implementation procedure:

`docs/implementation/implementation-plan.md`

Testing:

- `docs/testing/test-spec.md`
- `docs/testing/test-implementation-plan.md`
- `docs/testing/acceptance-matrix.md`

Current first implementation cut:

`.codex/next-task.md`

## Preconditions

- Read `AGENTS.md` first.
- Read `docs/architecture/module-boundaries.md` before a source-bearing change.
- The relevant repository-review disposition is `validated`.
- Material specification conflicts are resolved.
- Required Phase 0 technical spikes for the intended implementation cut are complete or explicitly included as the first bounded work in the PR.

The initial greenfield repository review is recorded at:

`docs/implementation/initial-repository-review.md`

If a precondition is false, stop implementation and report the blocker.

## Required procedure

1. Confirm current repository state still matches repository-review assumptions.
2. Query CodebaseMemory for affected symbols/boundaries if an index exists; verify with source. Before the first meaningful source exists, absence of a graph is expected—do not create a fake empty graph.
3. Re-read the relevant section of `docs/research/existing-solutions.md` before implementing a solved/general subsystem.
4. Derive the smallest independently reviewable implementation cut from the approved plan/current task.
5. **Before writing implementation code, produce a concise module responsibility map for every touched/new module:** `owns`, `does not own`, `depends on`, `used by`, `test boundary`.
6. Check the proposed dependency direction against `docs/architecture/module-boundaries.md`; remove accidental cycles and catch-all modules before implementation.
7. State the reuse decision for each major subsystem before adding code/dependencies.
8. Keep changes inside approved scope.
9. Preserve local-only and Direct Local File invariants.
10. Add focused tests with the implementation, starting with pure logic before UI/side-effect wiring.
11. Run nearest checks first.
12. Run broader lint/type/test/Rust/build checks according to risk.
13. For media/timing changes, run the required real or generated media integration evidence; do not rely only on mocks.
14. Inspect final diff, dependency changes, Tauri capabilities/CSP, affected execution paths, **module ownership, dependency direction, and file responsibility**.
15. Split files when independent reasons to change/test are mixed; merge/co-locate trivial pieces when separation adds no boundary value. Do not use line count alone as a splitting rule.
16. Update `THIRD_PARTY_NOTICES.md` if third-party source is copied/derived or a notice obligation is introduced.
17. Update implementation evidence in the PR/report.
18. Once meaningful source exists, initialize/query CodebaseMemory before the next non-trivial source change. If a tracked `.codebase-memory/graph.db.zst` exists, refresh it once after source/rule changes are finalized and commit the generated artifact last.

## Module/file responsibility rule

Treat module and file organization as part of correctness, not cleanup after implementation.

Required:

- one primary reason to change per file;
- pure synchronization/project policy kept independent from React/Tauri/filesystem effects where practical;
- UI expresses intent but does not reproduce synchronization math or native I/O;
- Rust owns narrow trusted I/O/platform operations, not duplicate application business logic;
- cross-feature imports use narrow stable contracts rather than another feature's internal implementation;
- no circular dependencies between feature modules;
- no generic dumping-ground `utils`, `helpers`, `common`, `services`, `manager`, or broad `filesystem` module;
- no speculative abstraction or placeholder directory solely for future features;
- no one-function/one-type file explosion unless ownership, reuse, testability, or reviewability clearly benefits.

The normative ownership map and split/merge criteria are in `docs/architecture/module-boundaries.md`.

## Dependency rule

Before adding a dependency, record:

- feature required;
- alternative platform/existing primitives considered;
- selected package/version;
- license;
- maintenance status;
- runtime/bundle/native size impact;
- network/offline behavior;
- why it is preferable to a small local implementation.

Do not add a dependency merely because the implementation is familiar with it.

## Prior-art rule

- Do not copy Vodon Pro GPL-3.0 source into the MIT codebase without an explicit specification/licensing decision.
- Vodon Player MIT code may be selectively reused with required notice preservation.
- Do not copy substantial `multi_video_sync_ffplay` code until ffplay/FFmpeg provenance for the exact source is audited.
- Do not copy `ElizabethViera/multi-video-sync` source while its license remains unidentified.

Concepts/algorithms may be independently implemented from documented behavior and general principles.

## Stop conditions

Stop and return to specification adjudication if:

- repository reality materially contradicts the validated specification;
- an unapproved public/persistent data-format change is required;
- local-only must be weakened;
- Direct Local File must be replaced with mandatory media import/copy;
- supported media contract must materially change;
- a GPL/incompatible licensing dependency becomes necessary;
- implementation surface expands materially beyond the approved PR cut.

## Required final report

Report briefly but concretely:

- implementation PR scope;
- changed files and reasons;
- **module responsibility map and any intentional boundary exceptions**;
- reuse decisions;
- dependencies added/removed and licensing notes;
- CodebaseMemory queries/evidence used, if available;
- exact checks run and outcomes;
- specification/acceptance-matrix criteria satisfied;
- real media/manual evidence where required;
- residual risks/known limitations;
- unresolved questions;
- whether the change is ready for independent review.
