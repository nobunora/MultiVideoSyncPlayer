# MultiVideoSyncPlayer Specification

## 1. Goal

Build a small, local-first Windows desktop application that lets a user load multiple independently recorded local videos, manually synchronize them to the same real-world event, and then compare them with shared play/pause, seek, and frame-step controls.

The application must also let the user temporarily break synchronization for individual inspection, safely restore or redefine synchronization, save/reload project state, and export useful still images.

The product must minimize custom development by reusing proven platform primitives and suitable open-source components where doing so reduces risk and maintenance cost.

---

## 2. Product identity

Name: **Multi Video Sync Player**

Repository: `nobunora/MultiVideoSyncPlayer`

Description:

> A local-first app for synchronizing, comparing, and frame-stepping multiple videos without uploading them.

The product is an independent project inspired by Vodon Pro / Vodon Player. It is not an official Vodon product.

---

## 3. Scope

### Included in v1

- Windows desktop application.
- Tauri 2 shell with React/TypeScript UI and WebView2 media playback.
- Direct Local File as the default media path.
- Multiple local MP4/H.264 constant-frame-rate videos.
- Manual per-video alignment.
- Named synchronization points.
- Shared/global timeline.
- Synchronized play/pause.
- Synchronized seek.
- Synchronized previous/next frame operation for supported CFR media.
- Temporary synchronization unlock for per-video inspection.
- Restore previous synchronization.
- Re-sync from current positions.
- Update or save a synchronization point as a new point.
- Small synchronization undo history.
- Project save and project restore.
- Relative and absolute media path handling.
- Native-resolution current-frame capture.
- Native-resolution capture of all synchronized videos.
- Screenshot/capture of the current multi-video split view.
- No external runtime network requirement.

### Initial target workload

The primary user scenario is approximately three independent cameras recording the same equipment, experiment, sport action, or mechanical event from different directions.

The design must not hard-code exactly three videos, but implementation should prioritize a reliable 2–4 video workflow before optimizing for large video counts.

---

## 4. Non-goals for v1

The following are explicitly outside v1 unless a later specification changes scope:

- cloud upload or cloud project synchronization;
- user accounts;
- local web server deployment;
- browser/PWA distribution as the primary product;
- server-side video processing;
- video editing/timeline compositing;
- transcoding or video export;
- automatic audio synchronization;
- automatic visual/ML synchronization;
- pose estimation;
- measurement/triangulation;
- hardware trigger synchronization;
- annotations/drawing system;
- bookmarks unrelated to synchronization points;
- arbitrary codec support;
- guaranteed frame-accurate semantics for VFR media;
- automatic linear clock-rate calibration from two sync markers;
- large UI framework or design-system work not required by the core workflow;
- cross-platform support beyond Windows in the initial release.

---

## 5. Reuse-first invariant

Before implementing a non-trivial subsystem, the implementation must review `docs/research/existing-solutions.md` and determine whether to reuse:

1. existing project code;
2. a platform/runtime primitive;
3. a maintained third-party dependency;
4. a small local implementation.

### Required policy

- Do not reimplement an MP4 parser, file picker, path library, JSON serializer, split-layout engine, or other general primitive when the platform/runtime already provides a suitable solution.
- Do not add a large dependency when a small amount of straightforward code is safer and easier to maintain.
- New dependencies require a documented reason, maintenance status, license, and runtime/bundle impact.
- Third-party source may not be copied until its license and source provenance are verified.
- Reuse of Vodon Pro source is not the default because Vodon Pro is GPL-3.0.
- Vodon Player MIT code may be reused selectively with notice preservation when it clearly saves work.
- `NuerSir/multi_video_sync_ffplay` is synchronization-algorithm prior art; copy no substantial ffplay-derived code until provenance is audited.
- `ElizabethViera/multi-video-sync` is conceptual prior art only unless licensing is established.

---

## 6. Runtime architecture

### Required architecture

```text
Windows
  |
  +-- MultiVideoSyncPlayer.exe
        |
        +-- Tauri 2
        |    +-- native file dialogs
        |    +-- controlled local filesystem access
        |    +-- project/capture writes
        |
        +-- WebView2
             +-- React / TypeScript UI
             +-- HTMLVideoElement playback
             +-- synchronization controller
             +-- Canvas frame/view capture where validated
```

### Architectural constraints

- No localhost server is required for the installed application.
- No backend service is required.
- The application should load its UI assets from its packaged local resources.
- Remote fonts, remote scripts, CDN assets, and remote media are prohibited in v1.
- Runtime HTTP/WebSocket capability must not be added unless required for internal Tauri IPC and explicitly restricted to internal application communication.

---

## 7. Local-only behavior

### v1 policy

Local-only is not a user-selectable mode in v1; it is the product's default and only supported runtime mode.

This avoids implementing a meaningless switch whose OFF state has no required use case.

### Invariant

MultiVideoSyncPlayer must not intentionally initiate external network connections during normal runtime operation.

This includes:

- video upload;
- project upload;
- telemetry;
- analytics;
- crash upload;
- automatic update checks;
- cloud sync;
- remote configuration;
- remote assets;
- remote fonts;
- external HTTP APIs;
- WebSocket services.

If online features are proposed later, they require a separate specification and must not weaken a fully local default path.

### User-visible indication

A small persistent indicator such as `LOCAL` / `LOCAL ONLY` should be visible in the existing header/status area without occupying significant screen space.

The indicator is informational, not a toggle.

---

## 8. Media input

### Direct Local File

The default and normal workflow is:

1. user selects one or more local video files using the native Windows file picker;
2. application retains the path/authorized access needed to read those files;
3. video is played directly from its existing location;
4. the application does not copy the entire video into application storage.

### Rationale

Large experiment videos can be many gigabytes. Copying every selected video would double storage usage and create unnecessary import delays.

### File handling requirements

- Multiple selection is supported.
- Drag/drop may be added if it is cheap using existing platform primitives, but it is not required before native multi-file selection works.
- A project can store both absolute and relative paths.
- The application must not modify original video files.

---

## 9. Supported media contract

Primary v1 contract:

- MP4 container;
- H.264 video supported by Windows/WebView2;
- constant frame rate (CFR);
- normal local files from consumer/action cameras such as AKASO V50 Elite.

### Metadata

The application needs at minimum:

- duration;
- native width/height;
- frame-rate information sufficient for CFR frame-step calculations;
- file size/path/name.

Do not write a custom MP4 parser from scratch solely for metadata. Evaluate a maintained small parser/library or another platform primitive first.

### Unsupported/uncertain media

If exact frame-rate semantics cannot be established:

- allow normal playback where WebView2 can decode it;
- mark frame-accurate stepping as unavailable or best-effort;
- do not silently pretend the file is an exact CFR stream.

---

## 10. Video display and split layout

The main area is a multi-video viewing surface.

### Layout goals

- Keep all loaded videos visible when practical.
- Use a simple adaptive split layout rather than a custom layout engine.
- CSS Grid/flex is preferred unless evidence shows it is insufficient.
- Optimize the initial UI for 2–4 videos.

Suggested defaults:

- 1 video: 1×1;
- 2 videos: 1×2;
- 3 videos: 2×2 with one empty/expanded slot chosen by simple layout policy;
- 4 videos: 2×2.

A more advanced arbitrary layout system is not required for v1.

Each pane should show a small editable label such as `Front`, `Side`, `Top`, or the file name.

---

## 11. Right-side control pane

The main application should use a dedicated right-side pane for controls so the video surface remains uncluttered.

The pane contains at minimum:

### Playback

- Play / Pause
- Previous Frame
- Next Frame
- playback speed selector
- global/current time display

### Synchronization

- current sync status
- sync point selector
- Register Sync Point
- Update Sync Point
- Temporary Unlock
- Restore Sync
- Re-sync Here

### Capture

- Current Video Frame
- All Video Frames
- Current Multi-video View

Do not scatter duplicate synchronization controls over every video pane unless individual alignment mode requires a small per-video control.

---

## 12. Synchronization domain model

The synchronization model must distinguish:

1. global review time;
2. each video's local media time;
3. registered synchronization relationship;
4. temporary individual inspection position.

### Mapping

For the simplest static-offset model:

`localTime(video) = globalTime - offset(video)`

Equivalent sign conventions are acceptable if used consistently and serialized explicitly.

### Important invariant

Moving a video while synchronization is temporarily unlocked must not change its registered offset or sync point until the user explicitly chooses a re-sync/update operation.

---

## 13. Synchronization states

Use an explicit state machine.

### NOT_SET

- no synchronization relationship is registered;
- videos may be controlled individually for alignment.

Display: `SYNC NOT SET`.

### LOCKED

- a synchronization relationship is active;
- shared play/pause/seek/frame-step operations apply to all videos.

Display: `SYNC LOCKED`.

### TEMPORARILY_UNLOCKED

- registered synchronization is preserved;
- each video can be moved independently for inspection;
- normal shared playback controls must not silently rewrite sync data.

Display: `SYNC TEMPORARILY UNLOCKED`.

---

## 14. Initial manual alignment

Before the first synchronization is registered:

- each video can seek independently;
- each video can play/pause independently;
- each video can move previous/next frame where supported;
- the user positions all videos at the same real-world event.

Typical events:

- machine starts;
- indicator lamp changes;
- cylinder starts moving;
- visible flash;
- impact;
- clap or other common event.

When aligned, the user selects `Register Sync Point`.

---

## 15. Sync points

A sync point stores a named synchronized moment.

Required fields:

- stable ID;
- user-visible name;
- creation/update timestamp;
- each video's local time at the point;
- derived/current offsets;
- global time representation required to restore the point.

Default names may be `Sync Point 1`, `Sync Point 2`, etc.

Users can rename sync points.

### Multiple points

A project can store multiple named sync points such as:

- Machine Start
- Cylinder Extend
- Sensor On
- Machine Stop

Selecting a sync point seeks all loaded videos to the corresponding positions.

### v1 interpretation

Multiple sync points are navigation/calibration records. v1 does **not** automatically create piecewise or affine time-warp mappings between them.

Future clock-rate calibration may use two or more sync points, but that requires a separate change.

---

## 16. Update and re-registration

For an existing sync point:

### Update Sync Point

Replace the selected sync point's positions/offset relationship using the current aligned positions.

Require confirmation.

### Save as New Sync Point

Create another point without modifying the selected existing point.

### Delete / Rename

Support rename and delete with simple confirmation where destructive.

---

## 17. Temporary Unlock

From `LOCKED`, the user may choose `Temporary Unlock`.

While unlocked:

- each video can be independently played/paused/searched/frame-stepped;
- existing sync point/offset data remains unchanged;
- the UI clearly indicates unlocked status.

The user then has two distinct actions.

### Restore Sync

Discard temporary per-video inspection positions and restore the registered synchronization relationship at the chosen global reference position.

Use case: inspect another moment in one camera, then return to the original synchronized review.

### Re-sync Here

Treat the current positions of all videos as a common real-world moment and calculate a new synchronization relationship.

Prompt for:

- Cancel
- Save as New Sync Point
- Replace/Update Current Sync

Do not silently replace synchronization when entering or exiting temporary unlock.

---

## 18. Synchronization undo

Maintain a small in-memory or project-persisted synchronization change history.

Minimum requirement: one-step undo after a sync-changing operation.

Preferred small implementation: last 5–10 synchronization snapshots.

Eligible changes:

- register;
- update;
- re-sync;
- delete where restoration is practical.

Do not build a general application-wide undo framework for v1.

---

## 19. Shared playback

When `LOCKED`:

- Play starts all applicable videos.
- Pause pauses all videos.
- Seek moves the global time and maps it to all video local times.
- Frame Step moves the global reference and maps it to all videos.

Keyboard defaults should remain simple:

- `Space`: Play/Pause
- `Left`: Previous Frame
- `Right`: Next Frame

Do not add large shortcut systems before core controls are stable.

---

## 20. Master timebase and drift correction

Independent cameras and multiple decoders can drift over long playback. Initial alignment alone is not sufficient.

### Prior-art principle

`multi_video_sync_ffplay` demonstrates a useful approach: compare each video's clock to a master clock and adjust only when material error exists instead of constantly forcing every stream to an absolute position.

### v1 design

Implement a small synchronization controller that:

1. chooses/maintains one authoritative playback timebase (a master video or equivalent global media clock);
2. derives expected local time for every other video from global time and its offset;
3. periodically measures `actual - expected` error;
4. ignores small error inside a tolerance;
5. corrects material drift;
6. avoids continuous hard seeks.

### Correction policy

Exact thresholds must be derived from real test videos and recorded in code as named configuration/constants.

Initial implementation should prefer the simplest reliable policy:

- small error: no action;
- large error: controlled correction/seek at a safe point.

Do not implement playback-rate PID/control logic unless testing shows the simple threshold approach is visibly inadequate.

### Start/resume rule

Before starting/resuming synchronized playback, compare each video's current local position with its expected synchronized position. Correct material mismatches before normal playback continues, preventing a video from briefly playing from a stale location.

---

## 21. Frame stepping

For supported CFR videos, stepping operates on global time.

### Step duration

Use the active/master video's verified CFR frame duration as the global step amount unless a later setting changes the policy.

Example:

- 60 fps → approximately 16.667 ms
- 30 fps → approximately 33.333 ms

Every video is then sought/mapped to the corresponding expected local time.

### Requirements

- Forward and backward stepping are both required.
- After a step, all visible panes should settle on the intended synchronized moment before the UI claims completion.
- Use `requestVideoFrameCallback` or equivalent browser media timing primitives where they improve display-settle verification.
- Do not claim exact frame-number identity across files with different frame rates; the shared contract is synchronized real time.

---

## 22. Project persistence

The user must be able to save a project and later return to materially the same review state.

### Suggested extension

`.mvsp`

### Format

Versioned JSON, not an opaque binary format.

Example top-level shape:

```json
{
  "schemaVersion": 1,
  "videos": [],
  "syncPoints": [],
  "activeSyncPointId": null,
  "globalTime": 0,
  "syncState": "LOCKED",
  "activeVideoId": null,
  "playbackSpeed": 1,
  "layout": {}
}
```

The exact schema may evolve during repository review but must remain explicitly versioned.

### Save at minimum

For each video:

- stable project ID;
- display label;
- absolute path;
- relative path from project file where meaningful;
- file name;
- file size;
- duration;
- native resolution;
- verified frame rate/CFR metadata used by the app;
- video order/layout slot.

Project state:

- sync points;
- current/active sync point;
- registered offsets;
- current global time;
- sync state needed for safe restore;
- active/master video selection if applicable;
- playback speed;
- split layout.

Do not copy video bytes into the project file.

---

## 23. Project restore and missing files

Load resolution order:

1. valid relative path from the project file;
2. stored absolute path;
3. user-assisted relocation.

If a media file cannot be found:

- show the missing path;
- offer `Locate File`;
- offer `Locate Folder` to repair multiple moved videos where practical;
- allow `Skip` without corrupting project data.

When automatically matching a relocated file, use more than file name when possible, such as:

- file size;
- duration;
- resolution;
- frame rate.

A full-file cryptographic hash is not required for v1 because very large media would make it expensive. A future lightweight fingerprint may be added if file identity proves problematic.

---

## 24. Save safety

Project writes must avoid unnecessary corruption risk.

Prefer atomic/recoverable file-writing primitives:

1. serialize and validate complete JSON;
2. write temporary file in the same destination filesystem when practical;
3. replace/rename into place;
4. report failure without deleting the last valid project file.

Manual Save/Open is required.

Autosave/crash recovery is deferred unless it can be implemented cheaply after the core save/load path is stable.

A dirty indicator such as `*` in the project title is recommended and low-cost.

---

## 25. Capture

The right pane provides three capture operations.

### 25.1 Current Video Frame

Save the currently displayed frame from the active video at the video's **native source dimensions**, independent of on-screen pane size.

Default output: PNG.

### 25.2 All Video Frames

At the current synchronized global moment, save one native-resolution PNG per loaded video using each video's mapped local time.

Example names:

- `Front_00-01-23.417.png`
- `Side_00-01-18.204.png`
- `Top_00-01-29.551.png`

All files must represent the same synchronized global moment even though local timestamps differ.

### 25.3 Current Multi-video View

Save a single image of the current split-video presentation as the user sees it, including useful pane labels and global time but excluding irrelevant OS window chrome.

Do not create a separate complicated capture layout for v1.

### Native frame technique

First evaluate the simplest platform path:

- draw the current HTML video frame onto a Canvas sized to `videoWidth × videoHeight`;
- encode PNG;
- write it through the Tauri filesystem boundary.

Only add FFmpeg/native decoding for capture if this approach fails reliability/codec/security tests.

---

## 26. Capture destination

If a project is saved:

```text
<ProjectFolder>/
  Project.mvsp
  captures/
    frames/
    views/
```

If no project has been saved, use a predictable local Pictures/MultiVideoSyncPlayer/Captures destination or prompt once for a destination.

Do not show a Save As dialog for every repeated capture unless the user explicitly asks for one.

---

## 27. UI behavior and minimalism

The project should feel like a utility, not an editor suite.

Requirements:

- video surface gets most of the window;
- controls are centralized in the right pane;
- synchronization state is always obvious;
- local-only status is visible but unobtrusive;
- dangerous sync-replacement actions require confirmation;
- no settings screen is required until there are settings worth changing;
- do not add decorative complexity before core playback/sync reliability is proven.

---

## 28. Error behavior

Fail clearly on:

- unsupported/unreadable file;
- decoder failure;
- missing project media;
- malformed project JSON;
- unsupported project schema version;
- write permission failure;
- capture failure;
- metadata extraction failure required for exact frame stepping.

Do not silently discard errors or partially overwrite a valid project.

---

## 29. Security and privacy

- User videos remain at their original local paths unless the user explicitly copies them outside the app.
- Project files contain local paths and should be treated as potentially sensitive metadata.
- Do not log full local file paths in telemetry because telemetry does not exist in v1.
- Avoid writing video data to temp directories unless required by a validated platform limitation.
- No secret/token/API-key mechanism is required in v1.

---

## 30. Performance expectations

### Required functional baseline

On a reasonable Windows development machine, the application must support three 1080p H.264 CFR videos simultaneously for the core synchronization workflow without intentional transcoding.

### Characterization, not initial hard gate

Three simultaneous 4K streams should be tested and performance documented, but v1 acceptance should not claim a universal 3×4K performance guarantee because decode capability depends strongly on hardware and codec profile.

The application must not duplicate entire videos into RAM.

---

## 31. Acceptance criteria

### Local runtime

- L-001: Installed app starts without a local web server.
- L-002: Core workflow works with network disconnected.
- L-003: Normal runtime produces no intentional external network connection.
- L-004: No remote runtime assets are required.

### Media

- M-001: User can select at least three local MP4/H.264 files in one action.
- M-002: Files play from original paths without application-level full-file copy/import.
- M-003: Original files are not modified.
- M-004: Native dimensions and duration are detected.
- M-005: Supported CFR frame rate is determined or the app clearly marks frame stepping as unsupported/best-effort.

### Manual synchronization

- S-001: Before sync, each video can be positioned independently.
- S-002: User can register a named sync point from current positions.
- S-003: LOCKED shared play/pause operates all videos.
- S-004: LOCKED shared seek maps all videos by registered offsets.
- S-005: Previous/next frame operates all supported CFR videos at one synchronized global moment.
- S-006: Pausing/resuming does not allow a materially stale video to start from the wrong location.
- S-007: Material playback drift is detected and corrected without constant hard-seeking.

### Temporary unlock

- U-001: User can enter TEMPORARILY_UNLOCKED from LOCKED.
- U-002: Individual videos can be independently inspected while unlocked.
- U-003: Temporary inspection does not change registered offset/sync-point data.
- U-004: Restore Sync returns to the registered relationship.
- U-005: Re-sync Here can save a new sync point or replace the current one only after explicit confirmation.
- U-006: At least the immediately previous synchronization change can be undone.

### Sync points

- P-001: Multiple named sync points can be stored.
- P-002: User can rename, select, update, save-as-new, and delete sync points.
- P-003: Selecting a sync point restores all video positions for that point.

### Project persistence

- J-001: Project saves as versioned local JSON-based state.
- J-002: Closing/reopening the app and opening the project restores video order, labels, sync points, offsets, global time, playback speed, and split layout.
- J-003: Relative paths allow a self-contained project folder to move to another drive/folder when media paths stay relative.
- J-004: Missing media can be relocated without losing synchronization metadata.
- J-005: Failed save does not destroy the last valid project file.

### Capture

- C-001: Current Video Frame PNG dimensions equal native video dimensions.
- C-002: All Video Frames outputs one native-size PNG per video for the same global sync moment.
- C-003: Current Multi-video View produces one image matching the current split view and labels.
- C-004: Capture works fully offline.

### Reuse / maintenance

- R-001: Every runtime dependency added by initial implementation has an explicit reason and compatible license.
- R-002: No custom MP4 parser, file dialog, JSON serializer, or network layer is introduced when an adequate existing primitive exists.
- R-003: No third-party source is copied without recorded license/provenance.

---

## 32. Validation

Before the implementation is accepted, run the checks defined in `docs/testing/test-spec.md` and `docs/testing/test-implementation-plan.md`.

Minimum engineering checks after implementation should include the project's actual equivalents of:

```text
npm/pnpm test
npm/pnpm run lint
npm/pnpm run typecheck
cargo fmt --check
cargo clippy
cargo test
Tauri production build
```

Exact package-manager/script names must be recorded after scaffolding.

A manual Windows acceptance run using three real camera MP4s is required before claiming the core workflow complete.

---

## 33. Risks and rollback

### Browser/WebView media timing

HTMLVideoElement does not expose every container/sample detail needed for exact frame semantics. The implementation must validate CFR metadata and frame-step behavior early before building higher-level UI around unverified assumptions.

### Multi-stream decode capacity

Hardware/driver/WebView2 decode behavior differs across machines. Characterize performance and avoid promising universal 4K multi-stream throughput.

### Drift correction visual artifacts

Excessive seeks can create visible jumps. Correction thresholds must be tested with real long recordings.

### Project schema evolution

Use explicit `schemaVersion` from the first implementation. Reject unsupported newer schema versions rather than guessing.

### Third-party licensing

Prior-art repositories have different or uncertain license situations. Keep conceptual research separate from copied code and update `THIRD_PARTY_NOTICES.md` whenever code reuse changes.

---

## 34. Deferred recommended features

These are useful but should not delay v1 core completion:

- autosave/crash recovery;
- two-point affine/linear clock-rate calibration;
- playback-rate trim for gentle drift correction;
- user-selectable master camera;
- automatic audio/flash synchronization;
- additional codecs/containers;
- cross-platform builds;
- read-only project mode;
- capture metadata sidecar JSON;
- user-configurable shortcut/settings system.

Implement only after actual use demonstrates the need.

---

## 35. Open questions for repository validation

These are implementation questions, not requirement gaps:

1. Which smallest maintained metadata/demux library reliably exposes CFR/sample timing in Tauri/WebView2 for target MP4s?
2. Does Canvas native-resolution capture work reliably with Tauri's chosen local media URL/access mechanism on Windows?
3. Should the initial playback master be the first video or an internal monotonic/global clock anchored to one video's media progression?
4. What drift thresholds minimize visible correction while maintaining useful synchronization on real AKASO footage?

Resolve these with focused technical spikes before broad UI work. Do not expand scope while resolving them.
