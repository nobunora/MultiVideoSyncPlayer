import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

export interface PlatformPreparedVideoFile {
  path: string;
  fileName: string;
  sizeBytes: number;
  sourceUrl: string;
}

export interface PlatformMp4TimingInfo {
  videoTrackCount: number;
  codec: string;
  durationSeconds: number;
  timescale: number;
  sampleCount: number;
  frameDurationSeconds: number | null;
  cfr: boolean;
  timingSource: "shiguredo_mp4";
}

export async function selectLocalVideoPaths(): Promise<string[]> {
  const selected = await open({
    multiple: true,
    directory: false,
    filters: [{ name: "MP4 video", extensions: ["mp4"] }],
  });

  if (!selected) return [];
  return Array.isArray(selected) ? selected : [selected];
}

export async function prepareLocalVideoFile(path: string): Promise<PlatformPreparedVideoFile> {
  const info = await invoke<Omit<PlatformPreparedVideoFile, "sourceUrl">>(
    "prepare_video_file",
    { path },
  );

  return {
    ...info,
    sourceUrl: convertFileSrc(info.path, "asset"),
  };
}

export function inspectLocalMp4Timing(path: string): Promise<PlatformMp4TimingInfo> {
  return invoke<PlatformMp4TimingInfo>("inspect_mp4_timing", { path });
}
