import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

export interface PreparedVideoFile {
  path: string;
  fileName: string;
  sizeBytes: number;
  sourceUrl: string;
}

export interface Mp4TimingInfo {
  videoTrackCount: number;
  codec: string;
  durationSeconds: number;
  timescale: number;
  sampleCount: number;
  frameDurationSeconds: number | null;
  cfr: boolean;
  timingSource: "shiguredo_mp4";
}

export async function selectVideoPaths(): Promise<string[]> {
  const selected = await open({
    multiple: true,
    directory: false,
    filters: [{ name: "MP4 video", extensions: ["mp4"] }],
  });

  if (!selected) return [];
  return Array.isArray(selected) ? selected : [selected];
}

export async function prepareVideoFile(path: string): Promise<PreparedVideoFile> {
  const info = await invoke<Omit<PreparedVideoFile, "sourceUrl">>(
    "prepare_video_file",
    { path },
  );

  return {
    ...info,
    sourceUrl: convertFileSrc(info.path, "asset"),
  };
}

export function inspectMp4Timing(path: string): Promise<Mp4TimingInfo> {
  return invoke<Mp4TimingInfo>("inspect_mp4_timing", { path });
}
