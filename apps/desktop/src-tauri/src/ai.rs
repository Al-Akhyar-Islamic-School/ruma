use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::Write;
use std::path::{Path, PathBuf};

#[derive(Debug, Serialize, Deserialize)]
pub struct OllamaModelItem {
    pub name: String,
    pub size: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct OllamaTagsResponse {
    models: Vec<OllamaModelTag>,
}

#[derive(Debug, Deserialize)]
struct OllamaModelTag {
    name: String,
    size: Option<u64>,
}

#[allow(dead_code)]
#[derive(Debug, Serialize)]
struct ChatRequest<'a> {
    model: &'a str,
    messages: Vec<ChatMessage<'a>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    stream: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    response_format: Option<ResponseFormat<'a>>,
}

#[allow(dead_code)]
#[derive(Debug, Serialize)]
struct ResponseFormat<'a> {
    #[serde(rename = "type")]
    format_type: &'a str,
}

#[derive(Debug, Serialize)]
struct ChatMessage<'a> {
    role: &'a str,
    content: &'a str,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct OpenAiChatResponse {
    choices: Vec<OpenAiChoice>,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct OpenAiChoice {
    message: ChatResponseMessage,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct ChatResponseMessage {
    content: String,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct CloudflareAiResponse {
    result: Option<CloudflareResult>,
    success: bool,
    errors: Option<Vec<serde_json::Value>>,
}

#[derive(Debug, Deserialize)]
struct CloudflareResult {
    response: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NotulenLokalResult {
    pub ringkasan: String,
    pub agenda: Vec<String>,
    pub keputusan: Vec<String>,
    pub tindak_lanjut: Vec<TindakLanjutItem>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TindakLanjutItem {
    pub tugas: String,
    pub pic: Option<String>,
    pub tenggat: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WhisperModelInfo {
    pub id: String,
    pub nama: String,
    pub ukuran_label: String,
    pub perkiraan_mb: u64,
    pub terunduh: bool,
    pub file_path: Option<String>,
}

pub struct ModelDef {
    pub id: &'static str,
    pub nama: &'static str,
    pub filename: &'static str,
    pub url: &'static str,
    pub perkiraan_mb: u64,
    pub label: &'static str,
}

pub const DAFTAR_WHISPER: &[ModelDef] = &[
    ModelDef {
        id: "large-v3-turbo",
        nama: "Whisper Large v3 Turbo (Rekomendasi)",
        filename: "ggml-large-v3-turbo.bin",
        url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin",
        perkiraan_mb: 1600,
        label: "~1.6 GB (Akurat & Cepat)",
    },
    ModelDef {
        id: "medium",
        nama: "Whisper Medium",
        filename: "ggml-medium.bin",
        url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin",
        perkiraan_mb: 1500,
        label: "~1.5 GB",
    },
    ModelDef {
        id: "small",
        nama: "Whisper Small (Laptop Ringan)",
        filename: "ggml-small.bin",
        url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin",
        perkiraan_mb: 460,
        label: "~460 MB",
    },
    ModelDef {
        id: "base",
        nama: "Whisper Base (Uji Coba Cepat)",
        filename: "ggml-base.bin",
        url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin",
        perkiraan_mb: 140,
        label: "~140 MB",
    },
];

const PROMPT_NOTULEN: &str = "Anda adalah asisten notulis resmi Sekolah Islam Al Akhyar (ruma.). \
Tugas Anda adalah membaca transkrip rapat dan menghasilkan notulen rapat dalam format JSON yang valid. \
Format JSON yang WAJIB dihasilkan: \
{\n  \"ringkasan\": \"Paragraf ringkasan eksekutif poin penting rapat\",\n  \"agenda\": [\"Poin agenda 1\", \"Poin agenda 2\"],\n  \"keputusan\": [\"Keputusan yang disepakati 1\", \"Keputusan 2\"],\n  \"tindak_lanjut\": [{\"tugas\": \"Deskripsi tugas\", \"pic\": \"Nama penanggung jawab\", \"tenggat\": \"Waktu tenggat jika ada\"}]\n}";

pub fn get_whisper_models_status(models_dir: &Path) -> Vec<WhisperModelInfo> {
    std::fs::create_dir_all(models_dir).ok();

    DAFTAR_WHISPER
        .iter()
        .map(|def| {
            let p = models_dir.join(def.filename);
            let exists = p.exists();
            WhisperModelInfo {
                id: def.id.to_string(),
                nama: def.nama.to_string(),
                ukuran_label: def.label.to_string(),
                perkiraan_mb: def.perkiraan_mb,
                terunduh: exists,
                file_path: if exists {
                    Some(p.to_string_lossy().to_string())
                } else {
                    None
                },
            }
        })
        .collect()
}

pub async fn download_whisper_file(models_dir: &Path, model_id: &str) -> Result<PathBuf, String> {
    let def = DAFTAR_WHISPER
        .iter()
        .find(|d| d.id == model_id)
        .ok_or_else(|| format!("Model Whisper '{}' tidak ditemukan.", model_id))?;

    std::fs::create_dir_all(models_dir)
        .map_err(|e| format!("Gagal membuat folder model: {}", e))?;

    let dest = models_dir.join(def.filename);
    if dest.exists() {
        return Ok(dest);
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(600))
        .build()
        .map_err(|e| e.to_string())?;

    let mut res = client
        .get(def.url)
        .send()
        .await
        .map_err(|e| format!("Gagal mengunduh model dari HuggingFace: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("Gagal unduh, server mengembalikan status {}", res.status()));
    }

    let temp_dest = models_dir.join(format!("{}.tmp", def.filename));
    let mut file = File::create(&temp_dest)
        .map_err(|e| format!("Gagal membuat berkas sementara {:?}: {}", temp_dest, e))?;

    while let Some(chunk) = res
        .chunk()
        .await
        .map_err(|e| format!("Koneksi terputus saat mengunduh: {}", e))?
    {
        file.write_all(&chunk)
            .map_err(|e| format!("Gagal menulis data ke hardisk: {}", e))?;
    }

    file.flush()
        .map_err(|e| format!("Gagal memflush berkas: {}", e))?;
    std::fs::rename(&temp_dest, &dest)
        .map_err(|e| format!("Gagal memindahkan berkas model: {}", e))?;

    Ok(dest)
}

pub async fn pull_ollama_model(base_url: &str, model_name: &str) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(600))
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!("{}/api/pull", base_url.trim_end_matches('/'));
    let payload = serde_json::json!({
        "name": model_name,
        "stream": false
    });

    let res = client
        .post(&url)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Gagal menghubungi Ollama di {}: {}", url, e))?;

    if !res.status().is_success() {
        return Err(format!("Ollama pull error: status {}", res.status()));
    }

    Ok(format!("Model {} berhasil diunduh ke Ollama.", model_name))
}

pub async fn check_ollama_service(base_url: &str) -> Result<Vec<OllamaModelItem>, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(4))
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!("{}/api/tags", base_url.trim_end_matches('/'));
    let res = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Ollama tidak terjangkau di {}: {}", url, e))?;

    if !res.status().is_success() {
        return Err(format!("Ollama mengembalikan status {}", res.status()));
    }

    let body: OllamaTagsResponse = res
        .json()
        .await
        .map_err(|e| format!("Gagal mem-parse respon model Ollama: {}", e))?;

    let models = body
        .models
        .into_iter()
        .map(|m| OllamaModelItem {
            name: m.name,
            size: m.size,
        })
        .collect();

    Ok(models)
}

pub async fn generate_notulen_ollama(
    base_url: &str,
    model: &str,
    transcript: &str,
    title: &str,
) -> Result<NotulenLokalResult, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(180))
        .build()
        .map_err(|e| e.to_string())?;

    let user_prompt = format!(
        "Judul Rapat: {}\n\nTranskrip Rapat:\n{}\n\nBuat notulen resmi Al Akhyar dalam JSON persis sesuai format.",
        title, transcript
    );

    let messages = vec![
        ChatMessage {
            role: "system",
            content: PROMPT_NOTULEN,
        },
        ChatMessage {
            role: "user",
            content: &user_prompt,
        },
    ];

    let req_body = serde_json::json!({
        "model": model,
        "messages": messages,
        "stream": false,
        "format": "json"
    });

    let url = format!("{}/api/chat", base_url.trim_end_matches('/'));
    let res = client
        .post(&url)
        .json(&req_body)
        .send()
        .await
        .map_err(|e| format!("Gagal mengirim permintaan ke Ollama: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("Ollama error status {}", res.status()));
    }

    let resp_data: serde_json::Value = res
        .json()
        .await
        .map_err(|e| format!("Gagal membaca respon chat Ollama: {}", e))?;

    let content_str = resp_data["message"]["content"]
        .as_str()
        .ok_or_else(|| "Respon Ollama tidak memiliki message.content".to_string())?;

    let parsed: NotulenLokalResult = serde_json::from_str(content_str)
        .map_err(|e| format!("Gagal mengurai JSON notulen dari model: {}", e))?;

    Ok(parsed)
}

pub async fn generate_notulen_gemini(
    base_url: Option<&str>,
    api_key: &str,
    model: &str,
    transcript: &str,
    title: &str,
) -> Result<NotulenLokalResult, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(90))
        .build()
        .map_err(|e| e.to_string())?;

    let user_prompt = format!(
        "Judul Rapat: {}\n\nTranskrip Rapat:\n{}\n\nBuat notulen resmi Al Akhyar dalam JSON persis sesuai format.",
        title, transcript
    );

    let messages = vec![
        ChatMessage {
            role: "system",
            content: PROMPT_NOTULEN,
        },
        ChatMessage {
            role: "user",
            content: &user_prompt,
        },
    ];

    let chosen_model = if model.trim().is_empty() {
        "gemini-2.5-flash"
    } else {
        model.trim()
    };

    let req_body = serde_json::json!({
        "model": chosen_model,
        "messages": messages,
        "stream": false,
        "response_format": { "type": "json_object" }
    });

    let raw_url = base_url.unwrap_or("").trim();
    let url = if raw_url.is_empty() {
        "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions".to_string()
    } else if raw_url.ends_with("/chat/completions") {
        raw_url.to_string()
    } else {
        format!("{}/chat/completions", raw_url.trim_end_matches('/'))
    };

    let mut req = client.post(&url).json(&req_body);
    if !api_key.trim().is_empty() {
        req = req.header("Authorization", format!("Bearer {}", api_key.trim()));
    }

    let res = req
        .send()
        .await
        .map_err(|e| format!("Gagal menghubungi Gemini gateway ({}): {}", url, e))?;

    if !res.status().is_success() {
        let err_txt = res.text().await.unwrap_or_default();
        return Err(format!("Gemini gateway error: {}", err_txt));
    }

    let resp_data: serde_json::Value = res
        .json()
        .await
        .map_err(|e| format!("Gagal mem-parse respon JSON dari gateway: {}", e))?;

    let content = resp_data["choices"][0]["message"]["content"]
        .as_str()
        .ok_or_else(|| "Gateway tidak mengembalikan choices[0].message.content".to_string())?;

    let clean_json = if let Some(start) = content.find('{') {
        if let Some(end) = content.rfind('}') {
            &content[start..=end]
        } else {
            content
        }
    } else {
        content
    };

    let parsed: NotulenLokalResult = serde_json::from_str(clean_json)
        .map_err(|e| format!("Gagal mengurai format notulen dari model: {}", e))?;

    Ok(parsed)
}

pub async fn generate_notulen_cloudflare(
    account_id: &str,
    api_token: &str,
    model: &str,
    transcript: &str,
    title: &str,
) -> Result<NotulenLokalResult, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(90))
        .build()
        .map_err(|e| e.to_string())?;

    let chosen_model = if model.trim().is_empty() {
        "@cf/qwen/qwen2.5-7b-instruct"
    } else {
        model.trim()
    };

    let user_prompt = format!(
        "Judul Rapat: {}\n\nTranskrip Rapat:\n{}\n\nBuat notulen resmi Al Akhyar dalam JSON persis sesuai format.",
        title, transcript
    );

    let messages = vec![
        ChatMessage {
            role: "system",
            content: PROMPT_NOTULEN,
        },
        ChatMessage {
            role: "user",
            content: &user_prompt,
        },
    ];

    let req_body = serde_json::json!({
        "messages": messages
    });

    let url = format!(
        "https://api.cloudflare.com/client/v4/accounts/{}/ai/run/{}",
        account_id.trim(),
        chosen_model
    );

    let res = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_token.trim()))
        .json(&req_body)
        .send()
        .await
        .map_err(|e| format!("Gagal menghubungi Cloudflare Workers AI: {}", e))?;

    if !res.status().is_success() {
        let err_txt = res.text().await.unwrap_or_default();
        return Err(format!("Cloudflare AI error: {}", err_txt));
    }

    let resp_data: CloudflareAiResponse = res
        .json()
        .await
        .map_err(|e| format!("Gagal mem-parse respon Cloudflare: {}", e))?;

    let raw_text = resp_data
        .result
        .and_then(|r| r.response)
        .ok_or_else(|| "Cloudflare AI tidak mengembalikan teks jawaban.".to_string())?;

    // Cari blok JSON di dalam teks jika model memberikan markdown ```json ... ```
    let clean_json = if let Some(start) = raw_text.find('{') {
        if let Some(end) = raw_text.rfind('}') {
            &raw_text[start..=end]
        } else {
            &raw_text
        }
    } else {
        &raw_text
    };

    let parsed: NotulenLokalResult = serde_json::from_str(clean_json)
        .map_err(|e| format!("Gagal mengurai format notulen dari Cloudflare AI: {}", e))?;

    Ok(parsed)
}

pub async fn transcribe_cloudflare_whisper(
    account_id: &str,
    api_token: &str,
    model: Option<&str>,
    wav_path: &str,
) -> Result<String, String> {
    use base64::Engine;
    let bytes = std::fs::read(wav_path)
        .map_err(|e| format!("Gagal membaca berkas WAV di {}: {}", wav_path, e))?;

    let base64_audio = base64::engine::general_purpose::STANDARD.encode(&bytes);

    let chosen_model = model.unwrap_or("@cf/openai/whisper-large-v3-turbo");
    let url = format!(
        "https://api.cloudflare.com/client/v4/accounts/{}/ai/run/{}",
        account_id.trim(),
        chosen_model
    );

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| e.to_string())?;

    let payload = serde_json::json!({
        "audio": base64_audio,
        "task": "transcribe",
        "language": "id",
        "vad_filter": true
    });

    let res = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_token.trim()))
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Gagal menghubungi Cloudflare Whisper: {}", e))?;

    if !res.status().is_success() {
        let err_txt = res.text().await.unwrap_or_default();
        return Err(format!("Cloudflare Whisper error: {}", err_txt));
    }

    let resp_data: serde_json::Value = res
        .json()
        .await
        .map_err(|e| format!("Gagal mem-parse respon Cloudflare Whisper: {}", e))?;

    let text = resp_data["result"]["text"]
        .as_str()
        .ok_or_else(|| "Cloudflare tidak mengembalikan teks transkrip audio.".to_string())?;

    Ok(text.to_string())
}
