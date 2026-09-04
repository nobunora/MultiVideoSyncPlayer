mod capture_io;
mod media_file;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            media_file::prepare_video_file,
            media_file::inspect_mp4_timing,
            capture_io::write_capture_png
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
