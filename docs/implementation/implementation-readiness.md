# Implementation Readiness Checklist

Status: **READY**  
Applies to first source-bearing implementation cut

This is the last handoff document before implementation starts. It converts the validated repository review into an executable sequence. Codex should not spend a separate session redesigning these choices.

## 1. Read order

Before changing source, read only:

1. `AGENTS.md`
2. `docs/specs/multi-video-sync-player-spec.md`
3. `docs/architecture/preimplementation-decisions.md`
4. `docs/implementation/initial-repository-review.md`
5. `.codex/implementation.md`
6. `.codex/next-task.md`
7. relevant Phase 0 sections of `docs/testing/test-spec.md` and `docs/testing/test-implementation-plan.md`

Use `docs/research/existing-solutions.md` only for the subsystem being implemented.

Do not reread every document indiscriminately.

## 2. First implementation branch/PR

Suggested branch:

```text
feat/foundation-direct-local-playback
```

Suggested PR title:

```text
Add Tauri foundation and validate direct local video playback
```

This PR is intentionally a foundation/spike PR, not the full application.

## 3. Environment preflight

Record exact output in the implementation report:

```powershell
node --version
npm --version
rustc --version
cargo --version
rustup show active-toolchain
git --version
```

On Windows also verify the normal Tauri prerequisites are present. If the MSVC build tools are missing, report the exact failure instead of working around it with another desktop framework.

Preferred toolchain at this decision point:

```text
Node 24.x LTS
npm
Rust stable
Tauri 2.11.x
```

Do not use Node 26 Current merely because it is newer; use LTS for the project baseline unless a concrete scaffold incompatibility requires otherwise.

## 4. Scaffold procedure

Use official `create-tauri-app` rather than hand-building Tauri boilerplate.

From repository root:

```powershell
npm create tauri-app@latest
```

Select:

```text
Project name: MultiVideoSyncPlayer
Identifier: io.github.nobunora.multivideosyncplayer
Frontend language: TypeScript / JavaScript
Package manager: npm
UI template: React
UI flavor: TypeScript
```

Because the repository is not empty, inspect the generator behavior before allowing it to overwrite existing repository files. If the generator cannot safely initialize in-place, generate into a temporary sibling directory and copy only the generated application scaffold into this repository while preserving:

- `README.md`;
- `LICENSE`;
- `AGENTS.md`;
- `.codex/`;
- `docs/`;
- `THIRD_PARTY_NOTICES.md`.

Do not replace existing repository documentation with generator defaults.

After scaffold, keep npm's generated lockfile.

## 5. Immediate scaffold cleanup

Before feature work:

- remove default demo/logo/counter content that is not useful;
- keep the app visually minimal;
- enable/confirm TypeScript strict mode;
- do not add a CSS/UI framework;
- do not add state-management library;
- do not add router unless a real second route exists;
- do not add updater/network plugin;
- do not add remote fonts/assets.

The first visible app may be plain.

## 6. Add only approved dependencies

### Tauri dialog

Use official CLI integration:

```powershell
npm run tauri add dialog
```

Use its native multi-file picker for `.mp4` selection.

### MP4 parser

Do **not** add the parser before the local playback path is working.

Then evaluate:

```text
shiguredo_mp4 2026.5.x
```

in `src-tauri/Cargo.toml` only for the metadata spike.

Keep it if and only if the Phase 0 proof shows it provides the needed sample/track timing cleanly.

If it fails, remove it before trying a fallback. Do not accumulate multiple MP4 parsers.

Fallback order for research:

1. `re_mp4`;
2. `mp4` / mp4-rust;
3. browser-side `mp4box.js`.

Do not write a custom ISO-BMFF parser in this PR.

## 7. Expected initial source shape

Do not create empty architecture for future phases. For the first cut, a minimal shape is sufficient:

```text
src/
  App.tsx
  main.tsx
  media/
    media-types.ts
    local-media.ts
    html-video-controller.ts
  spike/
    drift-measurement.ts        # only if needed for repeatable measurement
    frame-capture.ts            # may later move to capture/
src-tauri/
  src/
    lib.rs
    media_file.rs               # stat / exact-scope / metadata if needed
```

Names may change if the scaffold or actual implementation makes a simpler boundary obvious.

Do not pre-create `sync/`, `project/`, or full `ui/` trees before those features exist.

## 8. Direct Local File implementation sequence

Implement in this order:

1. native multi-select file dialog;
2. reject/skip non-`.mp4` candidates with per-file error;
3. get original absolute path;
4. obtain stat metadata through narrow Rust boundary if required;
5. register exact path with asset scope when necessary;
6. convert original path to WebView2 media source using Tauri's local asset URL mechanism;
7. render `<video>`;
8. wait for loaded metadata;
9. record `duration`, `videoWidth`, `videoHeight`;
10. verify source file was not modified/copied.

Do not read the entire video into JavaScript memory and do not create a Blob URL from all video bytes.

## 9. Asset protocol configuration

Enable the asset protocol but avoid broad static filesystem scope.

The intended security design is:

```text
static scope: empty/minimal
runtime scope: exact user-selected file paths only
```

For file-open flow, rely on the official dialog/Tauri scope behavior where valid.

For later project restore, the thin Rust boundary must canonicalize and allow exact known project media paths.

Do not solve restore now by granting the whole drive.

## 10. Local-only CSP baseline

The first implementation should install a restrictive CSP early so later code cannot accidentally depend on remote content.

Intent:

```text
default-src 'self'
connect-src ipc: http://ipc.localhost
media-src 'self' asset: http://asset.localhost blob:
img-src 'self' asset: http://asset.localhost blob: data:
script-src 'self'
style-src 'self' 'unsafe-inline'
```

Use the syntax required by current Tauri config.

The PR must not contain generic remote `https:`/`http:` origins.

If Vite/Tauri generated behavior requires an adjustment, document the exact reason and keep it local/internal.

## 11. MP4 timing spike implementation

Keep parser work Rust-side.

Desired result DTO from Rust to TypeScript:

```ts
interface MediaTimingInfo {
  videoTrackFound: boolean;
  codec?: string;
  durationSeconds?: number;
  width?: number;
  height?: number;
  frameRate?: number;
  frameRateStatus: 'verified-cfr' | 'unknown' | 'unsupported-vfr';
  sampleCountInspected?: number;
}
```

Exact fields may be reduced if redundant with WebView metadata.

### CFR decision

Do not derive exact frame step only from:

```text
totalFrames / duration
```

unless sample timing proves this is valid for the file.

Inspect sample durations/timestamps. A file is `verified-cfr` only if the inspected/full video sample timing meets the chosen CFR rule with a documented tolerance appropriate to integer MP4 timescales.

The parser should read only required ranges/samples. Do not `std::fs::read()` multi-GB target videos in production code.

## 12. Frame capture spike

Once one video is paused and settled:

1. create Canvas with `video.videoWidth` / `video.videoHeight`;
2. `drawImage(video, ...)`;
3. encode PNG;
4. pass bytes to a narrow Rust write operation or save path selected by native dialog;
5. parse/check output dimensions;
6. compare against source dimensions.

Do not add FFmpeg or DOM screenshot dependency.

No final Capture panel is required in this PR.

## 13. Drift measurement spike

The measurement needs evidence, not a full correction engine.

For three simultaneously played CFR videos, record at a fixed modest interval:

```text
monotonic sample time
global/master media time
video id
expected local time
actual local time
error seconds
```

Measurement may be developer-only in this first cut.

Test:

- initial synchronized start;
- steady playback;
- pause/resume;
- global/manual seek then resume.

Do not implement continuous hard correction yet.

Produce a concise summary:

```text
sample interval
run duration
median |error|
p95 |error|
max |error|
post-pause max
post-seek max
```

The next synchronization PR uses this evidence to set `DriftPolicy` thresholds.

## 14. Test setup sequence

Establish tests alongside the first code, not afterward.

### Frontend

Use Vitest. Add React Testing Library only if a component interaction test requires it.

At minimum test any pure path/state/media helper introduced in the first cut.

### Rust

At minimum test:

- file stat/validation helper;
- rejected missing/non-regular path;
- metadata parser helper with a small fixture if parser is retained;
- PNG/file writer helper if introduced.

Do not commit huge video fixtures.

## 15. Fixture policy

Repository fixtures must be small and redistributable.

For timing/media integration, prefer a script that generates synthetic MP4 fixtures using a developer-installed FFmpeg **for tests only**. FFmpeg is not a runtime dependency.

Generated fixture cases should eventually include:

- 30 fps CFR;
- 60 fps CFR;
- 59.94 fps CFR where practical;
- different start/visible marker offsets;
- unsupported/VFR case when feasible.

Do not commit user AKASO recordings.

## 16. Dependency evidence table

The implementation PR must include a table like:

| Dependency | Version | License | Purpose | Reuse alternative | Runtime network | Decision |
| --- | --- | --- | --- | --- | --- | --- |
| Tauri | resolved | MIT/Apache-2.0 | desktop shell | none reasonable | no | keep |
| dialog plugin | resolved | project license | native picker | custom Win32 | no | keep |
| shiguredo_mp4 | resolved | Apache-2.0 | MP4 timing | custom parser / other parser | no | keep/remove based on spike |

Do not omit transitive-license/notice review from the final release phase, but first PR may focus on direct dependencies.

## 17. Required first-PR checks

Run what the environment supports and record exact output/exit status.

Expected checks after scaffold:

```powershell
npm test -- --run
npm run typecheck
npm run lint
cargo test --manifest-path src-tauri/Cargo.toml
cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
npm run tauri build
```

If the generated scripts differ, normalize them so equivalent commands are easy to discover in `package.json`.

Do not weaken lint/clippy rules simply to get green output.

## 18. No-wheel-reinvention gate

Before writing custom code larger than a small adapter/helper, ask:

1. Is this an OS/Tauri/browser primitive already?
2. Is there a small maintained dependency that solves exactly this?
3. Is that dependency license-compatible and offline?
4. Is the dependency smaller/safer than our local code?
5. Are we about to reproduce functionality already documented in the prior-art research?

Record the decision when the answer is non-obvious.

This gate particularly applies to:

- MP4 parsing;
- file dialogs;
- filesystem path handling;
- PNG encoding;
- synchronization math;
- time scheduling;
- project atomic writes.

## 19. Stop conditions

Stop the first implementation cut and report `spec-change-required` if:

- representative MP4 cannot be played directly from local path through selected Tauri/WebView2 architecture;
- source video must be copied into app storage to work;
- target H.264 MP4 cannot be inspected for timing by any reasonable small parser without a materially different architecture;
- Canvas cannot capture the decoded source frame at native dimensions;
- local-only requires enabling arbitrary external network origins;
- an incompatible copyleft dependency becomes necessary.

Do not silently switch to Electron, server-side decoding, OPFS import, FFmpeg bundle, or cloud processing.

## 20. Completion condition for first implementation cut

The first implementation PR is ready for review when:

- Tauri app builds/runs;
- direct local MP4 playback is proven;
- no source-file copy is created;
- metadata spike has a documented result;
- native frame capture spike has a documented result;
- drift measurement path exists and has initial evidence;
- local-only CSP is present;
- only approved dependencies are present;
- tests/checks are recorded;
- implementation report states remaining AKASO/manual evidence honestly;
- no later product features were pulled into the PR.

At that point, the next PR may implement the pure sync model and manual alignment workflow.
