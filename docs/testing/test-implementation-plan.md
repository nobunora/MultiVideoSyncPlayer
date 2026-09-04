# Test Implementation Plan

## Purpose

Implement the evidence required by `docs/testing/test-spec.md` with the smallest maintainable test stack.

Do not build a custom test framework. Reuse standard tools for TypeScript/React, Rust, and Windows/Tauri verification.

---

## 1. Tooling selection

### TypeScript / React

Preferred baseline:

- Vitest for unit/integration tests;
- React Testing Library only where DOM/component interaction is required;
- TypeScript compiler for static type checks;
- ESLint for configured lint rules.

Avoid snapshot-heavy tests for synchronization behavior. Assert domain state and observable behavior directly.

### Rust / Tauri

Use:

- `cargo test` for Rust logic and filesystem helpers;
- `cargo fmt --check`;
- `cargo clippy` using the repository's warning policy.

### Tauri end-to-end

Do not introduce a heavyweight E2E framework before proving it can reliably drive the Windows Tauri/WebView2 app in the target environment.

First maximize coverage through:

- pure controller tests;
- component tests;
- thin Rust command tests;
- media-integration test harness;
- scripted/manual packaged-app acceptance.

If a maintained Tauri-compatible WebDriver/E2E route is stable in the environment, add it later for a small smoke suite rather than duplicating all unit coverage.

---

## 2. Testability architecture

Production design must expose side effects behind small interfaces.

### Media controller interface

Do not scatter direct `HTMLVideoElement` mutations through components.

Create a small adapter/interface suitable for production HTMLVideoElement and fake tests.

Conceptual operations:

```ts
interface MediaController {
  getCurrentTime(): number;
  getDuration(): number;
  seek(time: number): Promise<void>;
  play(): Promise<void>;
  pause(): void;
  isPaused(): boolean;
}
```

Add only operations actually required.

This enables deterministic sync tests without relying on real decoder timing.

### Clock abstraction

The drift controller should receive a timing source or use a small injectable wrapper around monotonic time where deterministic tests need it.

Do not invent a broad scheduler framework.

### Filesystem/project boundary

Project serializer should be pure and separately tested from file I/O.

Suggested split:

- DTO/schema parse/serialize: TypeScript pure tests;
- path and atomic write helpers: Rust tests or whichever layer owns writes;
- orchestration: integration tests with fake boundary.

---

## 3. Directory structure

Suggested test organization:

```text
src/
  sync/
    sync-model.ts
    sync-model.test.ts
    drift-policy.ts
    drift-policy.test.ts
    sync-controller.test.ts
  project/
    project-schema.test.ts
    path-resolution.test.ts
  capture/
    capture-frame.test.ts
  ui/
    SyncControls.test.tsx
    RightPane.test.tsx
src-tauri/
  src/
    ...
  tests/
    filesystem.rs
scripts/
  generate-test-videos.ps1
  verify-local-only.ps1
  verify-capture-dimensions.*
fixtures/
  README.md
```

Do not create directories/files until needed.

---

## 4. Phase A — pure synchronization tests first

Before UI or Tauri integration, implement tests for:

- offset sign convention;
- global/local conversion;
- alignment from three local timestamps;
- out-of-range mapping;
- sync state transitions;
- temporary unlock isolation;
- restore;
- re-sync save-as-new;
- replace;
- undo stack.

Use table-driven tests where cases share the same invariant.

### Numerical tolerance

Define a named test epsilon for pure floating-point comparisons. Do not use arbitrary different tolerances per test without reason.

---

## 5. Phase B — drift policy tests

Keep the threshold classifier pure.

Example conceptual API:

```ts
type DriftAction = 'none' | 'hard-correct';

classifyDrift(errorSeconds, policy): DriftAction
```

Tests must cover:

- just below threshold;
- exactly at threshold;
- just above threshold;
- positive/negative error symmetry where intended;
- invalid/NaN values;
- correction rate limiting if added.

### Controller integration

Use fake media controllers with deterministic current time.

Verify:

- no correction inside tolerance;
- target correction outside tolerance;
- not every poll causes a seek;
- pause disables correction loop;
- resume preflight corrects stale streams.

---

## 6. Phase C — project schema tests

From the first schema version:

Create canonical in-memory examples for:

- unsynchronized project;
- synchronized three-video project;
- multiple sync points;
- moved-relative-path project.

Test:

- serialization is valid JSON;
- required fields preserved;
- runtime-only data excluded;
- unknown extra fields policy is explicit;
- missing required fields fail validation;
- future schema version fails clearly;
- current schema round-trip is stable.

If a schema-validation dependency is chosen, tests must prove malformed local files are rejected before runtime state is mutated.

---

## 7. Phase D — path resolution tests

Use temporary directories.

Build cases:

1. relative path valid;
2. relative invalid, absolute valid;
3. both invalid;
4. user-repaired path valid;
5. same filename with mismatching size/duration metadata;
6. ambiguous candidates in Locate Folder.

Never use a developer-specific hard-coded drive path in tests.

Include non-ASCII and spaces in test directory/file names.

---

## 8. Phase E — atomic project write tests

At the filesystem-owning layer, test:

- initial save;
- overwrite existing project;
- temp write failure;
- replace/rename failure where injectable/simulatable;
- prior file content preserved on failed update;
- no stray temp file after successful write;
- useful error on read-only/unwritable destination where environment permits.

Tests must clean temporary resources.

---

## 9. Phase F — React component tests

Test only interaction logic not already covered by pure state tests.

### SyncControls

Cover:

- status text for all three sync states;
- Register enabled only when alignment prerequisites exist;
- Temporary Unlock available when LOCKED;
- Restore + Re-sync visible when TEMPORARILY_UNLOCKED;
- replace confirmation path;
- sync point selection and rename/delete wiring.

### RightPane

Verify playback/sync/capture sections render and call provided actions.

### VideoGrid

Verify 1–4 video layout classes/structure and active-video selection.

Avoid brittle pixel/DOM snapshots.

---

## 10. Phase G — media integration fixtures

### Fixture generator

Create `scripts/generate-test-videos.ps1` after implementation begins.

Requirements:

- detect `ffmpeg` in PATH and fail clearly if missing;
- generate tiny H.264 CFR MP4s;
- generate known dimensions and FPS;
- create a visually identifiable common sync event at known local timestamps;
- optional frame/time counter where available without fragile font dependencies;
- deterministic output directory ignored by Git unless tiny canonical files are deliberately committed later.

Example conceptual fixture set:

```text
cam-a.mp4  640x360 60 fps, event at 2.000 s
cam-b.mp4  640x360 60 fps, event at 5.250 s
cam-c.mp4  640x360 60 fps, event at 0.750 s
```

The generator command and ffmpeg version must be recorded in test evidence.

### Why generated fixtures

- avoids multi-megabyte/big real videos in Git;
- exact expected offsets are known;
- repeatable across development machines with ffmpeg;
- runtime app still has no FFmpeg dependency.

---

## 11. Phase H — real HTMLVideoElement/WebView2 harness

Create the smallest test/dev route/component required to verify real decoder behavior.

Do not leave a permanent debug screen unless useful as an intentional developer harness.

Measure:

- metadata load;
- actual `currentTime` after seek;
- `seeked` event timing;
- `requestVideoFrameCallback` metadata where available;
- frame-step settle behavior;
- three-video playback error over time.

Store measurement logs under ignored `artifacts/`.

Do not assert impossible millisecond precision blindly. Choose tolerances from observed media/browser behavior.

---

## 12. Phase I — capture verification

### Automated logic

Test filename collision policy and capture orchestration with fake encoders/writers.

### Real capture

Using known fixture:

1. load 1920×1080 or generated known-resolution video;
2. seek to stable frame;
3. capture native frame;
4. inspect PNG header/dimensions with a small existing parser or standard test utility;
5. assert exact dimensions.

Repeat for 3840×2160 if available.

### All frames

Capture three mapped videos at a known sync point. Verify three files, correct dimensions, and controller target times.

### Split view

Verify output exists and dimensions correspond to capture region. Manual visual inspection may supplement automated structural checks.

---

## 13. Phase J — local-only verification

Create `scripts/verify-local-only.ps1` only if it can provide reliable evidence without pretending to be stronger than Windows permits.

Potential checks:

- process PID lookup;
- `Get-NetTCPConnection` filtering by owning process;
- optional UDP endpoint inspection;
- source/config scan for external runtime URLs/plugins.

A scripted check must distinguish:

- MultiVideoSyncPlayer process connections;
- WebView2 child processes belonging to the app if identifiable;
- unrelated system WebView2/browser processes.

For stronger release evidence, supplement with TCPView/Wireshark/Windows Resource Monitor manual observation.

Test workflow:

1. launch release build;
2. observe baseline;
3. open videos;
4. play/seek/sync;
5. save/load project;
6. capture;
7. wait for any delayed updater/telemetry behavior;
8. close.

Expected: no intentional external endpoint connection.

---

## 14. Phase K — packaged application smoke test

Run against the actual Tauri production package, not only Vite/dev mode.

Minimum smoke:

- launch;
- multi-file open;
- register sync;
- play/pause;
- next/previous frame;
- temporary unlock/restore;
- project save;
- capture;
- close/reopen/project restore.

Record Windows version, WebView2 runtime version, app build SHA, and media fixture properties.

---

## 15. Phase L — real AKASO acceptance

Keep real camera media outside repository.

Record a short test set or use existing representative footage.

For each file record:

- resolution;
- codec/profile if available;
- FPS/CFR status;
- duration;
- file size.

Execute the exact flow from `TEST_SPEC` section 14.

Document:

- initial offsets;
- sync quality after 1, 5, and 10 minutes where possible;
- number/type of drift corrections;
- frame-step usability;
- any decode stalls;
- capture correctness;
- save/restore result.

---

## 16. CI strategy

Initial CI should stay deterministic and cheap.

### Required on normal PRs

After scaffolding, CI should run the project-equivalent of:

```text
frontend install with lockfile
frontend lint
frontend typecheck
frontend unit/component tests
cargo fmt --check
cargo clippy
cargo test
```

### Optional/separate Windows build gate

Add production Tauri build when runner cost/time is acceptable.

Do not require large video integration tests on every tiny docs-only change.

Use path/change filtering only when it cannot hide relevant cross-boundary failures.

### Media tests

Run media integration in a dedicated job/profile where ffmpeg/WebView2 environment can be controlled.

---

## 17. Test evidence format

Every implementation PR should list exact commands and result.

Example:

```text
pnpm lint                       PASS
pnpm typecheck                  PASS
pnpm test                       PASS (84 tests)
cargo fmt --check               PASS
cargo clippy --all-targets ...  PASS
cargo test                      PASS (12 tests)
pnpm tauri build                PASS
Manual AKASO 3-camera test      PASS with notes
Local-only network observation  PASS with method
```

Do not write `tests pass` without command-level evidence.

---

## 18. Failure triage

When a test fails, classify before editing:

- production defect;
- test defect;
- media/browser nondeterminism;
- environment/tooling failure;
- unsupported contract;
- specification conflict.

Do not weaken tolerances or skip tests solely to make CI green.

If browser timing makes a deterministic assertion inappropriate, replace it with a better observable contract and document the evidence.

---

## 19. CodebaseMemory after test implementation

Once tests and source exist, CodebaseMemory queries should verify links between:

- sync pure model and sync controller;
- controller and UI controls;
- project serializer and filesystem boundary;
- capture controller and writer;
- each production module and its focused tests.

Graph gaps are investigation signals only; source/test reads remain authoritative.
