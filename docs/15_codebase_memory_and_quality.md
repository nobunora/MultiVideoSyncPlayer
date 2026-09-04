# CodebaseMemory and Quality Audit

## Graph-Guided Investigation

Use CodebaseMemory to narrow code exploration before a design or implementation decision.

Required sequence when an index exists:

1. confirm index health/readiness;
2. query the target symbol/module;
3. inspect callers;
4. inspect callees/dependencies;
5. inspect focused tests;
6. inspect persistence/Tauri/UI boundaries where relevant;
7. verify graph findings with targeted source reads and `rg`.

Graph signals are not proof.

An unused-node candidate, `in_degree = 0`, low-confidence call edge, similarity score, or semantic relation must be checked against:

- direct references;
- dynamic references;
- React registration/composition;
- Tauri command registration;
- callbacks/event handlers;
- tests/mocks;
- compatibility seams;
- current contracts;
- relevant history.

Do not delete/refactor production code solely because the graph suggests it is unused.

## Readability over graph confidence

Do not rename, wrap, split, or restructure otherwise readable production code solely to improve CodebaseMemory resolution.

Resolver gaps, browser/platform APIs, Tauri generated boundaries, test fakes, and intentional dynamic dispatch should be recorded as graph limitations rather than treated as source defects.

## Shared graph artifact

If the repository tracks:

`.codebase-memory/graph.db.zst`

then:

- treat it as a derived snapshot of the latest source-bearing commit;
- use it as the initial map at task start;
- refresh it once after source or active indexing-rule changes are finalized;
- commit it as the final generated commit/change;
- do not refresh again merely because committing the artifact moved `HEAD`;
- do not create graph-only refresh loops.

If the repository does not yet have a CodebaseMemory graph, do not fabricate one or block specification-only work. Initialize it once meaningful source exists and the project-standard CodebaseMemory tooling is available.

## Required queries for major changes

For synchronization changes, investigate:

- sync domain model;
- global/local mapping helpers;
- playback controller;
- drift policy/controller;
- UI actions invoking synchronization;
- focused sync tests.

For project persistence changes, investigate:

- project schema;
- serializer/parser;
- path resolver;
- Tauri/Rust file I/O boundary;
- load/save UI wiring;
- persistence tests.

For capture changes, investigate:

- media/video adapter;
- frame capture;
- multi-view capture;
- file writer;
- capture UI;
- capture tests.

For Tauri boundary/security changes, investigate:

- capabilities/plugins;
- command registration;
- CSP/configuration;
- filesystem scopes;
- any network-capable dependency;
- packaging configuration.

## Quality-Audit Decision Rules

Run independent applicable checks before relying on tests alone.

TypeScript/React examples:

- ESLint;
- `tsc --noEmit` or repository typecheck script;
- dependency/use checks if configured;
- architecture/import boundary checks if configured.

Rust examples:

- `cargo fmt --check`;
- `cargo clippy`;
- compiler warnings;
- dependency/advisory tooling only when configured and interpreted correctly.

A failed tool is a diagnostic, not automatic permission to rewrite code.

For each finding, classify it as:

- verified defect;
- safe cleanup;
- compatibility/platform boundary;
- tool/configuration gap;
- pre-existing advisory debt;
- insufficient evidence.

Fix only verified defects and intentional safe cleanups inside task scope; then rerun the reporting tool and focused tests.

## Dependency review

Before adding a runtime dependency record:

- exact feature it replaces;
- maintenance status;
- license;
- security/advisory concerns;
- bundle/runtime size impact;
- native build implications;
- offline/network behavior;
- testability;
- why platform/standard-library/project code is insufficient.

This is especially important for media parsing, screenshot/capture, state management, and any FFmpeg-related package.

## Reuse evidence

When the task touches a problem already investigated in `docs/research/existing-solutions.md`, the implementation report must state how that prior art affected the decision.

Do not claim an implementation is original or necessary without checking the documented alternatives.
