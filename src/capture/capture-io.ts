import { selectCaptureOutputPath, writePngFile } from "../platform/tauri-capture";

export async function chooseCapturePath(defaultPath: string): Promise<string | null> {
  return selectCaptureOutputPath(defaultPath);
}

export function writeCapturePng(path: string, bytes: number[]): Promise<void> {
  return writePngFile(path, bytes);
}
