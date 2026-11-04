import { invoke } from "@tauri-apps/api/core";

export type AudioDeviceItem = {
  name: string;
  is_default: boolean;
};

export type OllamaModelItem = {
  name: string;
  size?: number;
};

export type WhisperModelInfo = {
  id: string;
  nama: string;
  ukuran_label: string;
  perkiraan_mb: number;
  terunduh: boolean;
  file_path?: string;
};

export type TindakLanjutItem = {
  tugas: string;
  pic?: string;
  tenggat?: string;
};

export type NotulenLokalResult = {
  ringkasan: string;
  agenda: string[];
  keputusan: string[];
  tindak_lanjut: TindakLanjutItem[];
};

export async function listAudioDevices(): Promise<AudioDeviceItem[]> {
  try {
    return await invoke<AudioDeviceItem[]>("cmd_list_devices");
  } catch (err) {
    console.error("Gagal memindai perangkat audio:", err);
    return [];
  }
}

export async function getDefaultSaveDir(): Promise<string> {
  return await invoke<string>("cmd_get_default_save_dir");
}

export async function detectGoogleDriveFolder(): Promise<string | null> {
  return await invoke<string | null>("cmd_detect_google_drive_folder");
}

export async function saveNotulenFile(params: {
  destDir: string;
  title: string;
  contentMd: string;
}): Promise<string> {
  return await invoke<string>("cmd_save_notulen_file", {
    destDir: params.destDir,
    title: params.title,
    contentMd: params.contentMd,
  });
}

export async function startRecording(params?: {
  deviceName?: string;
  customDir?: string;
  title?: string;
}): Promise<string> {
  return await invoke<string>("cmd_start_recording", {
    deviceName: params?.deviceName || null,
    customDir: params?.customDir || null,
    title: params?.title || null,
  });
}

export async function stopRecording(): Promise<string> {
  return await invoke<string>("cmd_stop_recording");
}

export async function getAudioLevel(): Promise<number> {
  return await invoke<number>("cmd_get_audio_level");
}

export async function listWhisperModels(): Promise<WhisperModelInfo[]> {
  return await invoke<WhisperModelInfo[]>("cmd_list_whisper_models");
}

export async function downloadWhisperModel(modelId: string): Promise<string> {
  return await invoke<string>("cmd_download_whisper_model", { modelId });
}

export async function checkOllama(baseUrl?: string): Promise<OllamaModelItem[]> {
  return await invoke<OllamaModelItem[]>("cmd_check_ollama", {
    baseUrl: baseUrl || null,
  });
}

export async function pullOllamaModel(modelName: string, baseUrl?: string): Promise<string> {
  return await invoke<string>("cmd_pull_ollama_model", {
    modelName,
    baseUrl: baseUrl || null,
  });
}

export async function generateNotulen(params: {
  model: string;
  transcript: string;
  title: string;
  baseUrl?: string;
}): Promise<NotulenLokalResult> {
  return await invoke<NotulenLokalResult>("cmd_generate_notulen", {
    baseUrl: params.baseUrl || null,
    model: params.model,
    transcript: params.transcript,
    title: params.title,
  });
}

export async function generateNotulenGemini(params: {
  baseUrl?: string;
  apiKey: string;
  model?: string;
  transcript: string;
  title: string;
}): Promise<NotulenLokalResult> {
  return await invoke<NotulenLokalResult>("cmd_generate_notulen_gemini", {
    baseUrl: params.baseUrl || null,
    apiKey: params.apiKey,
    model: params.model || "gemini-2.5-flash",
    transcript: params.transcript,
    title: params.title,
  });
}

export async function generateNotulenCloudflare(params: {
  accountId: string;
  apiToken: string;
  model?: string;
  transcript: string;
  title: string;
}): Promise<NotulenLokalResult> {
  return await invoke<NotulenLokalResult>("cmd_generate_notulen_cloudflare", {
    accountId: params.accountId,
    apiToken: params.apiToken,
    model: params.model || "@cf/qwen/qwen2.5-7b-instruct",
    transcript: params.transcript,
    title: params.title,
  });
}

export async function transcribeCloudflareWhisper(params: {
  accountId: string;
  apiToken: string;
  model?: string;
  wavPath: string;
}): Promise<string> {
  return await invoke<string>("cmd_transcribe_cloudflare_whisper", {
    accountId: params.accountId,
    apiToken: params.apiToken,
    model: params.model || null,
    wavPath: params.wavPath,
  });
}
