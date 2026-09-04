# Repository Review Contract

Review the repository against the supplied specification before implementation.

Specification:

`docs/specs/multi-video-sync-player-spec.md`

## Preconditions

- Read `AGENTS.md` first.
- Read `docs/00_index.md`.
- Read the specification.
- Read only the supporting docs relevant to the task.

## Required procedure

1. Inspect repository metadata first: status, shallow tree, package/build files, source/test roots.
2. If CodebaseMemory exists, confirm index health and query the target symbols/boundaries before broad source reading.
3. Verify graph findings with targeted source reads and `rg`.
4. Read `docs/research/existing-solutions.md` and identify existing/platform/third-party primitives that may avoid custom implementation.
5. Trace affected interfaces:
   - React state/UI boundary;
   - media/HTMLVideoElement adapter;
   - synchronization model/controller;
   - Tauri/native filesystem boundary;
   - project schema/persistence;
   - capture path;
   - Tauri security/CSP/network-capable plugins;
   - tests/build/package paths.
6. Compare actual repository reality with every material requirement/acceptance criterion relevant to the intended implementation phase.
7. Perform the focused technical spikes in Phase 0 of `docs/implementation/implementation-plan.md` if they are not already resolved with repository evidence.
8. Review every proposed new dependency for exact need, maintenance, license, size, offline behavior, and testability.
9. Do not modify production source, tests, configuration, or specification during this review pass.

## Required reuse assessment

For each major subsystem to be touched, report one:

- reuse existing project code;
- reuse platform primitive;
- reuse third-party dependency;
- implement locally because no suitable reusable primitive exists.

If choosing third-party reuse or local reimplementation, explain why.

Do not copy source from prior-art repositories during repository review.

## Required output

Report:

- disposition: `validated`, `spec-change-required`, or `blocked`;
- repository state and relevant versions;
- affected paths and why;
- relevant existing contracts/invariants;
- CodebaseMemory evidence, if available, plus source verification;
- prior-art/reuse assessment;
- proposed dependency changes and licensing impact;
- specification conflicts or missing constraints;
- media/Tauri technical spike results;
- missing tests/validation evidence;
- proposed implementation boundary/PR cut;
- exact commands/checks run and outcomes;
- unresolved questions.

## Stop conditions

Return `spec-change-required` rather than improvising if:

- Direct Local File cannot satisfy the media architecture on target Windows/Tauri;
- required frame-timing semantics cannot be obtained without materially changing the supported-media contract;
- native-resolution capture requires a materially different architecture/runtime dependency;
- local-only behavior conflicts with a required Tauri/runtime capability;
- implementation would require a broad GPL-derived codebase or another unapproved licensing change;
- the task materially expands beyond the approved v1 boundary.

Return `blocked` if required environment/evidence is unavailable and cannot be established in the current repository session.
