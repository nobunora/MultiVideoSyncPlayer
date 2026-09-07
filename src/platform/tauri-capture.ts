import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";

export async function selectCaptureOutputPath(defaultPath: string): Promise<string | null> {
  return save({
    defaultPath,
    filters: [{ name: "PNG image", extensions: ["png"] }],
  });
}

export function writePngFile(path: string, bytes: number[]): Promise<void> {
  return invoke("write_capture_png", { path, bytes });
}
