# Existing Solutions and Reuse Decisions

## Purpose

MultiVideoSyncPlayer must minimize unnecessary custom development. This document records known prior art and the current decision about what to reuse, what to study, and what not to copy.

The rule is not "always use a dependency." The rule is: **do not re-solve a solved problem without first checking the available solution and documenting why reuse is unsuitable.**

## Decision criteria

Before adding a dependency or writing a replacement, compare:

- exact requirement coverage;
- maintenance/activity;
- license and source provenance;
- runtime size and installation burden;
- security/network behavior;
- Windows/WebView2/Tauri compatibility;
- deterministic offline behavior;
- testability;
- API stability;
- amount of glue code versus custom code.

Prefer a maintained, narrowly suitable primitive. Avoid pulling in a large subsystem for a small feature.

---

## 1. Vodon Pro

Repository: https://github.com/Rodeoclash/vodon-pro

### Useful ideas

- explicit manual alignment of independently recorded videos;
- per-video synchronization times/offsets;
- a shared/global review timeline;
- synchronized play/pause and seek;
- frame stepping from a selected/active video;
- multi-video review as the primary workflow rather than video editing.

### Reuse decision

Use as UX and behavioral prior art. Do not copy source into this MIT project by default because the repository license is GPL-3.0.

The project should acknowledge Vodon prominently because it was the direct product inspiration.

---

## 2. Vodon Player

Repository: https://github.com/Rodeoclash/vodon-player

License: MIT.

### Useful ideas

- web-technology UI for multi-video review;
- local application state;
- separation between media storage and analysis/review state;
- continuation of the Vodon workflow without requiring server-side video processing.

### What not to adopt by default

Vodon Player copies selected videos into OPFS. MultiVideoSyncPlayer targets large local experiment/equipment recordings and therefore uses **Direct Local File** by default to avoid duplicate storage and import delay.

### Reuse decision

MIT-licensed code can be considered if it precisely matches a need and its notice is retained. Do not port large UI/features merely because they exist. Prefer small, well-bounded reuse.

---

## 3. NuerSir/multi_video_sync_ffplay

Repository: https://github.com/NuerSir/multi_video_sync_ffplay

Observed repository license file: MIT.

### Useful ideas

The implementation demonstrates:

- one stream acting as the master timebase;
- measuring the difference between each video clock and the master clock;
- changing presentation delay based on clock error rather than repeatedly hard-seeking on every refresh;
- synchronized pause/play;
- synchronized frame-step commands;
- synchronized seek commands.

These ideas directly address the long-recording drift problem from independent cameras.

### Limitations

The current code is an engineering prototype rather than a general desktop product:

- four streams are hard-coded;
- video file paths are hard-coded;
- the layout is hard-coded to a 2×2 arrangement;
- there is no project/synchronization-point workflow;
- there is no general GUI/file picker.

### Provenance caution

The project is explicitly an ffplay refactor. A repository-level MIT file does not by itself prove that every ffplay-derived portion can be copied under MIT. Before substantial code reuse, inspect the exact origin and applicable FFmpeg licensing.

### Reuse decision

**Reuse the synchronization strategy concept, not source code, unless a provenance audit clears the exact code.**

For the WebView2 implementation, translate the concept into a small controller:

1. compute a global/master media time;
2. map it to each video's expected local time using its registered offset;
3. measure slave error;
4. ignore small errors;
5. correct only material drift;
6. avoid continuous hard seeks.

The initial implementation should use the simplest correction proven sufficient by tests. Playback-rate trimming is not required until hard/soft threshold correction is shown insufficient.

---

## 4. ElizabethViera/multi-video-sync

Repository: https://github.com/ElizabethViera/multi-video-sync

No license file was found during the 2026-09-04 review.

### Useful idea

The small React proof of concept models synchronization as:

`local video time = shared global time - video offset`

This matches the simplest useful domain model for the project.

### Reuse decision

Conceptual reference only. Do not copy source unless licensing/permission is established.

---

## 5. numediart/multi_video_sync

Repository: https://github.com/numediart/multi_video_sync

This is research code for deep-learning-based stereo/multi-video synchronization.

### Reuse decision

Do not use in v1. Automatic visual/ML synchronization adds model/runtime/dependency complexity that is unnecessary for the required manual-sync workflow.

Possible future research only if users later require automatic alignment.

---

## 6. shiguredo_mp4

Repository: https://github.com/shiguredo/mp4-rs  
Crate: `shiguredo_mp4`  
Observed release during 2026-09-04 research: 2026.5.0  
License: Apache-2.0

### Why it is relevant

MultiVideoSyncPlayer needs MP4 track/sample timing for reliable CFR/frame-step classification, but does not need a custom decoder.

`shiguredo_mp4` is a strong first candidate because it is:

- actively released in 2026;
- written in Rust, matching the Tauri local-file boundary;
- zero-dependency at crate level according to current package documentation;
- Windows compatible;
- H.264/AVC MP4 aware;
- capable of exposing track and media-sample timing;
- Sans-I/O/incremental, allowing the application to read only file ranges requested by the parser rather than loading a multi-gigabyte video into memory.

References:

- https://docs.rs/crate/shiguredo_mp4/latest
- https://docs.rs/shiguredo_mp4/latest/shiguredo_mp4/demux/

### Reuse decision

**First Phase 0 metadata parser candidate.**

Keep it as a runtime dependency only if a representative target MP4 proves that its API can determine the required timing/CFR information cleanly. If it fails, remove it before adding another parser.

Apache-2.0 notice/license obligations must be reflected in third-party notices if the crate becomes a shipped dependency.

---

## 7. mp4box.js

Repository: https://github.com/gpac/mp4box.js  
Package: `mp4box`  
Observed version during 2026-09-04 research: 2.4.1  
License: BSD-3-Clause

### Useful capability

It is a mature JavaScript ISO-BMFF/MP4 parser and can expose track/sample metadata.

### Why it is not the first choice

The application already needs a Rust boundary for direct local file I/O. Making the browser/WebView parse MP4 metadata would either require:

- moving chunks of large local files through frontend plumbing; or
- maintaining a second file-access path in the WebView.

That is unnecessary unless the Rust parser candidates fail.

### Reuse decision

Fallback metadata parser candidate, not a default dependency.

---

## 8. Other Rust MP4 parser fallbacks

### re_mp4

Repository: https://github.com/rerun-io/re_mp4  
License: MIT.

Current research indicates active 2026 releases. It is a possible fallback if the first parser cannot satisfy the exact sample-timing requirement.

### mp4 / mp4-rust

Repository: https://github.com/alfg/mp4-rust  
Crate: `mp4`  
License: MIT.

A stable ISO-MP4 reader/writer with straightforward file-reader APIs. Its current public version observed in research is older than the preferred candidate, so it is a fallback rather than the first choice.

### Reuse decision

Evaluate one parser at a time. Do not accumulate multiple parser dependencies in the product.

---

## 9. Platform primitives to reuse before custom code

The implementation should prefer existing platform/runtime primitives:

- official Tauri dialog plugin for native file selection;
- Tauri asset protocol + `convertFileSrc` for exact local video playback in WebView2;
- narrow Rust `std::fs`/`std::io` helpers for application-owned filesystem operations;
- HTML5 `<video>` / WebView2 media decoding for supported MP4/H.264 playback;
- `requestVideoFrameCallback` where useful for displayed-frame timing;
- Canvas for native-dimension current-frame capture;
- Canvas composition for clean multi-video capture before a DOM screenshot dependency is considered;
- JSON for project persistence;
- CSS Grid/flex layout for split video presentation;
- browser monotonic timing (`performance.now`) and media `currentTime` rather than implementing a timer framework;
- standard React state primitives unless measured complexity justifies a dedicated state library.

## 10. Deliberately avoided dependencies

Do not bundle FFmpeg solely for functionality already reliably available from WebView2 and an MP4 metadata parser. FFmpeg may be used as a development/test-video generator without becoming a runtime dependency.

Do not initially add:

- general UI framework;
- state management framework;
- schema-validation framework;
- DOM screenshot framework;
- database;
- HTTP/updater/cloud SDK;
- multiple MP4 parser libraries.

## 11. Mandatory pre-implementation check

For each major work item in `docs/implementation/implementation-plan.md`, the repository agent must state one of:

- `reuse existing project code`;
- `reuse platform primitive`;
- `reuse third-party dependency`;
- `implement locally because no suitable reusable primitive exists`.

For the last two choices, record the reason and license/maintenance impact in the implementation record/PR.
