import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";

export async function chooseCapturePath(defaultPath: string): Promise<string | null> {
  const selected = await save({
    defaultPath,
    filters: [{ name: "PNG image", extensions: ["png"] }],
  });
  return selected;
}

export function writeCapturePng(path: string, bytes: number[]): Promise<void> {
  return invoke("write_capture_png", { path, bytes });
}
