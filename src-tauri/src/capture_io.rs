use std::fs::OpenOptions;
use std::io::Write;
use std::path::Path;

#[tauri::command]
pub(crate) fn write_capture_png(path: String, bytes: Vec<u8>) -> Result<(), String> {
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
    file.write_all(&bytes)
        .map_err(|error| format!("Could not write capture file: {error}"))
}
