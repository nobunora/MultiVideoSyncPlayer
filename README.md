# MultiVideoSyncPlayer

A local-first Windows app for synchronizing, comparing, and frame-stepping multiple local videos without uploading them.

## Product direction

MultiVideoSyncPlayer is intentionally small in scope. It is not a video editor and not a cloud service. The core job is to let a user:

- open multiple local video files directly, without copying them into application storage;
- manually align videos recorded by independent cameras;
- lock them to a shared timeline for play, pause, seek, and frame stepping;
- temporarily unlock individual videos for inspection and restore or redefine synchronization;
- save synchronization/project state and restore the same review later;
- capture native-resolution frames and the current multi-video view;
- run without external network access at runtime.

The initial platform target is Windows using Tauri 2, React/TypeScript, and WebView2.

## Reuse-first policy

This project must avoid unnecessary reinvention. Before implementing a subsystem, check whether a maintained library or an existing open-source implementation already solves the required problem. Reuse a suitable implementation or a small proven primitive when it reduces risk and maintenance cost. Do not add a large framework merely to avoid writing a small amount of straightforward code.

Known prior art and the current reuse decisions are documented in `docs/research/existing-solutions.md`.

## Inspiration

The project was inspired by the multi-video review workflow of Vodon Pro and Vodon Player by Samuel Richardson. It is an independent project and is not an official Vodon project.

See `THIRD_PARTY_NOTICES.md` for attribution and licensing notes.

## Project documents

- Product specification: `docs/specs/multi-video-sync-player-spec.md`
- Frozen pre-implementation decisions: `docs/architecture/preimplementation-decisions.md`
- Implementation procedure: `docs/implementation/implementation-plan.md`
- Validated initial repository review: `docs/implementation/initial-repository-review.md`
- Implementation readiness checklist: `docs/implementation/implementation-readiness.md`
- Test specification: `docs/testing/test-spec.md`
- Test implementation procedure: `docs/testing/test-implementation-plan.md`
- Acceptance matrix: `docs/testing/acceptance-matrix.md`
- Codex rules: `AGENTS.md` and `.codex/`
- Next Codex task: `.codex/next-task.md`
- CodebaseMemory rules: `docs/15_codebase_memory_and_quality.md`

## Implementation baseline

The current accepted v1 baseline is:

- Windows 10/11 x64;
- Node 24 LTS + npm;
- Tauri 2.11.x;
- React + TypeScript + Vite;
- WebView2 media playback;
- Direct Local File through Tauri asset protocol;
- narrow Rust `std::fs`/I/O commands instead of broad frontend filesystem access;
- `shiguredo_mp4` as the first MP4 timing metadata parser candidate;
- Canvas PNG capture, no FFmpeg runtime;
- no updater/cloud/analytics/network plugin;
- `.mvsp` versioned JSON projects;
- offline WebView2 installer for release packaging.

These choices are explained in `docs/architecture/preimplementation-decisions.md`.

## Status

**Implementation-ready.**

The specification is approved, repository review disposition is `validated`, architecture decisions are frozen, and the first bounded Codex implementation task is written in `.codex/next-task.md`.

No production source has been implemented yet. The next change should be the first source-bearing PR, not another architecture redesign.
