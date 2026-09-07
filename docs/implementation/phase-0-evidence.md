# Phase 0 Implementation Evidence

This document records the bounded first implementation cut described in `.codex/next-task.md`. It is intentionally separate from the product specification; it records evidence and remaining checks.

## Implemented paths

- `src/platform/tauri-media.ts` owns native MP4 selection, exact-file IPC, timing IPC, and asset URL creation through the Tauri APIs; Phase 0 orchestration uses this explicit adapter directly.
- `src/media/media-controller.ts` is the imperative playback boundary around `HTMLVideoElement`; it reports active seeks, waits for `seeked` even when the target time is already current, and rejects out-of-range seeks instead of silently clamping them.
- `src/media/synchronized-playback.ts` owns explicit per-participant target validation and coordinated seek settlement. Synchronized start settles required seeks before play; Global Seek uses the same fail-closed target preflight without starting playback.
- `src/capture/capture-frame.ts` creates a Canvas at `video.videoWidth × video.videoHeight`, draws the current frame, and returns PNG bytes.
- `src/platform/tauri-capture.ts` owns the native capture dialog and PNG write IPC; Phase 0 orchestration uses this explicit adapter directly.
- `src-tauri/src/media_file.rs` owns exact-file validation/authorization and `shiguredo_mp4` timing inspection.
- `src-tauri/src/capture_io.rs` owns PNG file creation/writing.
- `src-tauri/src/lib.rs` contains Tauri module wiring and command registration only.
- `src/sync/drift-measurement.ts` derives/fixes starting offsets, records drift, and summarizes it; aggregate Phase 0 statistics exclude the master stream.
- `src/components/video-grid.tsx` owns the existing video-pane presentation and delegates state-changing callbacks.
- `src/components/measurement-panel.tsx` owns the existing drift-panel presentation and action controls, including explicit Start/Pause/Resume state and baseline-aware Reset availability.
- `src/App.tsx` owns Phase 0 state and orchestration for up to four direct-file panes, playback controls, native PNG capture, and three-video drift measurement.

## Module responsibility map

| Module | Owns | Does not own | Depends on | Used by | Test boundary |
| --- | --- | --- | --- | --- | --- |
| `src/App.tsx` | Phase 0 state, UI composition, and orchestration | low-level seek/play/pause mechanics, filesystem writes, MP4 parsing, detailed pane/panel presentation | media/capture/sync adapters, presentational components | application entry | behavior covered through pure adapter/sync tests plus manual UI acceptance |
| `src/components/video-grid.tsx` | existing video-grid/pane presentation and media event delegation | application state, playback policy, filesystem writes, MP4 parsing | `VideoAsset` and callbacks | `App.tsx` | manual WebView2/picker/playback acceptance |
| `src/components/measurement-panel.tsx` | existing drift-panel presentation and action controls | baseline derivation, recorder state, playback correction | `DriftSummary` and callbacks | `App.tsx` | manual measurement acceptance |
| `src/platform/tauri-media.ts` | Tauri dialog/core calls, exact-file preparation, asset URL, timing IPC | React state, playback policy, presentation | Tauri core/dialog APIs | `App.tsx`, `VideoAsset` type | Rust command boundary + manual native acceptance |
| `src/media/media-controller.ts` | imperative HTML video playback adapter, settled-seek behavior, playable-range enforcement | sync policy, UI, filesystem | `HTMLVideoElement` | `App.tsx`, synchronized playback | Vitest controller regression + manual WebView behavior |
| `src/media/synchronized-playback.ts` | explicit per-participant local targets, fail-closed target preflight, coordinated Global Seek, two-phase pre-play seek/play, rollback policy | UI state, dialogs, file parsing | `MediaController` | `App.tsx` | deterministic fake-controller tests |
| `src/capture/capture-frame.ts` | source-resolution Canvas PNG encoding | path selection, file writing | Canvas/video DOM APIs | `App.tsx` | Vitest source-dimension test |
| `src/platform/tauri-capture.ts` | Tauri save dialog and PNG write IPC | React state, PNG rendering, media parsing | Tauri core/dialog APIs | `App.tsx` | Rust writer boundary + manual save acceptance |
| `src/sync/drift-measurement.ts` | baseline offset derivation, drift sample creation, slave-only aggregation, percentile summary | playback correction, UI | none | `App.tsx` | Vitest baseline/offset/statistics/master-exclusion tests |
| `src-tauri/src/media_file.rs` | canonical path validation, exact asset authorization, MP4 range reads/timing inspection | capture I/O, Tauri app wiring | `std::fs`, Tauri asset scope, `shiguredo_mp4` | Tauri commands | Rust path/range/parser fixture tests |
| `src-tauri/src/capture_io.rs` | create-new PNG output write | media validation/parsing | `std::fs`/`std::io` | Tauri command | manual save acceptance; narrow command surface |
| `src-tauri/src/lib.rs` | Tauri builder/plugin/command registration | business logic and file-format logic | media/capture command modules | `main.rs` | compile/build boundary |

## Reuse decisions

| Area | Decision |
| --- | --- |
| File picker | Reuse official Tauri dialog plugin |
| Media playback | Reuse WebView2 `HTMLVideoElement` behind `MediaController` |
| File URL | Reuse Tauri asset protocol and `convertFileSrc` |
| MP4 timing | Reuse `shiguredo_mp4` 2026.5.0 after synthetic CFR spike |
| PNG encode | Reuse browser Canvas and `toDataURL("image/png")` |
| File write | Reuse Rust `std::fs` / `std::io` behind a narrow command |
| State | React built-ins only |

## Synthetic MP4 timing spike

Fixture: `tmp/phase0/synthetic-30fps-6c9a3e8.mp4`, generated with `scripts/generate-test-video.ps1` and FFmpeg 8.1.1 Essentials. The fixture is ignored and is not committed.

Current latest correctness-hardening result (`6c9a3e8`):

```text
video_track_count: 1
codec: avc1
duration_seconds: 3.0
timescale: 15360
sample_count: 90
frame_duration_seconds: 0.03333333333333333
cfr: true
```

The fixture was regenerated on Windows for the `6c9a3e8` source head with a distinct ignored output path and parsed through the targeted Rust test with `MVSP_PHASE0_FIXTURE`. The parser is fed only requested ranges. A hard per-request safety limit of 64 MiB rejects an unbounded or oversized `RequiredInput` instead of allocating the remaining multi-GB file.

## Capture and drift evidence

- The Canvas unit test verifies that output dimensions use source video dimensions rather than displayed CSS size. Native WebView2 capture and saved-PNG dimension verification remain manual acceptance checks.
- Drift measurement freezes `offset[i] = G - L[i]` at measurement start and preserves that baseline across Pause/Resume.
- Any global seek invalidates an existing measurement baseline even when measurement sampling is paused; the next Start creates a fresh baseline instead of silently reusing stale offsets.
- Participant-set changes and missing offsets fail closed. Paused-master intervals are not recorded.
- Drift recording reuses the shared slave-sample mapping helper instead of duplicating global/local error math in `App.tsx`.
- Synchronized play uses an explicit `targetTime` for every participant. When a measurement baseline exists, orchestration supplies `G - offset[i]`; without a baseline it supplies the same current master time to each participant.
- Synchronized start and Global Seek now share fail-closed participant target preflight. Global Seek requires every loaded controller, validates every target before any participant moves, and does not silently skip an unready video.
- Negative or finite-duration-overrun targets are rejected instead of being clamped to an incorrect frame.
- Synchronized playback requires all loaded video elements to have controllers before starting; it does not silently start only a ready subset.
- UI-wide playback state is recomputed from all loaded controllers. Playing one video independently no longer falsely marks synchronized playback as active or disables `Play all`.
- The measurement panel distinguishes Start, Pause, and Resume and permits Reset whenever a baseline exists, even before the first drift sample is recorded.
- Measurement Start/Resume is blocked while a Global Seek is pending or any loaded controller is still seeking, so an unsettled timestamp cannot become a baseline.
- Adding media is blocked during Global Seek; when a valid participant set changes, existing playback is paused, the baseline is cleared, and app-wide playback state is recomputed.
- Capture rejects a selected video while it is seeking, preventing a stale decoded frame from being saved for a newer target time.
- No real three-camera run has been performed on the latest source head; threshold selection and sustained drift characterization remain pending.

## Environment previously recorded

```text
node v24.15.0
npm 11.15.0
rustc 1.98.1 (48a229cea 2026-09-01)
cargo 1.98.1 (797e8a9bc 2026-08-05)
stable-x86_64-pc-windows-msvc (default)
git 2.54.0.windows.1
Visual Studio Build Tools 2026 18.6.1 (VC tools present)
WebView2 runtime present
FFmpeg 8.1.1 Essentials (developer fixture generation only)
```

## Verification status after Global Seek and unsettled-seek hardening

The previous `fbd7b9e` results recorded in `675ef1f` were treated as historical. The complete verification set was rerun on source head `6c9a3e8` after the Global Seek, unsettled-seek, participant-set, playback-state, and capture hardening.

Run on Windows from the repository root:

```powershell
npm test -- --run
npm run typecheck
npm run lint
npm run build
& "$env:USERPROFILE\.cargo\bin\cargo.exe" test --manifest-path src-tauri/Cargo.toml
& "$env:USERPROFILE\.cargo\bin\cargo.exe" fmt --manifest-path src-tauri/Cargo.toml --all -- --check
& "$env:USERPROFILE\.cargo\bin\cargo.exe" clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
$env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"
npm run tauri dev
npm run tauri build
```

Current results on `6c9a3e8`: focused media/coordinator/capture suites passed (14 tests), the full TypeScript suite passed (20 tests), 7 Rust tests passed, typecheck/lint/build/fmt/clippy passed, Tauri dev reached Vite ready and Rust debug application launch, and `npm run tauri build` produced both MSI and NSIS installers:

- `src-tauri/target/release/bundle/msi/MultiVideoSyncPlayer_0.1.0_x64_en-US.msi`
- `src-tauri/target/release/bundle/nsis/MultiVideoSyncPlayer_0.1.0_x64-setup.exe`

The regenerated fixture parsed as `avc1`, 3.0 seconds, timescale 15360, 90 samples, 0.03333333333333333 seconds/frame, CFR. The Rust test run emitted only the existing non-fatal Windows linker stdout warning. No CI/status checks are published for this repository.

The fixture command used for this run was:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/generate-test-video.ps1 -OutputPath "tmp/phase0/synthetic-30fps-6c9a3e8.mp4"
$env:MVSP_PHASE0_FIXTURE = (Resolve-Path "tmp/phase0/synthetic-30fps-6c9a3e8.mp4").Path
& "$env:USERPROFILE\.cargo\bin\cargo.exe" test --manifest-path src-tauri/Cargo.toml validates_phase0_fixture_when_requested -- --nocapture
```

Manual acceptance delegated to Windows remains:

- native multi-file selection and WebView2 decoding;
- no full-file copy and no source modification (record source size/mtime, optionally hash);
- three-camera start/pause/resume with non-zero baseline offsets preserved;
- pause measurement, perform a global seek, then verify Resume is no longer offered and a new baseline is created on Start;
- independently play one video and verify `Play all` remains available until all loaded videos are actually playing;
- attempt measurement Start/Resume while Global Seek or a native seek is pending and verify no baseline is created/resumed;
- add a video while existing participants are playing and verify playback pauses, the baseline clears, and app-wide state becomes not-playing;
- attempt Add Video while Global Seek is pending and verify participant mutation is declined;
- verify Global Seek does not silently skip an unready loaded video;
- exercise an out-of-range Global Seek / mapped target and verify no participant is moved before the preflight failure;
- attempt capture while the selected video is seeking and verify it is declined, then confirm normal capture after seek settlement;
- saved PNG dimension verification against `videoWidth × videoHeight`, preferably with representative 4K media;
- three-camera drift characterization with duration + median/p95/max slave error;
- AKASO V50 Elite representative MP4 timing/parser/playback evidence, or an explicit pending result if no sample is available.

## Scope exclusions

This cut does not implement manual sync registration, named sync points, temporary unlock/restore, project persistence, final global timeline semantics, exact frame-step controls, continuous drift correction, or a polished capture panel.
