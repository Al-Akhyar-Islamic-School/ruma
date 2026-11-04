pub mod ai;
pub mod audio;

use ai::WhisperModelInfo;
use audio::{AudioDeviceItem, AudioState};
use std::path::PathBuf;
use tauri::{AppHandle, Manager, State};

fn get_default_save_path(app: &AppHandle) -> PathBuf {
    let doc_dir = app
        .path()
        .document_dir()
        .unwrap_or_else(|_| std::env::temp_dir());
    let ruma_dir = doc_dir.join("ruma-notulen");
    std::fs::create_dir_all(&ruma_dir).ok();
    ruma_dir
}

fn get_models_dir(app: &AppHandle) -> PathBuf {
    let app_data = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| std::env::temp_dir());
    let models_dir = app_data.join("models").join("whisper");
    std::fs::create_dir_all(&models_dir).ok();
    models_dir
}

#[tauri::command]
fn cmd_list_devices() -> Result<Vec<AudioDeviceItem>, String> {
    audio::list_input_devices()
}

#[tauri::command]
fn cmd_get_default_save_dir(app: AppHandle) -> String {
    get_default_save_path(&app).to_string_lossy().to_string()
}

#[tauri::command]
async fn cmd_pick_folder() -> Option<String> {
    let handle = rfd::AsyncFileDialog::new()
        .set_title("Pilih Folder Penyimpanan Rekaman")
        .pick_folder()
        .await;
    handle.map(|h| h.path().to_string_lossy().to_string())
}

#[tauri::command]
async fn cmd_pick_audio_file() -> Option<String> {
    let handle = rfd::AsyncFileDialog::new()
        .set_title("Pilih Berkas Rekaman Audio")
        .add_filter("Berkas Audio (*.wav, *.mp3, *.m4a)", &["wav", "mp3", "m4a", "webm", "ogg"])
        .pick_file()
        .await;
    handle.map(|h| h.path().to_string_lossy().to_string())
}
#[tauri::command]
fn cmd_detect_google_drive_folder() -> Option<String> {
    #[cfg(target_os = "macos")]
    {
        if let Some(home) = std::env::var_os("HOME") {
            let cloud_storage = PathBuf::from(home).join("Library").join("CloudStorage");
            if let Ok(entries) = std::fs::read_dir(&cloud_storage) {
                for entry in entries.flatten() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    if name.starts_with("GoogleDrive") {
                        let my_drive = entry.path().join("My Drive").join("ruma. Notulen");
                        std::fs::create_dir_all(&my_drive).ok();
                        return Some(my_drive.to_string_lossy().to_string());
                    }
                }
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        for drive in ["G", "H", "I", "D", "E"] {
            let p = PathBuf::from(format!(r"{}:\My Drive\ruma. Notulen", drive));
            if p.parent().map(|parent| parent.exists()).unwrap_or(false) {
                std::fs::create_dir_all(&p).ok();
                return Some(p.to_string_lossy().to_string());
            }
        }
    }

    None
}

#[tauri::command]
fn cmd_save_notulen_file(
    dest_dir: String,
    title: String,
    content_md: String,
) -> Result<String, String> {
    let dir = PathBuf::from(dest_dir);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    let clean_title = title.replace(|c: char| !c.is_alphanumeric() && c != '-' && c != '_', "_");
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let filename = format!("Notulen_{}_{}.md", clean_title, timestamp);
    let target = dir.join(filename);

    std::fs::write(&target, content_md).map_err(|e| e.to_string())?;

    Ok(target.to_string_lossy().to_string())
}

#[tauri::command]
fn cmd_start_recording(
    state: State<'_, AudioState>,
    app: AppHandle,
    device_name: Option<String>,
    custom_dir: Option<String>,
    title: Option<String>,
) -> Result<String, String> {
    let base_dir = match custom_dir {
        Some(d) if !d.trim().is_empty() => PathBuf::from(d.trim()),
        _ => get_default_save_path(&app),
    };
    std::fs::create_dir_all(&base_dir).ok();

    let clean_title = title
        .unwrap_or_else(|| "rapat".to_string())
        .replace(|c: char| !c.is_alphanumeric() && c != '-' && c != '_', "_");

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let filename = format!("{}_{}.wav", clean_title, timestamp);
    let target_path = base_dir.join(filename);

    state.start(device_name, target_path)
}

#[tauri::command]
fn cmd_stop_recording(state: State<'_, AudioState>) -> Result<String, String> {
    let path = state.stop()?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn cmd_get_audio_level(state: State<'_, AudioState>) -> f32 {
    state.current_level.lock().map(|l| *l).unwrap_or(0.0)
}

#[tauri::command]
fn cmd_list_whisper_models(app: AppHandle) -> Vec<WhisperModelInfo> {
    let dir = get_models_dir(&app);
    ai::get_whisper_models_status(&dir)
}

#[tauri::command]
async fn cmd_download_whisper_model(app: AppHandle, model_id: String) -> Result<String, String> {
    let dir = get_models_dir(&app);
    let p = ai::download_whisper_file(&dir, &model_id).await?;
    Ok(p.to_string_lossy().to_string())
}

#[tauri::command]
async fn cmd_check_ollama(base_url: Option<String>) -> Result<Vec<ai::OllamaModelItem>, String> {
    let url = base_url.unwrap_or_else(|| "http://localhost:11434".to_string());
    ai::check_ollama_service(&url).await
}

#[tauri::command]
async fn cmd_pull_ollama_model(base_url: Option<String>, model_name: String) -> Result<String, String> {
    let url = base_url.unwrap_or_else(|| "http://localhost:11434".to_string());
    ai::pull_ollama_model(&url, &model_name).await
}

#[tauri::command]
async fn cmd_generate_notulen(
    base_url: Option<String>,
    model: String,
    transcript: String,
    title: String,
) -> Result<ai::NotulenLokalResult, String> {
    let url = base_url.unwrap_or_else(|| "http://localhost:11434".to_string());
    ai::generate_notulen_ollama(&url, &model, &transcript, &title).await
}
#[tauri::command]
async fn cmd_generate_notulen_gemini(
    base_url: Option<String>,
    api_key: String,
    model: String,
    transcript: String,
    title: String,
) -> Result<ai::NotulenLokalResult, String> {
    ai::generate_notulen_gemini(base_url.as_deref(), &api_key, &model, &transcript, &title).await
}

#[tauri::command]
async fn cmd_generate_notulen_cloudflare(
    account_id: String,
    api_token: String,
    model: String,
    transcript: String,
    title: String,
) -> Result<ai::NotulenLokalResult, String> {
    ai::generate_notulen_cloudflare(&account_id, &api_token, &model, &transcript, &title).await
}

#[tauri::command]
async fn cmd_transcribe_cloudflare_whisper(
    account_id: String,
    api_token: String,
    model: Option<String>,
    wav_path: String,
) -> Result<String, String> {
    ai::transcribe_cloudflare_whisper(&account_id, &api_token, model.as_deref(), &wav_path).await
}

pub fn run() {
    let audio_state = AudioState::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .manage(audio_state)
        .invoke_handler(tauri::generate_handler![
            cmd_list_devices,
            cmd_get_default_save_dir,
            cmd_pick_folder,
            cmd_pick_audio_file,
            cmd_detect_google_drive_folder,
            cmd_save_notulen_file,
            cmd_start_recording,
            cmd_stop_recording,
            cmd_get_audio_level,
            cmd_list_whisper_models,
            cmd_download_whisper_model,
            cmd_check_ollama,
            cmd_pull_ollama_model,
            cmd_generate_notulen,
            cmd_generate_notulen_gemini,
            cmd_generate_notulen_cloudflare,
            cmd_transcribe_cloudflare_whisper,
        ])
        .run(tauri::generate_context!())
        .expect("Galat saat menjalankan aplikasi ruma. desktop");
}
