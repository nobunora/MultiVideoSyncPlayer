# Phase 0 Implementation Evidence

This document records the bounded first implementation cut described in `.codex/next-task.md`. It is intentionally separate from the product specification; it records evidence and remaining checks.

## Implemented paths

- `src/media/local-file.ts` owns native MP4 selection plus the narrow prepare/timing IPC bridge and creates the WebView2 asset URL with `convertFileSrc`.
- `src/media/media-controller.ts` is the imperative playback boundary around `HTMLVideoElement`; React orchestration does not directly issue seek/play/pause operations.
- `src/capture/capture-frame.ts` creates a Canvas at `video.videoWidth × video.videoHeight`, draws the current frame, and returns PNG bytes.
- `src/capture/capture-io.ts` owns capture path selection and the narrow PNG write IPC bridge.
- `src-tauri/src/media_file.rs` owns exact-file validation/authorization and `shiguredo_mp4` timing inspection.
- `src-tauri/src/capture_io.rs` owns PNG file creation/writing.
- `src-tauri/src/lib.rs` contains Tauri module wiring and command registration only.
- `src/sync/drift-measurement.ts` records and summarizes drift; aggregate Phase 0 statistics exclude the master stream.
- `src/App.tsx` provides Phase 0 UI/orchestration for up to four direct-file panes, playback controls, native PNG capture, and three-video drift measurement.

## Module responsibility map

| Module | Owns | Does not own | Depends on | Used by | Test boundary |
| --- | --- | --- | --- | --- | --- |
| `src/App.tsx` | Phase 0 UI composition and orchestration | low-level seek/play/pause mechanics, filesystem writes, MP4 parsing | media/capture/sync adapters | application entry | behavior covered through pure adapter/sync tests plus manual UI acceptance |
| `src/media/local-file.ts` | MP4 picker, exact-file preparation bridge, timing bridge, asset URL creation | playback policy, capture output | Tauri core/dialog | `App.tsx` | Rust media-file tests + manual picker/playback acceptance |
| `src/media/media-controller.ts` | imperative HTML video playback adapter | sync policy, UI, filesystem | `HTMLVideoElement` | `App.tsx` | adapter contract; browser/WebView behavior remains manual Phase 0 evidence |
| `src/capture/capture-frame.ts` | source-resolution Canvas PNG encoding | path selection, file writing | Canvas/video DOM APIs | `App.tsx` | Vitest source-dimension test |
| `src/capture/capture-io.ts` | capture destination dialog and write IPC | PNG rendering, media parsing | Tauri core/dialog | `App.tsx` | Rust writer boundary + manual save acceptance |
| `src/sync/drift-measurement.ts` | drift sample creation, slave-only aggregation, percentile summary | playback correction, UI | none | `App.tsx` | Vitest offset/statistics/master-exclusion tests |
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

Previously observed through `shiguredo_mp4` 2026.5.0 before the review-fix commit:

```text
video_track_count: 1
codec: avc1
duration_seconds: 3.0
timescale: 15360
sample_count: 90
frame_duration_seconds: 0.03333333333333333
cfr: true
```

The parser is fed only requested ranges. A hard per-request safety limit of 64 MiB now rejects an unbounded or oversized `RequiredInput` instead of allocating the remaining multi-GB file. The synthetic fixture and target-camera parser checks must be rerun on the review-fix commit before the PR is marked ready.

## Capture and drift evidence

- The Canvas unit test verifies that output dimensions use source video dimensions rather than displayed CSS size. Native WebView2 capture and saved-PNG dimension verification remain manual acceptance checks.
- Drift aggregation now excludes Camera 1/master so the master cannot inject a zero-error sample into median/p95/max. A regression test covers master exclusion.
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

## Verification status after review fixes

The earlier PR head passed the automated commands listed below, but those results are not claimed for the review-fix commit. Codex must rerun them on Windows after pulling the new head:

```powershell
npm test -- --run
npm run typecheck
npm run lint
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
npm run tauri dev
npm run tauri build
```

Manual acceptance delegated to Codex/Windows remains:

- native multi-file selection and WebView2 decoding;
- AKASO V50 Elite representative MP4 timing inspection;
- saved PNG dimension verification;
- three-camera play/pause/seek drift characterization.

## Scope exclusions

This cut does not implement manual sync registration, named sync points, temporary unlock/restore, project persistence, final global timeline semantics, exact frame-step controls, continuous drift correction, or a polished capture panel.
