# Pre-implementation Architecture Decisions

Status: **Accepted**  
Decision date: 2026-09-04  
Applies to: v1 unless superseded by an explicit specification change

This document freezes implementation-detail choices that were intentionally left open in the product specification. The goal is to leave Codex with implementation work, not architecture discovery.

## 1. Baseline toolchain

Use the boring, current stable path.

- OS target: Windows 10/11 x64 first.
- Node.js: 24.x LTS. At decision time the current LTS line is Node 24.
- Package manager: npm. Do not introduce pnpm/yarn/bun for v1.
- Rust: stable via rustup. At decision time stable is 1.98.1.
- Desktop shell: Tauri 2.11.x line.
- Frontend: React + TypeScript + Vite, generated from the official Tauri project template.
- TypeScript: strict mode.
- Browser runtime: system WebView2.

Current Tauri versions observed when this decision was written:

- `tauri` crate: 2.11.5;
- `@tauri-apps/cli`: 2.11.4;
- `@tauri-apps/api`: 2.11.1.

The scaffold may resolve compatible patch versions in the same stable line. The generated lockfiles become the build truth; do not hand-edit dependencies merely to reproduce these patch numbers.

References:

- https://v2.tauri.app/start/create-project/
- https://v2.tauri.app/release/
- https://nodejs.org/en/about/previous-releases
- https://forge.rust-lang.org/

## 2. Application shape

v1 is a **single-window local desktop application**.

Production must not require a localhost server. Vite's development server is development-only and does not count as a production architecture dependency.

No browser/PWA deployment target is required in v1.

## 3. File access: Direct Local File

Direct Local File is mandatory and is the default.

### Selected mechanism

1. Use the official Tauri dialog plugin for native multi-file selection.
2. Keep the original source file in place; never import/copy the whole video into app storage.
3. Expose the chosen video to WebView2 through Tauri's asset protocol and `convertFileSrc`.
4. Keep asset-protocol scope narrow. Do **not** configure a broad static `$HOME/**/*`, `**/*`, or equivalent allow rule.
5. Paths explicitly chosen during the current process lifetime may use the scope granted by the native dialog flow.
6. For project restore, use one thin Rust command to canonicalize, validate, and allow each exact saved video path through the asset-protocol file scope before the frontend creates the media URL.

The project-restore command must reject missing paths and non-regular files. It must allow the exact file only, not the containing drive or broad directory tree.

Do not add `tauri-plugin-persisted-scope` in v1 unless the exact-file runtime re-authorization approach proves insufficient. Persist the path in the project file, not a broad filesystem capability.

References:

- https://v2.tauri.app/plugin/dialog/
- https://v2.tauri.app/security/asset-protocol/
- https://v2.tauri.app/reference/javascript/api/namespacecore/

## 4. Filesystem ownership

Do not give the frontend broad general-purpose filesystem access.

Use Rust `std::fs` / `std::io` behind narrow Tauri commands for application-owned I/O such as:

- project read/write;
- file stat / identity metadata;
- capture PNG write;
- exact-path asset-scope registration on restore.

Use the dialog plugin only for user path selection.

Do not add the Tauri filesystem plugin unless a concrete requirement cannot be met cleanly by the thin Rust boundary.

This keeps the capability surface smaller and makes project/capture I/O directly unit-testable in Rust.

## 5. MP4 metadata and CFR verification

Do **not** write an MP4 parser.

### Preferred first candidate

Use `shiguredo_mp4` in Rust as the first Phase 0 candidate.

Decision basis as of 2026-09-04:

- current release: 2026.5.0;
- license: Apache-2.0;
- Windows supported;
- zero runtime crate dependencies reported by the project;
- H.264/AVC MP4 supported;
- incremental/Sans-I/O demux API can request only required file ranges rather than loading a multi-gigabyte movie into memory;
- track and sample timing information is exposed by the demux API.

Reference:

- https://docs.rs/crate/shiguredo_mp4/latest
- https://docs.rs/shiguredo_mp4/latest/shiguredo_mp4/demux/

### Why not browser-side `mp4box.js` as the default

`mp4box.js` is maintained and BSD-3-Clause, but the product already has a Rust file-I/O boundary. Parsing metadata in Rust avoids moving large file chunks through WebView IPC or inventing a second frontend file-reading route. `mp4box.js` remains a fallback research candidate, not the default dependency.

### Required Phase 0 proof

Before the parser becomes a permanent dependency, prove on at least one target-like MP4 that it can provide enough information to classify:

- video track;
- codec/container support;
- duration/timescale;
- sample timing needed to determine a usable frame interval;
- CFR vs unsupported/unknown timing.

If `shiguredo_mp4` cannot do this cleanly for the target files, compare `re_mp4`, `mp4`/mp4-rust, and `mp4box.js` before writing custom parsing code.

## 6. Media support contract

v1 first-class contract:

- local `.mp4` file;
- H.264/AVC video that WebView2 can decode;
- constant frame rate when exact frame stepping is requested.

Files that WebView2 cannot decode must fail per file with a clear message; one bad file must not prevent other videos from loading.

VFR may still be viewable if WebView2 decodes it, but exact frame-step/sync promises are disabled unless timing is verified. Do not pretend a nominal average FPS is exact CFR.

H.265/HEVC, MKV, MOV, transcoding, and bundled codec packs are non-goals for v1 unless the specification is revised.

## 7. Synchronization time model

Use one explicit global timeline and per-video offsets.

Canonical sign convention:

```text
localTime(video) = globalTime - offset(video)
globalTime       = localTime(video) + offset(video)
```

For a manual alignment point with local times `L[i]`, choose one reference/global value `G` and store:

```text
offset[i] = G - L[i]
```

Then every registered video maps back to the same `G`.

This convention must be frozen in unit tests before UI/controller implementation.

No video element, DOM reference, Tauri handle, or transient seek state belongs in persisted project data.

## 8. Playback coordination

Use a small media adapter around `HTMLVideoElement`. React components must not directly scatter seek/play/pause policy.

Minimum conceptual boundary:

```ts
interface MediaController {
  currentTime(): number;
  duration(): number;
  seek(time: number): Promise<void>;
  play(): Promise<void>;
  pause(): void;
  paused(): boolean;
}
```

Only add methods when required.

For synchronized play:

1. establish global target time;
2. map to each local target;
3. correct stale positions that exceed the pre-play tolerance;
4. wait for required seeks to settle;
5. call play;
6. start drift sampling.

Do not repeatedly set `currentTime` every render or animation frame.

## 9. Drift policy

Adopt the useful principle observed in `multi_video_sync_ffplay`: compare slave clocks to one shared/master timebase and correct only meaningful error.

Implementation remains independent; do not copy ffplay-derived source.

Initial v1 action set:

```text
small error    -> no action
large error    -> hard seek to expected local time
```

Do not implement playback-rate trimming until measured evidence shows it is needed.

Threshold values are not frozen here. Phase 0 must measure them. The thresholds live in one named `DriftPolicy` object/module and must not be scattered magic numbers.

## 10. State management

Use React built-ins first:

- `useReducer` for product/domain state;
- Context only where prop drilling becomes materially awkward;
- local component state for ephemeral UI state.

Do not add Redux, Zustand, MobX, XState, or another state framework in v1 unless the implementation demonstrates a concrete failure of the built-in approach.

Sync states remain exactly:

```text
NOT_SET
LOCKED
TEMPORARILY_UNLOCKED
```

## 11. Project file

Use a readable versioned JSON file with extension:

```text
*.mvsp
```

`mvsp` means Multi Video Sync Player project.

First schema version:

```json
{
  "schemaVersion": 1
}
```

The full schema must include the product data specified elsewhere, but `schemaVersion` is mandatory from the first saved project.

Persistence rules:

- save absolute path and relative path where applicable;
- save identity hints such as size, duration, resolution, and timing metadata;
- never embed/copy video bytes;
- never persist runtime DOM/controller objects;
- reject future unknown schema versions with a clear message;
- do not mutate live application state until the whole load payload validates.

### Schema validation

Do not add Zod/Ajv only for the initial small schema. Implement a small explicit parser/validator with named field checks and tests. Reconsider a schema library if the schema becomes sufficiently complex that the local validator becomes harder to maintain than the dependency.

## 12. Project write semantics

Project writes are Rust-owned and atomic/recoverable.

Baseline flow:

1. serialize validated DTO in frontend or Rust according to the final boundary;
2. write to a temporary file in the destination directory;
3. flush/close;
4. replace destination;
5. only then clear dirty state.

On failure, the previous valid project file must remain intact whenever the OS permits that guarantee.

No autosave database is required. Autosave, if implemented, uses another JSON file with explicit recovery semantics.

## 13. Capture

### Current video frame

Use Canvas at source dimensions:

```text
video.videoWidth × video.videoHeight
```

Draw the settled current video frame and encode PNG. Pass bytes to the narrow Rust write command.

No FFmpeg runtime dependency.

### All video frames

Pause and settle all mapped targets first, then capture each source-resolution frame independently.

### Current multi-video view

Do not add `html2canvas` or a broad screenshot framework initially.

Compose a clean PNG on one Canvas from:

- the currently displayed video frames;
- the current split layout geometry;
- camera labels;
- global timestamp.

This reproduces the useful review view without capturing arbitrary DOM chrome. If this proves unable to reproduce an explicit v1 requirement, only then evaluate a small maintained DOM-capture library.

## 14. Local-only/network boundary

There is no online mode in v1.

Forbidden runtime dependencies/features:

- updater;
- HTTP client plugin;
- telemetry/analytics;
- crash upload;
- remote fonts;
- remote CSS/JS/assets;
- cloud SDK;
- runtime URL fetches unrelated to Tauri internal IPC/asset protocols.

CSP must permit only the local application, Tauri internal IPC, and local asset/media/blob/data sources needed by the implementation. It must not whitelist arbitrary `http:` or `https:` remote origins.

A starting configuration should be equivalent in intent to:

```text
default-src 'self';
connect-src ipc: http://ipc.localhost;
media-src 'self' asset: http://asset.localhost blob:;
img-src 'self' asset: http://asset.localhost blob: data:;
script-src 'self';
style-src 'self' 'unsafe-inline';
```

Adjust syntax only as required by the generated Tauri/Vite bundle. Any relaxation must be explained in the implementation report.

Reference:

- https://v2.tauri.app/security/csp/

## 15. Windows installer and WebView2

Release packaging must not require Internet access merely to obtain WebView2.

Use Tauri Windows:

```json
{
  "bundle": {
    "windows": {
      "webviewInstallMode": {
        "type": "offlineInstaller"
      }
    }
  }
}
```

This increases installer size by roughly 127 MB but supports offline installation. Do not use the default `downloadBootstrapper` for the local-only release artifact.

The application may use the system Evergreen WebView2 runtime after installation; Windows is responsible for its normal security servicing.

Reference:

- https://v2.tauri.app/distribute/windows-installer/

## 16. Test stack

Use the smallest standard stack:

Frontend:

- Vitest;
- React Testing Library only for component interaction that cannot be covered as pure logic;
- TypeScript compiler;
- ESLint.

Rust:

- `cargo test`;
- `cargo fmt --check`;
- `cargo clippy`.

Do not introduce Playwright/Cypress/WebdriverIO at scaffold time. Add a Tauri-compatible E2E tool only after the unit/integration surface is exhausted and a stable Windows automation path is demonstrated.

## 17. CodebaseMemory

There is no meaningful source graph before the initial scaffold/source exists.

Therefore:

- absence of `.codebase-memory/graph.db.zst` before the first source-bearing PR is expected and is not a blocker;
- once meaningful source exists, initialize CodebaseMemory and query the actual boundaries before the next non-trivial change;
- after a source-bearing implementation is finalized, refresh the tracked graph once and commit it last, following `AGENTS.md`.

## 18. Reuse decision summary

| Area | Selected approach | Explicitly avoided |
| --- | --- | --- |
| Desktop shell | Tauri 2 + WebView2 | new native UI framework, Electron restart |
| UI | React/TS/Vite | UI component framework |
| File picker | official Tauri dialog plugin | custom Win32 picker |
| General file I/O | thin Rust std::fs commands | broad frontend FS permission |
| Video playback | HTMLVideoElement/WebView2 | custom decoder/player |
| Local media URL | Tauri asset protocol | copying video into OPFS/app storage |
| MP4 metadata | `shiguredo_mp4` first candidate | custom MP4 parser, FFprobe runtime |
| Sync model | global time + offsets | per-video ad-hoc timeline logic |
| Drift | measured master/error correction | constant seek loop |
| State | React reducer/built-ins | Redux/Zustand/etc. |
| Project validation | small explicit validator | schema framework in v1 |
| Native frame capture | Canvas + PNG | FFmpeg runtime |
| Composite capture | Canvas composition | html2canvas initially |
| Network | none except internal Tauri protocols | updater/cloud/analytics/HTTP plugin |
| Installer WebView2 | offline installer | download bootstrapper |

## 19. Remaining implementation-time spikes

Only these items remain intentionally empirical:

1. verify direct playback of a representative target MP4 in WebView2;
2. verify `shiguredo_mp4` timing extraction/classification on representative target MP4;
3. verify source-resolution Canvas capture on target media;
4. measure three-video drift and choose policy thresholds.

These are Phase 0 implementation evidence, not open architecture questions. Failure of one of these assumptions triggers `spec-change-required`; success does not require another design review.
