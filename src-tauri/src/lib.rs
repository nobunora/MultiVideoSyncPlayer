use std::fs::{self, File, OpenOptions};
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};

use serde::Serialize;
use shiguredo_mp4::boxes::SampleEntry;
use shiguredo_mp4::demux::{Input, Mp4FileDemuxer};
use shiguredo_mp4::TrackKind;
use tauri::{AppHandle, Manager};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PreparedVideoFile {
    path: String,
    file_name: String,
    size_bytes: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct Mp4TimingInfo {
    video_track_count: usize,
    codec: String,
    duration_seconds: f64,
    timescale: u32,
    sample_count: usize,
    frame_duration_seconds: Option<f64>,
    cfr: bool,
    timing_source: &'static str,
}

fn canonical_mp4_path(path: &str) -> Result<PathBuf, String> {
    let candidate = Path::new(path);
    let canonical = fs::canonicalize(candidate)
        .map_err(|error| format!("Cannot access video path: {error}"))?;
    let metadata =
        fs::metadata(&canonical).map_err(|error| format!("Cannot stat video path: {error}"))?;
    if !metadata.is_file() {
        return Err("The selected path is not a regular file.".to_owned());
    }
    if canonical
        .extension()
        .and_then(|extension| extension.to_str())
        .is_none_or(|extension| !extension.eq_ignore_ascii_case("mp4"))
    {
        return Err("Only .mp4 files are supported in this foundation cut.".to_owned());
    }
    Ok(canonical)
}

#[tauri::command]
fn prepare_video_file(app: AppHandle, path: String) -> Result<PreparedVideoFile, String> {
    let canonical = canonical_mp4_path(&path)?;
    app.asset_protocol_scope()
        .allow_file(&canonical)
        .map_err(|error| format!("Could not authorize the selected file: {error}"))?;
    let metadata =
        fs::metadata(&canonical).map_err(|error| format!("Cannot stat video path: {error}"))?;
    let file_name = canonical
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("video.mp4")
        .to_owned();

    Ok(PreparedVideoFile {
        path: canonical.to_string_lossy().into_owned(),
        file_name,
        size_bytes: metadata.len(),
    })
}

fn read_required_input(
    file: &mut File,
    file_size: u64,
    position: u64,
    requested_size: Option<usize>,
) -> Result<Vec<u8>, String> {
    if position > file_size {
        return Err("MP4 parser requested data past the end of the file.".to_owned());
    }
    let available = file_size - position;
    let size = requested_size.map_or(available as usize, |requested| {
        requested.min(available as usize)
    });
    file.seek(SeekFrom::Start(position))
        .map_err(|error| format!("MP4 seek failed: {error}"))?;
    let mut data = vec![0_u8; size];
    file.read_exact(&mut data)
        .map_err(|error| format!("MP4 range read failed: {error}"))?;
    Ok(data)
}

fn inspect_mp4_timing_file(path: &Path) -> Result<Mp4TimingInfo, String> {
    let mut file = File::open(path).map_err(|error| format!("Cannot open MP4: {error}"))?;
    let file_size = file
        .metadata()
        .map_err(|error| format!("Cannot stat MP4: {error}"))?
        .len();
    let mut demuxer = Mp4FileDemuxer::new();

    while let Some(required) = demuxer.required_input() {
        let data = read_required_input(&mut file, file_size, required.position, required.size)?;
        demuxer.handle_input(Input {
            position: required.position,
            data: &data,
        });
    }

    let tracks = demuxer
        .tracks()
        .map_err(|error| format!("MP4 track metadata failed: {error}"))?;
    let video_tracks: Vec<_> = tracks
        .iter()
        .filter(|track| track.kind == TrackKind::Video)
        .cloned()
        .collect();
    let video_track = video_tracks
        .first()
        .ok_or_else(|| "No video track was found in the MP4.".to_owned())?;
    let mut codec: Option<&'static str> = None;
    let mut sample_count = 0_usize;
    let mut frame_duration_ticks: Option<u32> = None;
    let mut cfr = true;

    while let Some(sample) = demuxer
        .next_sample()
        .map_err(|error| format!("MP4 sample timing failed: {error}"))?
    {
        if sample.track.track_id != video_track.track_id {
            continue;
        }
        sample_count += 1;
        if let Some(entry) = sample.sample_entry {
            codec = Some(match entry {
                SampleEntry::Avc1(_) => "avc1",
                SampleEntry::Hev1(_) => "hev1",
                SampleEntry::Hvc1(_) => "hvc1",
                SampleEntry::Vp08(_) => "vp08",
                SampleEntry::Vp09(_) => "vp09",
                SampleEntry::Av01(_) => "av01",
                SampleEntry::Unknown(_) => "unknown",
                _ => "non-video",
            });
        }
        if sample.duration == 0 {
            cfr = false;
        } else if let Some(first_duration) = frame_duration_ticks {
            if first_duration != sample.duration {
                cfr = false;
            }
        } else {
            frame_duration_ticks = Some(sample.duration);
        }
    }

    let timescale = video_track.timescale.get();
    let frame_duration_seconds =
        frame_duration_ticks.map(|duration| f64::from(duration) / f64::from(timescale));
    Ok(Mp4TimingInfo {
        video_track_count: video_tracks.len(),
        codec: codec.unwrap_or("unknown").to_owned(),
        duration_seconds: video_track.duration as f64 / f64::from(timescale),
        timescale,
        sample_count,
        frame_duration_seconds,
        cfr: cfr && sample_count > 0,
        timing_source: "shiguredo_mp4",
    })
}

#[tauri::command]
fn inspect_mp4_timing(path: String) -> Result<Mp4TimingInfo, String> {
    let canonical = canonical_mp4_path(&path)?;
    inspect_mp4_timing_file(&canonical)
}

#[tauri::command]
fn write_capture_png(path: String, bytes: Vec<u8>) -> Result<(), String> {
    let output = Path::new(&path);
    if output
        .extension()
        .and_then(|extension| extension.to_str())
        .is_none_or(|extension| !extension.eq_ignore_ascii_case("png"))
    {
        return Err("Capture output must use the .png extension.".to_owned());
    }
    if !output.parent().is_some_and(Path::is_dir) {
        return Err("Capture output directory does not exist.".to_owned());
    }
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(output)
        .map_err(|error| format!("Could not create capture file: {error}"))?;
    std::io::Write::write_all(&mut file, &bytes)
        .map_err(|error| format!("Could not write capture file: {error}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            prepare_video_file,
            inspect_mp4_timing,
            write_capture_png
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_missing_video_path() {
        let result = canonical_mp4_path("C:\\definitely-missing-multivideosyncplayer-test.mp4");
        assert!(result.is_err());
    }

    #[test]
    fn rejects_directory_as_video() {
        let result = canonical_mp4_path(env!("CARGO_MANIFEST_DIR"));
        assert_eq!(
            result.unwrap_err(),
            "The selected path is not a regular file."
        );
    }

    #[test]
    fn rejects_non_mp4_file() {
        let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("Cargo.toml");
        let result = canonical_mp4_path(path.to_str().expect("manifest path is valid UTF-8"));
        assert_eq!(
            result.unwrap_err(),
            "Only .mp4 files are supported in this foundation cut."
        );
    }

    #[test]
    fn validates_phase0_fixture_when_requested() {
        let Ok(path) = std::env::var("MVSP_PHASE0_FIXTURE") else {
            return;
        };
        let timing =
            inspect_mp4_timing_file(Path::new(&path)).expect("fixture timing should parse");
        println!("phase0 timing evidence: {timing:?}");
        assert_eq!(timing.codec, "avc1");
        assert!(timing.cfr);
        assert_eq!(timing.sample_count, 90);
    }
}
