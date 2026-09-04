# Implementation Contract

Implement the validated MultiVideoSyncPlayer specification against the actual repository.

Specification:

`docs/specs/multi-video-sync-player-spec.md`

Implementation procedure:

`docs/implementation/implementation-plan.md`

Testing:

- `docs/testing/test-spec.md`
- `docs/testing/test-implementation-plan.md`

## Preconditions

- Read `AGENTS.md` first.
- Repository-review disposition is `validated`.
- Material specification conflicts are resolved.
- Required Phase 0 technical spikes for the intended implementation cut are complete or explicitly included as the first bounded work in the PR.

If a precondition is false, stop implementation and report the blocker.

## Required procedure

1. Confirm current repository state still matches repository-review assumptions.
2. Query CodebaseMemory for affected symbols/boundaries if an index exists; verify with source.
3. Re-read the relevant section of `docs/research/existing-solutions.md` before implementing a solved/general subsystem.
4. Derive the smallest independently reviewable implementation cut from the approved plan.
5. State the reuse decision for each major subsystem before adding code/dependencies.
6. Keep changes inside approved scope.
7. Preserve local-only and Direct Local File invariants.
8. Add focused tests with the implementation, starting with pure logic before UI/side-effect wiring.
9. Run nearest checks first.
10. Run broader lint/type/test/Rust/build checks according to risk.
11. For media/timing changes, run the required real or generated media integration evidence; do not rely only on mocks.
12. Inspect final diff, dependency changes, Tauri capabilities/CSP, and affected execution paths.
13. Update `THIRD_PARTY_NOTICES.md` if third-party source is copied/derived or a notice obligation is introduced.
14. Update implementation evidence in the PR/report.
15. If a tracked `.codebase-memory/graph.db.zst` exists, refresh it once after source/rule changes are finalized and commit the generated artifact last.

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
- reuse decisions;
- dependencies added/removed and licensing notes;
- CodebaseMemory queries/evidence used, if available;
- exact checks run and outcomes;
- specification acceptance criteria satisfied;
- real media/manual evidence where required;
- residual risks/known limitations;
- unresolved questions;
- whether the change is ready for independent review.
