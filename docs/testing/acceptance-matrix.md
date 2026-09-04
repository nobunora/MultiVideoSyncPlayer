# Acceptance Matrix

This matrix maps v1 requirements to the evidence expected from implementation. It is not a duplicate test suite; it is the release/review checklist that prevents a green unit-test run from hiding missing product behavior.

Status values used during implementation:

```text
NOT_STARTED
IMPLEMENTED_NOT_VERIFIED
PASS
FAIL
BLOCKED
NOT_APPLICABLE
```

## A. Foundation and local-only architecture

| ID | Requirement | Evidence | Gate |
| --- | --- | --- | --- |
| A-01 | Windows Tauri desktop app starts | `npm run tauri dev` / packaged build evidence | first source PR |
| A-02 | Production does not require localhost server | inspect Tauri production config/build | first source PR |
| A-03 | React + TypeScript strict | `tsc`/typecheck passes, config review | first source PR |
| A-04 | No updater/cloud/analytics/network plugin | dependency/config audit | every PR/release |
| A-05 | No remote JS/CSS/font/assets | source search + CSP review | every PR/release |
| A-06 | CSP contains no arbitrary remote HTTP(S) origin | config review | first source PR + release |
| A-07 | Runtime external connections absent during normal workflow | Windows TCPView/Resource Monitor/Wireshark or equivalent evidence | release |
| A-08 | WebView2 installer can install offline | Tauri `offlineInstaller` config and packaged install test | release |

## B. Direct Local File

| ID | Requirement | Evidence | Gate |
| --- | --- | --- | --- |
| B-01 | Native picker selects multiple MP4 files | manual/integration test | first source PR |
| B-02 | Original file path is used | path/state evidence | first source PR |
| B-03 | App does not make full video copy | directory/file-size observation and source review | first source PR |
| B-04 | Opening does not modify source | source size/mtime and optional hash before/after | first source PR |
| B-05 | Per-file failure does not abort other files | integration test with one invalid file | playback PR |
| B-06 | Asset protocol access is narrow | config/scope review | first source PR |
| B-07 | Project restore allows exact saved file, not broad drive | Rust scope test/source review | project PR |
| B-08 | Missing file is reported and repairable | project restore test | project PR |

## C. Supported media / metadata

| ID | Requirement | Evidence | Gate |
| --- | --- | --- | --- |
| C-01 | H.264 MP4 plays in target WebView2 | representative file test | first source PR |
| C-02 | duration/width/height available | loadedmetadata/integration test | first source PR |
| C-03 | video track/timing metadata obtainable | parser spike result | first source PR |
| C-04 | parser does not require entire multi-GB file in memory | implementation inspection / range-read instrumentation | first source PR |
| C-05 | CFR 30 recognized | generated fixture | sync PR |
| C-06 | CFR 60 recognized | generated fixture | sync PR |
| C-07 | 59.94 recognized where fixture available | generated fixture | sync PR |
| C-08 | VFR/unknown is not falsely marked exact-CFR | generated/real fixture | sync PR |
| C-09 | Exact frame-step disabled for unsupported timing | UI/domain test | frame-step PR |
| C-10 | AKASO V50 Elite representative file works | manual target-media evidence | before v1 release |

## D. Global synchronization model

Canonical invariant:

```text
local = global - offset
global = local + offset
```

| ID | Requirement | Evidence | Gate |
| --- | --- | --- | --- |
| D-01 | offset sign convention frozen | pure unit tests | sync model PR |
| D-02 | three independently aligned local times map to same global point | table-driven unit test | sync model PR |
| D-03 | mapping handles negative expected local time | pure boundary test | sync model PR |
| D-04 | mapping handles target after video end | pure boundary test | sync model PR |
| D-05 | global seek maps every participating video | fake-controller integration test | locked playback PR |
| D-06 | stale positions corrected before synchronized play | fake + media integration test | locked playback PR |
| D-07 | pause freezes shared state coherently | integration test | locked playback PR |
| D-08 | playback speed change applies coherently if exposed | test or N/A if v1 UI omits it | playback PR |

## E. Sync points

| ID | Requirement | Evidence | Gate |
| --- | --- | --- | --- |
| E-01 | Register creates named sync point from current positions | unit/component test | sync point PR |
| E-02 | multiple sync points can coexist | state test | sync point PR |
| E-03 | selecting sync point navigates all videos to mapped point | integration test | sync point PR |
| E-04 | Rename works without changing offsets | state test | sync point PR |
| E-05 | Delete removes only selected point | state test | sync point PR |
| E-06 | Update is explicit and confirmed | component/state test | sync point PR |
| E-07 | Save as New preserves old point | state test | sync point PR |
| E-08 | project persistence restores all sync points | round-trip + restart test | project PR |

## F. Temporary unlock / restore / re-sync

| ID | Requirement | Evidence | Gate |
| --- | --- | --- | --- |
| F-01 | LOCKED → TEMPORARILY_UNLOCKED works | state test | unlock PR |
| F-02 | unlocked videos can be manipulated independently | controller/component test | unlock PR |
| F-03 | temporary manipulation does not mutate registered offsets | unit regression test | unlock PR |
| F-04 | Restore Sync returns to prior registered relation | state/controller test | unlock PR |
| F-05 | Re-sync Here creates current-position relationship | state test | unlock PR |
| F-06 | Cancel leaves synchronization unchanged | state test | unlock PR |
| F-07 | Replace requires explicit action | component test | unlock PR |
| F-08 | Undo restores previous sync state | stack/ring unit test | unlock PR |

## G. Frame stepping

| ID | Requirement | Evidence | Gate |
| --- | --- | --- | --- |
| G-01 | next frame advances global time by active/master verified frame duration | pure/controller test | frame-step PR |
| G-02 | previous frame subtracts same duration | pure/controller test | frame-step PR |
| G-03 | every synced video seeks to mapped local position | fake controller test | frame-step PR |
| G-04 | exact frame controls disabled for unknown/VFR | UI test | frame-step PR |
| G-05 | repeated next/previous operation remains reversible within timestamp tolerance | integration test | frame-step PR |
| G-06 | real 60 fps footage visibly advances one frame per command | manual media evidence | release |

## H. Drift

| ID | Requirement | Evidence | Gate |
| --- | --- | --- | --- |
| H-01 | drift sampled against shared/master timebase | measurement output | first source PR |
| H-02 | threshold values derived from measurement, not arbitrary constants | implementation report | locked playback PR |
| H-03 | error below ignore threshold causes no seek | pure/fake test | locked playback PR |
| H-04 | material error causes one targeted correction | fake test | locked playback PR |
| H-05 | controller does not seek every frame/poll | fake/count test | locked playback PR |
| H-06 | pause stops correction activity | fake/controller test | locked playback PR |
| H-07 | resume preflight fixes stale stream | fake + media test | locked playback PR |
| H-08 | 10-minute 3-video run stays within accepted tolerance | measured real/generated media run | before release |

The final numerical tolerance is written into the test spec after Phase 0 measurements. Until then H-08 remains measurable but threshold-unset, not waived.

## I. Project persistence

Project extension: `.mvsp`  
Schema starts at `schemaVersion: 1`.

| ID | Requirement | Evidence | Gate |
| --- | --- | --- | --- |
| I-01 | new project saves valid JSON | parser/round-trip test | project PR |
| I-02 | schemaVersion always present | unit test | project PR |
| I-03 | runtime-only objects not serialized | unit test | project PR |
| I-04 | video bytes never embedded | schema/content assertion | project PR |
| I-05 | absolute and relative paths stored where applicable | round-trip test | project PR |
| I-06 | malformed project rejected before live-state mutation | parser/state test | project PR |
| I-07 | future schema rejected clearly | parser test | project PR |
| I-08 | atomic overwrite preserves previous valid project on failed update | Rust filesystem test | project PR |
| I-09 | app restart restores videos/order/global time/sync state | packaged/dev integration | project PR |
| I-10 | project never auto-plays on load | integration test | project PR |
| I-11 | Locate File repairs one moved video | integration/manual test | project PR |
| I-12 | relative path works after moving project folder tree | temp-directory test | project PR |

## J. Capture

| ID | Requirement | Evidence | Gate |
| --- | --- | --- | --- |
| J-01 | current video PNG dimensions equal source dimensions | automated dimension check | first source PR spike + capture PR |
| J-02 | current video capture does not use displayed CSS dimensions | source + dimension test | capture PR |
| J-03 | all-video capture waits until mapped seeks settle | fake/controller test | capture PR |
| J-04 | all-video capture writes one native PNG per video | integration test | capture PR |
| J-05 | composite reflects current split layout | image/manual test | capture PR |
| J-06 | composite includes camera labels | image/manual test | capture PR |
| J-07 | composite includes global time | image/manual test | capture PR |
| J-08 | no FFmpeg runtime required | dependency/runtime audit | capture PR/release |
| J-09 | default capture output is PNG | test | capture PR |

## K. UI / interaction

| ID | Requirement | Evidence | Gate |
| --- | --- | --- | --- |
| K-01 | video surface stays primary; controls use right pane | manual review | UI PR |
| K-02 | no duplicate global toolbar system | manual review | UI PR |
| K-03 | status clearly shows NOT SET / LOCKED / TEMPORARILY UNLOCKED | component/manual test | UI PR |
| K-04 | locked state prevents accidental individual timeline mutation | component/controller test | UI PR |
| K-05 | temporary-unlock recovery actions are visible | component test | UI PR |
| K-06 | split layout works for 1–4 videos | component/manual test | UI PR |
| K-07 | keyboard Space / Left / Right do not conflict with text inputs | component/manual test | UI PR |

## L. Reuse / licensing / maintainability

| ID | Requirement | Evidence | Gate |
| --- | --- | --- | --- |
| L-01 | major subsystem has reuse decision before custom implementation | PR report | every non-trivial PR |
| L-02 | no GPL Vodon Pro source copied into MIT codebase | diff/license review | every PR |
| L-03 | ffplay-derived source not copied without provenance decision | diff/license review | every PR |
| L-04 | direct third-party dependencies have recorded license/purpose | dependency table | every dependency PR |
| L-05 | THIRD_PARTY_NOTICES updated when notice obligation introduced | file review | before merge/release |
| L-06 | no unused dependency retained after failed spike | package/Cargo audit | every PR |
| L-07 | no broad abstraction created solely for possible future features | human/code review | every PR |

## M. CodebaseMemory / repository-agent discipline

| ID | Requirement | Evidence | Gate |
| --- | --- | --- | --- |
| M-01 | no fake empty graph before source exists | repository state | initial docs phase |
| M-02 | CodebaseMemory initialized once meaningful source exists | implementation record | after first source PR |
| M-03 | target symbols/callers/callees/tests queried before non-trivial changes | implementation report | subsequent PRs |
| M-04 | graph signals verified with source/`rg` | report/code review | subsequent PRs |
| M-05 | tracked graph refreshed once after source-bearing change and committed last | commit history/report | when graph tracked |
| M-06 | graph is not regenerated solely because artifact commit moved HEAD | commit history | when graph tracked |

## N. Release acceptance

v1 release cannot be called ready until all of the following are PASS or explicitly accepted with a documented limitation:

- A-01 through A-08;
- B-01 through B-08;
- C-01 through C-10;
- D/E/F/G core sync requirements;
- H-08 sustained drift run;
- I project restore requirements;
- J capture requirements;
- K required UI states;
- L licensing/reuse gates;
- M CodebaseMemory rules applicable after source exists.

Final release report must include:

```text
build artifact identity
Windows version tested
WebView2 version observed
target camera/media tested
three-video sustained-run duration
max/p95 synchronization error
network-monitor result
project round-trip result
capture dimension result
known limitations
third-party licenses/notices
```
