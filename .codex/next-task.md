# Next Codex Task — Foundation + Direct Local Playback

Status: **READY TO IMPLEMENT**

This is the next repository-agent task. It is intentionally bounded to the first source-bearing PR.

## Contract

Implement the first approved cut from:

- `docs/specs/multi-video-sync-player-spec.md`
- `docs/architecture/preimplementation-decisions.md`
- `docs/architecture/module-boundaries.md`
- `docs/implementation/initial-repository-review.md`
- `docs/implementation/implementation-readiness.md`
- `docs/testing/test-spec.md`
- `docs/testing/test-implementation-plan.md`
- `docs/testing/acceptance-matrix.md`

Use `.codex/implementation.md` as the general implementation contract.

Repository-review disposition is already:

```text
validated
```

Do not redo architecture selection unless repository/tool evidence contradicts a frozen assumption.

## Goal

Create the minimal Tauri/React/TypeScript application foundation and prove the four Phase 0 assumptions:

1. Direct Local File playback works without copying the video.
2. MP4/CFR timing metadata can be extracted with a small existing parser.
3. Native-resolution Canvas PNG capture works.
4. Three-video drift can be measured repeatably.

This PR is not the full product.

## Required implementation sequence

### 1. Preflight

Read `AGENTS.md` first.

Record:

```powershell
node --version
npm --version
rustc --version
cargo --version
rustup show active-toolchain
git --version
```

Use Node 24 LTS and Rust stable when available.

### 2. Module responsibility preflight

Before writing production implementation code, read `docs/architecture/module-boundaries.md` and write a concise responsibility map in the implementation notes/PR draft for every module expected in this first cut.

For each module/path record:

```text
owns:
does not own:
depends on:
used by:
test boundary:
```

For the first PR, keep the source structure minimal. Do **not** create future `sync/`, `project/`, or other placeholder directories simply because the later architecture mentions them.

Expected ownership is approximately:

```text
frontend app composition
media source/playback adapter
Canvas capture spike
thin Tauri frontend adapter only if shared calls justify it
Rust app/command wiring
Rust media-file validation/scope/metadata
Rust capture-byte output
```

Before implementation, reject or revise a proposed layout if it:

- mixes React rendering with raw Tauri/filesystem logic;
- mixes synchronization/product policy into native I/O;
- creates circular feature imports;
- creates a broad `utils`, `services`, `common`, `helpers`, `manager`, or catch-all `filesystem` module;
- splits tiny one-use helpers/interfaces into separate files without a current ownership/testability benefit.

Line count alone is not a file-splitting criterion. Split by independent reason to change, side-effect boundary, or materially different test strategy.

### 3. Scaffold

Use the official Tauri React + TypeScript + npm template.

Product values:

```text
Project: MultiVideoSyncPlayer
Identifier: io.github.nobunora.multivideosyncplayer
```

Preserve all existing repository docs/contracts/license. Do not replace them with template README/license files.

Remove generator demo content after startup is proven.

### 4. Keep dependencies minimal

Allowed initially:

- official Tauri scaffold dependencies;
- official Tauri dialog plugin.

Then evaluate only one MP4 timing parser at a time.

First candidate:

```text
shiguredo_mp4 2026.5.x
```

Keep it only if the spike demonstrates required timing information cleanly.

Do not add:

- FFmpeg runtime;
- updater;
- HTTP plugin;
- telemetry;
- state framework;
- UI framework;
- router without need;
- Zod/Ajv;
- html2canvas;
- database;
- E2E framework.

### 5. Direct Local File proof

Implement native multi-select for `.mp4`.

For selected files:

- retain original absolute path;
- create WebView2-playable local asset URL through Tauri asset protocol;
- render simple video panes;
- obtain duration/width/height;
- handle one bad file without aborting others;
- prove no full-file application copy is created;
- never write to loaded video paths.

Asset scope must stay narrow to exact user-selected files.

### 6. Rust filesystem boundary

Use narrow Rust commands/helpers where needed for:

- stat/validation;
- exact path authorization for asset protocol;
- metadata parsing;
- capture byte writing.

Do not grant general frontend filesystem access merely for convenience.

Keep `lib.rs` as wiring/registration. Do not let one generic `filesystem.rs` become the permanent owner of media authorization/metadata, project persistence, and capture output. In this first spike a tiny temporary co-location is acceptable only while the responsibilities are genuinely still one small concern; split when independent reasons to change appear.

### 7. Local-only CSP

Configure a restrictive CSP that permits only:

- bundled application resources;
- Tauri internal IPC;
- local Tauri asset protocol;
- local media/blob/data resources actually required.

Do not allow general remote HTTP(S) origins.

Do not add remote assets/fonts.

### 8. Timing metadata spike

Evaluate `shiguredo_mp4` on a representative H.264 MP4.

Prove or report failure for:

- video track detection;
- duration/timescale;
- sample timing;
- usable CFR classification;
- incremental/range-based reading rather than whole multi-GB read.

Do not infer exact CFR solely from average frame count divided by duration.

If the candidate fails materially, remove it and document evidence before evaluating the next candidate from the architecture decision. Do not keep two parsers.

### 9. Native capture spike

For one paused/settled video:

- create Canvas at source `videoWidth × videoHeight`;
- draw current frame;
- encode PNG;
- write it locally through narrow boundary;
- verify saved PNG dimensions equal source video dimensions.

No final Capture UI is required.

### 10. Drift measurement spike

Create the smallest repeatable measurement mechanism for three videos.

Capture:

```text
sample time
master/global current time
video id
expected local time
actual local time
error
```

Measure:

- initial start;
- steady playback;
- pause/resume;
- seek/resume.

Summarize median/p95/max absolute error.

Do not implement the final drift correction controller in this PR.

### 11. Boundary review before tests/final report

Before declaring the implementation ready:

- verify every changed file has one primary responsibility;
- verify no module cycle exists;
- verify UI does not own raw filesystem/Tauri or future synchronization policy;
- verify Rust is a thin I/O/platform boundary, not duplicate business logic;
- verify no speculative placeholder abstractions were introduced;
- co-locate or remove abstractions that only forward calls and add no validation, ownership, testability, or platform boundary;
- split any file that now mixes independently changing media, capture, UI, or native-I/O concerns.

Record intentional exceptions in the PR responsibility map.

### 12. Tests/checks

Add focused unit/Rust tests with the code.

Run and report exact status for:

```powershell
npm test -- --run
npm run typecheck
npm run lint
cargo test --manifest-path src-tauri/Cargo.toml
cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
npm run tauri build
```

Adapt script spelling only if the generated scaffold uses another standard name.

If packaged build cannot run because a required Windows toolchain component is unavailable, report the exact missing prerequisite and preserve all other evidence.

## Test media

Do not commit private/user footage.

Use small redistributable/generated MP4 fixtures where possible. FFmpeg may be used by a developer/test fixture generation script but must not become a product runtime dependency.

If a representative AKASO V50 Elite file is available locally, include manual spike evidence. If unavailable, mark target-camera verification pending; never fabricate the result.

## Reuse decisions required in final PR report

For each major area, state one line:

```text
file picker -> Tauri dialog reused
media playback -> WebView2 HTMLVideoElement reused
file URL -> Tauri asset protocol reused
MP4 timing -> selected existing parser or documented rejection
PNG encode -> browser Canvas reused
file write -> Rust std::fs reused
state -> React built-ins only
```

Explain any deviation.

## Scope exclusions

Do not implement in this PR:

- final manual sync registration;
- named Sync Points;
- Temporary Unlock;
- Restore Sync;
- Re-sync Here;
- final global timeline;
- final frame-step workflow;
- final drift correction;
- project save/load;
- autosave;
- final Capture panel;
- polished UI;
- packaging/release optimization beyond what is needed to prove build.

Do not perform unrelated cleanup/refactoring.

## Stop and report `spec-change-required` if

- Direct Local File cannot satisfy target playback without copying source files;
- required target MP4 timing cannot be obtained with a reasonable existing parser and the architecture would need to change;
- native Canvas capture cannot produce source-resolution frame images;
- local-only operation requires remote network access;
- an incompatible copyleft dependency appears necessary.

Do not silently change to Electron, bundled FFmpeg, server-side processing, OPFS import, or cloud architecture.

## Definition of done

Open one focused implementation PR that contains:

- minimal working Tauri foundation;
- Direct Local File playback proof;
- timing parser spike result;
- native capture spike result;
- drift measurement result/path;
- restrictive CSP;
- focused tests;
- exact checks and environment versions;
- dependency/license/reuse table;
- **module responsibility map and boundary review result**;
- remaining evidence clearly marked;
- no out-of-scope product features.

After source exists, initialize/query CodebaseMemory according to `AGENTS.md` before the next non-trivial PR. If a shared graph artifact is tracked, generate it once after the source changes are final and commit it last.
