import {
  inspectLocalMp4Timing,
  prepareLocalVideoFile,
  selectLocalVideoPaths,
  type PlatformMp4TimingInfo,
  type PlatformPreparedVideoFile,
} from "../platform/tauri-media";

export type PreparedVideoFile = PlatformPreparedVideoFile;

export type Mp4TimingInfo = PlatformMp4TimingInfo;

export async function selectVideoPaths(): Promise<string[]> {
  return selectLocalVideoPaths();
}

export async function prepareVideoFile(path: string): Promise<PreparedVideoFile> {
  return prepareLocalVideoFile(path);
}

export function inspectMp4Timing(path: string): Promise<Mp4TimingInfo> {
  return inspectLocalMp4Timing(path);
}
