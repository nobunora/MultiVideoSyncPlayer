# AGENTS.md

Keep context small and act from evidence.

## Core Rules

- Read this file first.
- Read `docs/00_index.md` before opening broad documentation.
- Do not scan all docs or all source files.
- Start with metadata: `git status --short`, shallow directory listings, and `rg --files`.
- Use `rg` or symbol search to find the target before opening files.
- Open only the relevant file and line range unless structure requires a full read.
- Follow existing design, names, boundaries, and error handling.
- Do not guess specifications, compatibility, security behavior, codec behavior, or external contracts. Verify them.
- Keep one main responsibility per file or function.
- Keep diffs small and focused. Do not mix feature work, refactoring, dependency replacement, and formatting in one change.
- Do not leave debug code, commented-out code, temporary bypasses, or unfinished TODOs behind.
- Report briefly: changed files, reason, checks run, risks, and open questions.

## Product Invariants

- Runtime video and project processing is local-first.
- The default media path is Direct Local File. Do not copy user videos into OPFS, application storage, temporary upload directories, or cloud storage as part of normal use.
- The v1 runtime must not require a local web server, cloud backend, account, or external service.
- External runtime network access is prohibited by design in v1. Do not introduce updater, telemetry, analytics, remote fonts/assets, cloud sync, remote media, HTTP clients, or WebSocket dependencies without an approved specification change.
- Windows is the initial supported platform. Do not broaden platform scope inside an unrelated task.
- MP4/H.264 constant-frame-rate files are the primary v1 media contract. Do not claim exact frame semantics for unsupported codecs or VFR media without evidence.
- Synchronization state and current per-video inspection positions are separate concepts. Temporary unlock must never silently overwrite registered synchronization data.
- Persistent project state must remain human-inspectable/versioned where practical; do not replace it with an opaque binary format without an approved specification change.

## Reuse-First / No Wheel Reinvention

Before implementing a non-trivial subsystem:

1. Read `docs/research/existing-solutions.md`.
2. Search the repository for an existing implementation.
3. Check whether a maintained dependency or prior-art implementation already provides the exact primitive needed.
4. Compare reuse against custom code for maintenance cost, runtime size, security, license, determinism, and testability.
5. Prefer reuse when it clearly reduces risk or code volume.
6. Prefer a small local implementation when a dependency is substantially larger or broader than the required behavior.
7. Record the decision when adding a new dependency or deliberately reimplementing an existing known solution.

Do not copy third-party code merely because it is visible. Verify license and provenance first. In particular:

- Vodon Pro is GPL-3.0; treat it primarily as behavioral/UX prior art unless the project deliberately accepts GPL-derived code.
- Vodon Player is MIT and is safer as a source of reusable code, but reuse still requires preserving its license notice.
- `NuerSir/multi_video_sync_ffplay` contains useful synchronization ideas and an MIT license file, but it is explicitly ffplay-derived; audit provenance before copying substantial code.
- `ElizabethViera/multi-video-sync` has no license file in the repository as currently observed; use it as conceptual prior art only unless permission/licensing is established.

## CodebaseMemory

- Before proposing or implementing a code change, query CodebaseMemory for the target symbol, callers, callees, tests, and dependency boundary when an index exists.
- Confirm index health/readiness before trusting graph results.
- Verify CodebaseMemory findings with targeted source reads and `rg`.
- Treat `in_degree = 0`, low-confidence `CALLS`, similarity, and semantic relations as investigation leads, never as sufficient evidence for deletion, refactoring, or consolidation.
- Before deleting a private helper or compatibility wrapper, check direct and dynamic references, imports, test mocks/monkeypatches, current contracts, and relevant history.
- Do not rename, wrap, or restructure readable production code solely to improve graph confidence.
- Classify resolver mistakes, SDK calls, builtins, test fakes, and intentional dynamic dispatch as graph evidence rather than source defects.
- When `.codebase-memory/graph.db.zst` is tracked, use it as the initial map. Refresh it once after source or active-rule changes, commit the generated artifact last, and never refresh again merely because the artifact commit advanced `HEAD`.
- If CodebaseMemory is not initialized yet, do not invent graph evidence. Proceed with targeted repository search and initialize the graph only as part of the approved repository-index setup.

See `docs/15_codebase_memory_and_quality.md` for the detailed policy.

## Implementation Workflow

- Specification is authoritative: `docs/specs/multi-video-sync-player-spec.md`.
- Before implementation, perform repository review using `.codex/repository-review.md`.
- If repository reality materially conflicts with the specification, stop and report `spec-change-required`; do not silently redesign the product.
- Implement using `.codex/implementation.md` only after repository review is `validated`.
- Follow `docs/implementation/implementation-plan.md` unless repository review provides evidence that a step must change.
- Keep implementation increments independently testable.

## Quality Rules

For TypeScript/React changes, run applicable checks such as:

- formatter/check mode;
- ESLint;
- `tsc --noEmit`;
- focused Vitest tests;
- broader Vitest suite as risk requires.

For Rust/Tauri changes, run applicable checks such as:

- `cargo fmt --check`;
- `cargo clippy` with the project warning policy;
- focused `cargo test`;
- broader `cargo test` as risk requires.

Do not add dependencies, suppress diagnostics, or bulk auto-fix merely to make a tool clean. Triage findings against source and tests first.

## Testing Rules

- Read `docs/testing/test-spec.md` for behavioral coverage.
- Read `docs/testing/test-implementation-plan.md` before adding test infrastructure.
- Run nearest tests first.
- Never claim a test ran if it did not.
- If a check cannot run, state the exact reason and the exact command a human should run.
- Keep large/generated video fixtures out of normal repository reads.

## Generated Artifacts

- Keep generated, cache, build, log, package, and analysis paths out of normal reads.
- Do not commit generated media fixtures unless the test plan explicitly designates them as small canonical fixtures.
- If a CodebaseMemory graph snapshot is tracked, it is the final generated commit after source-bearing changes.
