# Phase 0 Implementation Evidence

This document records the bounded first implementation cut described in `.codex/next-task.md`. It is intentionally separate from the product specification; it records evidence and remaining manual checks.

## Implemented paths

- `src/media/local-file.ts` uses the official Tauri dialog plugin, retains the canonical source path, authorizes only that exact path, and creates a WebView2 asset URL with `convertFileSrc`.
- `src-tauri/src/lib.rs` uses narrow `std::fs` commands for exact-file validation, capture writing, and `shiguredo_mp4` incremental range reads.
- `src/capture/capture-frame.ts` creates a Canvas at `video.videoWidth × video.videoHeight`, draws the current frame, and returns PNG bytes for the Rust writer.
- `src/sync/drift-measurement.ts` records monotonic sample time, global/master time, expected local time, actual local time, and signed error, then summarizes median/p95/max absolute error.
- `src/App.tsx` provides up to four direct-file panes, local playback controls, per-file errors, native PNG capture, and a three-video measurement panel.

## Reuse decisions

| Area | Decision |
| --- | --- |
| File picker | Reuse official Tauri dialog plugin |
| Media playback | Reuse WebView2 `HTMLVideoElement` |
| File URL | Reuse Tauri asset protocol and `convertFileSrc` |
| MP4 timing | Reuse `shiguredo_mp4` 2026.5.0 after synthetic CFR spike |
| PNG encode | Reuse browser Canvas and `toDataURL("image/png")` |
| File write | Reuse Rust `std::fs` / `std::io` behind a narrow command |
| State | React built-ins only |

## Synthetic MP4 timing spike

Fixture: `tmp/phase0/synthetic-30fps.mp4`, generated with `scripts/generate-test-video.ps1` and FFmpeg 8.1.1 Essentials. The fixture is ignored and is not committed.

Observed through `shiguredo_mp4` 2026.5.0:

```text
video_track_count: 1
codec: avc1
duration_seconds: 3.0
timescale: 15360
sample_count: 90
frame_duration_seconds: 0.03333333333333333
cfr: true
```

The implementation supplies only the ranges requested by the Sans-I/O demuxer and does not read the full video payload into memory. Target-camera/AKASO verification remains pending until a representative file is available.

## Capture and drift evidence

- The Canvas unit test verifies that the output canvas dimensions are source dimensions, independent of displayed CSS size. Native WebView2 capture and saved-PNG dimension verification remain manual acceptance checks.
- The measurement path is repeatable at a 250 ms interval and exposes the required sample fields and summary metrics. No real three-camera run has been performed in this environment; threshold selection and sustained drift characterization remain pending.

## Environment and checks

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

Checks run after the final source/configuration change:

| Command | Result |
| --- | --- |
| `npm test -- --run` | PASS — 2 files, 4 tests |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `cargo test --manifest-path src-tauri/Cargo.toml` | PASS — 3 tests |
| `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check` | PASS |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings` | PASS |
| `npm run tauri build` | PASS — MSI and NSIS x64 bundles |

`npm run tauri dev` reached Vite ready, compiled the Rust debug target, and launched `multivideosyncplayer.exe`; it was then stopped after startup smoke verification. Interactive local-file selection, WebView2 decoding, Canvas save, and three-camera measurements remain manual Windows acceptance work.

## Scope exclusions

This cut does not implement manual sync registration, named sync points, temporary unlock/restore, project persistence, final global timeline semantics, exact frame-step controls, continuous drift correction, or a polished capture panel.
