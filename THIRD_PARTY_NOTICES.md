# Third-Party Notices and Prior Art

MultiVideoSyncPlayer is an independent project.

At the time this notice was created, the repository contains planning/specification material only and does not intentionally include copied source code from the projects listed below. These projects influenced requirements, interaction ideas, or technical investigation.

## Vodon Pro

- Project: https://github.com/Rodeoclash/vodon-pro
- Author: Samuel Richardson / Rodeoclash
- License observed in repository: GNU GPL v3

MultiVideoSyncPlayer was directly inspired by Vodon Pro's workflow for aligning and reviewing multiple video recordings. Because Vodon Pro is GPL-3.0, its source should not be copied into this MIT-licensed project without an explicit licensing decision.

## Vodon Player

- Project: https://github.com/Rodeoclash/vodon-player
- Author: Samuel Richardson
- License: MIT

Vodon Player is the web-oriented successor to Vodon Pro. Its local-processing model and multi-video review direction are useful prior art. Its OPFS-copy approach is not the default architecture here: MultiVideoSyncPlayer uses Direct Local File by default.

If source code is later copied or substantially derived from Vodon Player, preserve the applicable MIT copyright and license notice and update this file with the specific derived paths.

## multi_video_sync_ffplay

- Project: https://github.com/NuerSir/multi_video_sync_ffplay
- License file present: MIT, copyright (c) 2021 flowerlove

This repository demonstrates synchronized multi-video playback using FFmpeg/SDL concepts, including a master clock, clock-difference correction, synchronized pause, frame stepping, and seek. It is useful technical prior art.

The codebase is explicitly described as an ffplay refactor. Before copying substantial code, audit the provenance and the licensing obligations of the relevant FFmpeg/ffplay-derived portions. Until that audit is complete, use the repository as an algorithm/behavior reference rather than a direct code source.

## ElizabethViera/multi-video-sync

- Project: https://github.com/ElizabethViera/multi-video-sync
- License file: none found when reviewed on 2026-09-04

This small React proof of concept demonstrates a shared global time with per-video offsets. Because no license file was found, use it as conceptual prior art only unless permission or licensing is established.

## Deep learning-based stereo camera multi-video synchronization

- Project: https://github.com/numediart/multi_video_sync

This project investigates ML-based automatic synchronization. Automatic visual/ML synchronization is intentionally outside the v1 scope of MultiVideoSyncPlayer; manual synchronization is simpler, deterministic, local, and sufficient for the initial use case.

## Updating this notice

Whenever third-party source is copied, vendored, substantially adapted, or linked in a way that creates notice obligations, update this file in the same change. Record:

- project and exact source path/version/commit;
- license;
- files or components derived from it;
- required notices or distribution obligations.
