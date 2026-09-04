# Implementation Plan

## Purpose

This document turns `docs/specs/multi-video-sync-player-spec.md` into an ordered, reviewable implementation procedure.

Implementation must remain reuse-first and must not expand v1 scope without a specification change.

---

## Phase 0 — Repository review and technical spikes

Before production code:

1. Read `AGENTS.md`.
2. Read the specification and `docs/research/existing-solutions.md`.
3. Run `.codex/repository-review.md` and record disposition.
4. Confirm Windows toolchain availability:
   - Node.js package manager;
   - Rust stable toolchain;
   - Tauri prerequisites;
   - WebView2 runtime;
   - Git.
5. Record exact versions.
6. Make the smallest possible proof/spike for the unresolved media questions before building full UI.

### Spike A — Direct Local File playback

Prove that a Tauri file picker can select a local MP4 and that WebView2 can play it directly without copying it into application storage.

Evidence required:

- selected path;
- no full-file copy created by the app;
- video duration/width/height visible;
- file remains unmodified.

### Spike B — frame-rate metadata

Evaluate existing small maintained solutions for extracting reliable CFR/sample timing from MP4.

Do not write a parser first.

For each candidate record:

- package/project name and version;
- license;
- maintenance status;
- browser/Tauri compatibility;
- bundle/native size;
- whether it returns exact/usable sample rate or frame timing;
- test result on target AKASO MP4.

Select the smallest solution that meets the exact requirement.

### Spike C — native frame capture

Validate:

1. local video loads through the chosen Tauri/WebView URL mechanism;
2. frame can be drawn to Canvas at `videoWidth × videoHeight`;
3. PNG can be written through the local filesystem layer;
4. saved PNG dimensions match source dimensions.

If this passes, do not introduce FFmpeg runtime capture.

### Spike D — multi-video drift characterization

Load three known CFR clips and measure natural divergence under synchronized `.play()` starts.

Collect:

- actual local media times;
- master/global expected times;
- max/median error over at least 10 minutes where feasible;
- behavior after pause/resume;
- behavior after global seek.

Use this evidence to choose initial drift correction thresholds.

### Phase 0 stop condition

Do not proceed to broad feature implementation if Direct Local File playback, target-media metadata, or native frame capture is blocked by the selected architecture. Return `spec-change-required` with evidence.

---

## Phase 1 — Scaffold minimal Tauri application

### Goal

Create the smallest production shell needed for the product.

### Preferred stack

- Tauri 2;
- Vite;
- React;
- TypeScript strict mode;
- Rust stable.

### Dependency policy

Prefer official Tauri capabilities/plugins for:

- native file open dialog;
- save dialog where needed;
- controlled filesystem access.

Do not add:

- UI component framework;
- state-management library;
- networking plugin;
- updater;
- telemetry SDK;
- cloud SDK;
- FFmpeg runtime dependency;

unless a focused requirement proves it necessary.

### Initial layout

Proposed source shape:

```text
src/
  app/
    App.tsx
    app-state.ts
  media/
    media-types.ts
    media-metadata.ts
    video-controller.ts
  sync/
    sync-types.ts
    sync-model.ts
    sync-controller.ts
    drift-policy.ts
  project/
    project-schema.ts
    project-io.ts
    path-resolution.ts
  capture/
    capture-frame.ts
    capture-view.ts
  ui/
    VideoGrid.tsx
    VideoPane.tsx
    RightPane.tsx
    SyncControls.tsx
    CaptureControls.tsx
  main.tsx
src-tauri/
  src/
    lib.rs
    filesystem.rs (only if a thin custom boundary is required)
```

Do not create empty abstraction layers purely to match this diagram. Actual repository review may simplify it.

### Exit criteria

- app starts as installed/dev Tauri app;
- no local web server is needed in production build;
- lint/type/check/test commands exist;
- no external runtime network dependency exists.

---

## Phase 2 — Define domain state before UI complexity

Create explicit TypeScript domain types.

### Video record

Suggested shape:

```ts
interface VideoSource {
  id: string;
  label: string;
  absolutePath: string;
  relativePath?: string;
  fileName: string;
  fileSize: number;
  duration: number;
  width: number;
  height: number;
  frameRate?: number;
  frameRateStatus: 'verified-cfr' | 'unknown' | 'unsupported-vfr';
}
```

Do not persist runtime HTML element references in project JSON.

### Runtime video state

Keep runtime element/controller references separate from persistence model.

Suggested concepts:

- current local time;
- loaded/ready/error state;
- temporary unlocked position;
- muted/volume only if needed by UI.

### Synchronization state

Use explicit enum:

```ts
type SyncState = 'NOT_SET' | 'LOCKED' | 'TEMPORARILY_UNLOCKED';
```

### Sync point

Store a stable ID, name, per-video local times, and any derived offsets needed to reconstruct the relationship.

### Reducer/state owner

Start with React `useReducer`/Context or equivalent built-in primitives. Add a state library only if actual implementation complexity demonstrates a need.

### Exit criteria

Unit tests exist for serialization-safe domain structures and state transitions before complex UI wiring.

---

## Phase 3 — File open and media preparation

### Multi-file open

Implement native multi-select.

For every selected file:

1. validate extension/container expectation;
2. stat file for size/path;
3. create a safe local media URL/handle for WebView2;
4. load video metadata;
5. run selected media metadata parser only as needed for CFR/frame timing;
6. create `VideoSource`;
7. add it to ordered project state.

### Error handling

A bad file must not prevent other selected files from opening.

Show per-file failure with reason.

### Direct-file invariant test

Add a test/manual evidence step that no application-owned copy matching the full source file is created.

---

## Phase 4 — Minimal split video UI

Implement the viewing surface with simple CSS Grid/flex.

### Required behavior

- one pane per loaded video;
- 1–4 pane adaptive layout first;
- editable or easily changeable short label;
- active pane selection;
- no heavyweight layout editor.

### Per-video alignment controls

When sync state is `NOT_SET` or `TEMPORARILY_UNLOCKED`, expose minimal per-pane controls needed to:

- play/pause that pane;
- seek that pane;
- previous/next frame if supported.

When `LOCKED`, disable/hide individual timeline manipulation that would violate shared sync, except safe pane selection.

---

## Phase 5 — Global timeline and static offset model

Implement pure synchronization math first.

### Core functions

Proposed pure functions:

```ts
localTimeFromGlobal(globalTime, offset): number
globalTimeFromLocal(localTime, offset): number
buildOffsetsFromAlignedPositions(alignedLocalTimes, referenceVideoId): OffsetMap
```

Exact sign convention must be documented with tests.

### Bounds

Mapping must handle:

- negative expected local time before a file's synchronized start;
- expected time after one file ends;
- videos with different durations.

Do not seek to invalid negative/out-of-range values.

Decide presentation behavior explicitly, e.g. hold/blank/end state for a video outside its local valid range.

### Exit criteria

Pure unit tests cover offset mapping and boundaries before DOM playback coordination.

---

## Phase 6 — Register sync point and lock state

### Register flow

From independent aligned positions:

1. gather every loaded video's local time;
2. choose the current reference/global point;
3. derive offsets;
4. create named sync point;
5. set it active;
6. move to `LOCKED`.

### Right pane

Add synchronization section with:

- status;
- sync point selector;
- Register;
- Update;
- Temporary Unlock.

Do not add duplicate toolbar systems.

### Tests

- register from three different local times;
- resulting global mapping returns all three registered positions;
- entering LOCKED preserves data;
- incomplete/missing video position cannot create corrupt point.

---

## Phase 7 — Synchronized seek, play, pause, frame step

### Global seek

Implement a controller that maps global target time to each local target.

For each video:

1. clamp/handle out-of-range state explicitly;
2. seek local target;
3. wait for seek/display readiness as needed;
4. expose completion/error state.

### Play

Before synchronized playback:

1. compute expected local target for all videos;
2. compare actual current time;
3. correct material stale positions;
4. only then issue play operations;
5. establish/refresh master/global playback timebase.

### Pause

Pause all participating videos and freeze global reference.

### Frame step

For `verified-cfr` active/master video:

1. pause all videos;
2. derive one frame duration;
3. adjust global time ±frame duration;
4. global seek all videos;
5. wait for visible frame settle where feasible;
6. update time display.

Disable exact-frame controls with an explanation for media lacking verified CFR timing.

---

## Phase 8 — Drift controller

### Design source

Use the master-clock/error-correction principle documented from `NuerSir/multi_video_sync_ffplay`, but implement it natively for HTMLVideoElement/WebView2 without copying uncertain-provenance code.

### Proposed controller loop

At a modest interval while playing:

1. read master/global media time;
2. for each slave compute expected local time;
3. read actual local time;
4. compute `error = actual - expected`;
5. classify with named thresholds;
6. ignore small error;
7. correct only material error.

### Important

Do not seek every animation frame.

### Threshold implementation

Store named values in one policy module, e.g.:

```ts
interface DriftPolicy {
  ignoreBelowSeconds: number;
  hardCorrectAboveSeconds: number;
  sampleIntervalMs: number;
}
```

Values come from Phase 0 measurements, not arbitrary magic numbers.

### Future-compatible design

Keep policy separable so a later gentle playback-rate trim can be added without rewriting sync domain data.

---

## Phase 9 — Temporary unlock / restore / re-sync / undo

### Temporary Unlock

On transition LOCKED → TEMPORARILY_UNLOCKED:

- snapshot current synchronization relationship and global reference;
- preserve active sync point and offsets;
- enable individual controls.

### Restore Sync

- restore registered sync relationship;
- restore/recompute each local position from saved global reference;
- transition to LOCKED.

### Re-sync Here

Collect current per-video positions and present explicit action:

- Save as New;
- Replace Current;
- Cancel.

### Undo

Implement a small ring/stack of sync snapshots rather than a general command framework.

Unit tests must verify temporary movement cannot mutate registered offsets accidentally.

---

## Phase 10 — Project schema and persistence

Define schema centrally and version from day one.

### Serializer

Use ordinary typed JSON serialization with explicit validation on load.

Do not rely on TypeScript interfaces alone for untrusted/malformed local JSON input. Use a small validation strategy; evaluate whether a lightweight schema validator already in the dependency graph can be reused before adding one.

### Save

Implement atomic/recoverable local save.

Suggested flow:

1. create normalized project DTO;
2. validate serializable state;
3. stringify with readable indentation;
4. write temp file;
5. replace destination safely;
6. clear dirty state only after success.

### Load

1. parse JSON;
2. validate schemaVersion;
3. resolve media paths;
4. load sources;
5. verify identity metadata where practical;
6. restore sync points/offsets/layout/global time;
7. never auto-play immediately after load.

### Missing path repair

Implement `Locate File` first.

Implement `Locate Folder` only after single-file relocation works and a deterministic candidate match strategy is tested.

### Relative path

Use established Rust/JS path utilities; do not implement path normalization manually.

---

## Phase 11 — Capture

### Current video native frame

Use the validated Canvas path from Phase 0.

Steps:

1. ensure frame is settled;
2. create/reuse canvas with source width/height;
3. draw video;
4. encode PNG;
5. write bytes through Tauri filesystem layer;
6. verify output dimensions.

### All video frames

Pause/synchronize first, then capture each pane's mapped local frame. Do not capture while some panes are still seeking.

### Multi-video view

Capture the app's video-grid region using the smallest reliable existing approach. Evaluate an established DOM/canvas capture library only if native browser/Canvas composition cannot do it simply.

Do not pull in a broad screenshot framework without need.

---

## Phase 12 — Local-only hardening

Audit dependencies and built output for external network behavior.

### Required actions

- no updater plugin;
- no HTTP plugin unless required internally and externally blocked;
- no analytics;
- no remote assets/fonts;
- restrictive Tauri/CSP configuration compatible with local media and internal IPC;
- no hard-coded external URLs invoked at runtime.

### Verification

Run app through normal workflow while monitoring process network connections on Windows.

Record evidence in implementation PR.

---

## Phase 13 — Test fixtures and full verification

Follow `docs/testing/test-implementation-plan.md`.

Before release candidate:

- TypeScript unit/integration tests pass;
- Rust tests pass;
- lint/type/fmt/clippy pass;
- production Tauri build succeeds;
- generated synthetic offset videos pass synchronization cases;
- three real AKASO videos pass manual acceptance;
- network-isolation check passes;
- native PNG dimensions verified;
- project save/restore verified across app restart.

---

## Phase 14 — CodebaseMemory

Once meaningful source exists:

1. initialize/refresh CodebaseMemory using the project-standard tooling available in the environment;
2. verify index health;
3. query key boundaries:
   - sync controller;
   - project persistence;
   - capture boundary;
   - Tauri filesystem commands;
   - UI state owner;
4. verify graph evidence against source;
5. if `.codebase-memory/graph.db.zst` is the shared tracked artifact, regenerate it once after the source-bearing changes are finalized;
6. commit the graph artifact last;
7. do not regenerate again solely because the graph artifact commit changed HEAD.

---

## Phase 15 — Packaging

Create a Windows installable build using the normal Tauri packaging path.

### Initial release requirements

- Windows package/install artifact;
- documented WebView2 prerequisite/installer behavior;
- no cloud dependency;
- local-only behavior preserved in release build;
- README basic usage;
- third-party notices up to date.

Do not add automatic updater in v1.

---

## Implementation PR boundaries

Prefer several focused PRs rather than one giant implementation.

Recommended cuts:

1. `scaffold + direct local playback + metadata spike`
2. `multi-video UI + sync domain + manual alignment`
3. `locked playback + seek + frame step + drift correction`
4. `temporary unlock + sync points + undo`
5. `project persistence + relocation`
6. `capture`
7. `local-only hardening + packaging + release validation`

Each PR must be independently reviewable and must not include unrelated cleanup.
