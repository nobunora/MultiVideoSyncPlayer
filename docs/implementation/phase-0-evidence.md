# Phase 0 Implementation Evidence

This document records the bounded first implementation cut described in `.codex/next-task.md`. It is intentionally separate from the product specification; it records evidence and remaining checks.

## Implemented paths

- `src/media/local-file.ts` exposes the feature-facing MP4 selection/prepare/timing API without owning Tauri calls.
- `src/platform/tauri-media.ts` owns native MP4 selection, exact-file IPC, timing IPC, and asset URL creation through the Tauri APIs.
- `src/media/media-controller.ts` is the imperative playback boundary around `HTMLVideoElement`; it reports active seeks and waits for `seeked` even when the target time is already current.
- `src/media/synchronized-playback.ts` coordinates the two-phase synchronized start: settle all required seeks, then play all participants, rolling back on play failure.
- `src/capture/capture-frame.ts` creates a Canvas at `video.videoWidth × video.videoHeight`, draws the current frame, and returns PNG bytes.
- `src/capture/capture-io.ts` exposes the feature-facing capture output API without owning Tauri calls.
- `src/platform/tauri-capture.ts` owns the native capture dialog and PNG write IPC.
- `src-tauri/src/media_file.rs` owns exact-file validation/authorization and `shiguredo_mp4` timing inspection.
- `src-tauri/src/capture_io.rs` owns PNG file creation/writing.
- `src-tauri/src/lib.rs` contains Tauri module wiring and command registration only.
- `src/sync/drift-measurement.ts` derives/fixes starting offsets, records drift, and summarizes it; aggregate Phase 0 statistics exclude the master stream.
- `src/components/video-grid.tsx` owns the existing video-pane presentation and delegates state-changing callbacks.
- `src/components/measurement-panel.tsx` owns the existing drift-panel presentation and delegates measurement actions.
- `src/App.tsx` owns Phase 0 state and orchestration for up to four direct-file panes, playback controls, native PNG capture, and three-video drift measurement.

## Module responsibility map

| Module | Owns | Does not own | Depends on | Used by | Test boundary |
| --- | --- | --- | --- | --- | --- |
| `src/App.tsx` | Phase 0 state, UI composition, and orchestration | low-level seek/play/pause mechanics, filesystem writes, MP4 parsing, detailed pane/panel presentation | media/capture/sync adapters, presentational components | application entry | behavior covered through pure adapter/sync tests plus manual UI acceptance |
| `src/components/video-grid.tsx` | existing video-grid/pane presentation and media event delegation | application state, playback policy, filesystem writes, MP4 parsing | `VideoAsset` and callbacks | `App.tsx` | manual WebView2/picker/playback acceptance |
| `src/components/measurement-panel.tsx` | existing drift-panel presentation and action controls | baseline derivation, recorder state, playback correction | `DriftSummary` and callbacks | `App.tsx` | manual measurement acceptance |
| `src/media/local-file.ts` | feature-facing MP4 selection, preparation, and timing API | raw Tauri calls, playback policy, capture output | `platform/tauri-media` | `App.tsx` | Rust media-file tests + manual picker/playback acceptance |
| `src/platform/tauri-media.ts` | Tauri dialog/core calls, exact-file preparation, asset URL, timing IPC | React state, playback policy, presentation | Tauri core/dialog APIs | `media/local-file.ts` | Rust command boundary + manual native acceptance |
| `src/media/media-controller.ts` | imperative HTML video playback adapter and settled-seek behavior | sync policy, UI, filesystem | `HTMLVideoElement` | `App.tsx`, synchronized playback | Vitest controller regression + manual WebView behavior |
| `src/media/synchronized-playback.ts` | two-phase pre-play seek/play/rollback policy | UI state, dialogs, file parsing | `MediaController` | `App.tsx` | deterministic fake-controller tests |
| `src/capture/capture-frame.ts` | source-resolution Canvas PNG encoding | path selection, file writing | Canvas/video DOM APIs | `App.tsx` | Vitest source-dimension test |
| `src/capture/capture-io.ts` | feature-facing capture destination and write API | raw Tauri calls, PNG rendering, media parsing | `platform/tauri-capture` | `App.tsx` | Rust writer boundary + manual save acceptance |
| `src/platform/tauri-capture.ts` | Tauri save dialog and PNG write IPC | React state, PNG rendering, media parsing | Tauri core/dialog APIs | `capture/capture-io.ts` | Rust writer boundary + manual save acceptance |
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

Fixture: `tmp/phase0/synthetic-30fps.mp4`, generated with `scripts/generate-test-video.ps1` and FFmpeg 8.1.1 Essentials. The fixture is ignored and is not committed.

Current review-fix head result through `shiguredo_mp4` 2026.5.0:

```text
video_track_count: 1
codec: avc1
duration_seconds: 3.0
timescale: 15360
sample_count: 90
frame_duration_seconds: 0.03333333333333333
cfr: true
```

The fixture was regenerated on Windows with `scripts/generate-test-video.ps1` and parsed through the targeted Rust test using `MVSP_PHASE0_FIXTURE`. The parser is fed only requested ranges. A hard per-request safety limit of 64 MiB rejects an unbounded or oversized `RequiredInput` instead of allocating the remaining multi-GB file.

## Capture and drift evidence

- The Canvas unit test verifies that output dimensions use source video dimensions rather than displayed CSS size. Native WebView2 capture and saved-PNG dimension verification remain manual acceptance checks.
- Drift measurement freezes `offset[i] = G - L[i]` at measurement start, preserves that baseline across pause/resume, and resets the measurement when a global seek changes the relationship. A regression test proves non-zero starting offsets produce zero initial error and only later divergence is counted.
- Synchronized play now settles all required seeks before any `play()` call, blocks play while a global seek is pending, and pauses all participants if one play operation fails. Deterministic controller tests cover seek ordering, seek failure, and play rollback.
- Drift aggregation excludes Camera 1/master so the master cannot inject a zero-error sample into median/p95/max. A regression test covers master exclusion.
- No real three-camera run has been performed on the review-fix commit; threshold selection and sustained drift characterization remain pending.

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

## Verification status after current review changes

The following checks passed on Windows after the synchronized-playback, baseline, platform-boundary, and UI-boundary changes:

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
npm run tauri build -- --bundles nsis
```

Results: 10 TypeScript tests passed, 7 Rust tests passed, typecheck/lint/build/fmt/clippy passed, Tauri dev startup reached Vite ready + Rust debug application launch, and NSIS packaging produced `src-tauri/target/release/bundle/nsis/MultiVideoSyncPlayer_0.1.0_x64-setup.exe`. The default all-bundle command reached successful release compilation and MSI creation but hit a Windows file-lock error before its NSIS phase; the NSIS-only command then completed successfully after the stale development process was stopped.

Manual acceptance delegated to Codex/Windows remains:

- native multi-file selection and WebView2 decoding;
- AKASO V50 Elite representative MP4 timing inspection;
- saved PNG dimension verification;
- three-camera play/pause/seek drift characterization.

## Scope exclusions

This cut does not implement manual sync registration, named sync points, temporary unlock/restore, project persistence, final global timeline semantics, exact frame-step controls, continuous drift correction, or a polished capture panel.
