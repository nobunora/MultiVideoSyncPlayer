# Module Boundaries and File Responsibility Rules

Status: **Required for implementation**  
Applies to: all source-bearing PRs

## Purpose

Keep MultiVideoSyncPlayer small, understandable, and change-safe by assigning each module a clear reason to change and by enforcing simple dependency directions.

The goal is not maximum file count. The goal is to avoid both:

- **god modules/files** that mix UI, synchronization policy, media control, persistence, and platform I/O; and
- **artificial fragmentation** where trivial one-use helpers/types are split into many files without improving ownership, testing, or dependency clarity.

Before implementing a new non-trivial feature, identify which existing module owns it. Create a new module only when no existing responsibility fits cleanly.

---

## 1. Required implementation-time responsibility map

Before writing the first code for a source-bearing PR, the implementer must write a short module responsibility map in the implementation notes/PR description.

For each touched or newly created module, state:

```text
module/path
owns:
does not own:
depends on:
used by:
test boundary:
```

This is a design check, not permanent bureaucracy. Keep it concise.

If the proposed dependency graph contains a cycle, redesign the boundary before implementation unless there is a strong documented reason.

---

## 2. Frontend module responsibilities

The exact file names may evolve, but the responsibility boundaries below are normative.

### `src/app/`

**Owns**

- application composition;
- top-level product state/reducer wiring;
- orchestration between feature modules;
- translation of user intent into feature/controller calls;
- app-level error/result routing where no feature owns it more specifically.

**Does not own**

- raw Tauri filesystem/dialog calls;
- MP4 parsing;
- synchronization mathematics;
- HTMLVideoElement mechanics scattered through components;
- PNG encoding details;
- project schema validation details;
- reusable visual components.

`app` may depend on feature modules and platform adapters. Feature modules must not depend back on `app` merely to obtain global state.

### `src/media/`

**Owns**

- media source/runtime types;
- playback-facing `MediaController` abstraction;
- the HTMLVideoElement adapter;
- media readiness/error state that is intrinsic to one video;
- mapping a validated local media source into the runtime playback representation.

**Does not own**

- multi-video synchronization policy;
- project save/load;
- Tauri file picking or arbitrary filesystem I/O;
- right-pane UI;
- application-wide state transitions.

Keep DOM element references/runtime handles out of persisted types.

### `src/sync/`

**Owns**

- global/local time conversion;
- offset sign convention;
- sync point domain data and transitions;
- `NOT_SET` / `LOCKED` / `TEMPORARILY_UNLOCKED` semantics;
- synchronized seek/play/pause orchestration policy;
- drift classification/correction policy;
- sync undo snapshots/history.

**Does not own**

- React rendering;
- Tauri commands/filesystem operations;
- project JSON file I/O;
- media metadata parsing;
- PNG writing.

Prefer pure functions for time mapping and state transitions. Keep platform/DOM effects behind the small media-controller interface.

### `src/project/`

**Owns**

- versioned `.mvsp` DTO/schema;
- parse/validate/serialize logic;
- conversion between runtime-safe product data and persisted data;
- project path-resolution rules and file-identity matching logic;
- migration/rejection policy for schema versions.

**Does not own**

- raw save/open dialogs;
- Rust filesystem mechanics;
- media element/controller instances;
- sync playback behavior;
- UI rendering.

Project parsing must remain testable without Tauri or React.

### `src/capture/`

**Owns**

- selecting/settling the frame to capture;
- source-resolution Canvas composition;
- all-video capture orchestration;
- clean multi-video composite composition;
- PNG byte/blob production.

**Does not own**

- arbitrary filesystem access;
- project mutation;
- synchronization-state mutation except requesting a settled mapped position through an explicit controller boundary;
- right-pane rendering.

Writing bytes to disk belongs to the platform/Rust I/O boundary.

### `src/ui/`

**Owns**

- visual components;
- existing split video presentation;
- right-pane controls;
- formatting labels/status/timestamps;
- local ephemeral UI state.

**Does not own**

- synchronization math;
- direct Tauri `invoke`/dialog calls;
- direct project file I/O;
- MP4 parsing;
- drift policy;
- application business state duplicated in component-local state.

UI components should express intent via typed callbacks/actions rather than implement domain policy inline.

### `src/platform/` (create only when needed)

Use this boundary for thin frontend adapters to Tauri/native capabilities when direct calls would otherwise leak across multiple feature modules.

Possible responsibilities:

- dialog adapter;
- typed Tauri command client;
- asset URL conversion helper.

Do **not** create a generic service locator, dependency-injection framework, or catch-all `utils.ts`/`services.ts` bucket.

If only one very small Tauri call exists and keeping it local is clearer, a separate platform file is optional. Once the same platform API is used by multiple feature modules, centralize the typed boundary.

---

## 3. Rust/Tauri responsibilities

Rust is a narrow trusted I/O/platform boundary, not a second application layer.

### `src-tauri/src/lib.rs`

**Owns**

- Tauri application/plugin initialization;
- command registration;
- minimal composition/wiring.

**Does not own**

- large command bodies;
- MP4 parsing implementation details;
- project write algorithms;
- capture file write algorithms;
- unrelated utility collections.

Move non-trivial behavior into responsibility-specific modules.

### Media/local-file module

Suggested name: `media_file.rs` or equivalent.

**Owns**

- canonicalize/validate selected/restored video path;
- regular-file checks/stat identity;
- exact-path asset-scope authorization;
- bounded/range local reads required by MP4 metadata parser;
- MP4 metadata extraction/classification boundary.

Do not mix project persistence or capture-output naming into this module.

### Project I/O module

Suggested name: `project_io.rs`.

**Owns**

- read project bytes/text from selected path;
- atomic/recoverable project write mechanics;
- filesystem errors associated with project persistence.

The frontend/project domain owns schema meaning. Rust should not duplicate business validation unless required for safety at the native boundary.

### Capture I/O module

Suggested name: `capture_io.rs`.

**Owns**

- safe write of already-produced PNG bytes to an explicitly selected/approved destination;
- output directory/file mechanics if required by the capture contract.

It does not decode video or decide which frame to capture.

### Avoid `filesystem.rs` as a god module

A single filesystem module is acceptable during the very first tiny spike only if it contains a few closely related functions. Split it once project persistence, media authorization/metadata, and capture output become independent reasons to change.

---

## 4. Dependency direction

Keep dependencies mostly one-way:

```text
UI
 ↓
App/orchestration
 ↓
Feature/domain modules (sync, media, project, capture)
 ↓
Small interfaces / platform adapters
 ↓
Tauri commands / Rust I/O
```

Practical rules:

- `sync` must not import React UI or Tauri APIs.
- `project` must not import React UI or runtime HTMLVideoElement objects.
- `ui` must not contain raw filesystem/Tauri command logic.
- Rust I/O modules must not encode frontend presentation policy.
- cross-feature imports should use the smallest stable type/interface needed; avoid importing another feature's internal implementation file.
- do not create circular imports between `media`, `sync`, `project`, and `capture`.

When two modules appear to need each other's internals, extract the minimal shared contract/type only if it represents a real shared concept. Do not create a generic `common` directory as a dumping ground.

---

## 5. File-splitting decision rules

Split a file when one or more of these are true:

1. It has **multiple independent reasons to change** (for example UI rendering and filesystem I/O).
2. Pure/testable domain logic is mixed with React/Tauri/DOM side effects.
3. A platform adapter is mixed with product policy.
4. A public interface/adapter can be tested independently and has a clear owner.
5. A file becomes difficult to review because unrelated behavior changes together.
6. Different parts need materially different test strategies.
7. The same internal concern is reused from multiple owners and has a stable, narrow contract.

Do **not** split merely because:

- a file crossed an arbitrary line count;
- one helper could technically be exported;
- a design pattern suggests another layer;
- a future feature might someday need abstraction;
- one tiny interface has only one implementation and co-location is clearer.

Line count is only a smell, not a rule. A cohesive 250–400 line parser/controller can be better than ten 30-line files with unclear ownership. Conversely, a 100-line file mixing four responsibilities should be split.

---

## 6. Function/component responsibility rules

- A function should have one primary purpose and one abstraction level.
- React components should not perform hidden domain mutations during render.
- Event handlers may call orchestration actions but should not reproduce sync math or persistence algorithms.
- Keep side-effect sequencing explicit in controllers/use-cases rather than distributed across components/hooks.
- Avoid boolean argument collections that encode multiple modes ambiguously; prefer named options or explicit state enums when behavior materially differs.
- Do not create wrapper functions/classes that only forward calls without adding boundary value, validation, testability, or abstraction.

---

## 7. Naming and placement

Name files by responsibility, not implementation accident.

Prefer:

```text
sync-model.ts
sync-controller.ts
drift-policy.ts
media-controller.ts
media-metadata.ts
project-schema.ts
project-io.ts
capture-frame.ts
```

Avoid vague buckets such as:

```text
utils.ts
helpers.ts
common.ts
services.ts
manager.ts
misc.ts
```

unless the file truly has one narrow, obvious responsibility and a more specific name would be worse.

Test files should normally live near the code they verify for TypeScript/React. Rust integration tests may live under `src-tauri/tests/` when they test public/native boundaries.

---

## 8. Change-time boundary review

Before completing a source-bearing PR, verify:

- each changed file still has one primary responsibility;
- no new circular dependency exists;
- UI has not absorbed domain/platform logic;
- domain logic remains independently testable where practical;
- Rust has not grown into duplicate business logic;
- no broad `utils/services/filesystem` dumping ground was introduced;
- newly introduced abstraction has at least one present, concrete reason to exist;
- file/module movement is included only when necessary for the current change, not as unrelated cleanup.

Record any intentional exception in the PR report.

---

## 9. Refactoring trigger after CodebaseMemory exists

Once CodebaseMemory is available, use it as supporting evidence for boundary review:

- inspect callers/callees of modules that are growing across responsibilities;
- inspect dependency direction before moving functions;
- use high fan-in/fan-out as a review signal, not an automatic refactor trigger;
- verify graph evidence with source and tests before changing boundaries.

Never refactor solely to make the graph look cleaner.

---

## 10. First source-bearing PR

The first implementation PR (`.codex/next-task.md`) must establish only enough structure for the Phase 0 proof.

Do not pre-create every future directory/file from the full architecture.

Expected minimal ownership is approximately:

```text
src/
  app/ or App.tsx           app composition only
  media/                    selected source + playback adapter
  capture/                  Canvas proof only when implemented
  platform/                 only if Tauri calls need a shared TS boundary

src-tauri/src/
  lib.rs                    wiring only
  media_file.rs             file validation/scope + MP4 timing spike
  capture_io.rs             PNG write spike if needed
```

`sync/` and `project/` should **not** be created merely as placeholders in the first PR because final sync/project behavior is out of scope.

The implementer must explain any materially different structure in the PR responsibility map.