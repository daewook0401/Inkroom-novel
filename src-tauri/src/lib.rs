use std::fs;
use std::path::Path;

#[tauri::command]
fn write_text_file(path: String, contents: String) -> Result<(), String> {
    ensure_parent_dir(&path)?;
    fs::write(path, contents).map_err(|error| error.to_string())
}

#[tauri::command]
fn write_binary_file(path: String, bytes: Vec<u8>) -> Result<(), String> {
    ensure_parent_dir(&path)?;
    fs::write(path, bytes).map_err(|error| error.to_string())
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(path).map_err(|error| error.to_string())
}

fn ensure_parent_dir(path: &str) -> Result<(), String> {
    if let Some(parent) = Path::new(path).parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            write_text_file,
            write_binary_file,
            read_text_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running Inkroom");
}
