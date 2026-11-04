import { useEffect, useState } from "react";
import {
  Sparkles,
  RefreshCw,
  CheckCircle2,
  Copy,
  Check,
  Download,
  Cpu,
  FileAudio,
  Cloud,
  Key,
  Mic,
  ExternalLink,
  FolderOpen,
  Save,
} from "lucide-react";
import {
  checkOllama,
  pullOllamaModel,
  listWhisperModels,
  downloadWhisperModel,
  generateNotulen,
  generateNotulenGemini,
  generateNotulenCloudflare,
  transcribeCloudflareWhisper,
  pickAudioFile,
  getDefaultSaveDir,
  saveNotulenFile,
  type OllamaModelItem,
  type WhisperModelInfo,
  type NotulenLokalResult,
} from "../lib/tauri";

type AiMode = "cloud" | "lokal";
type CloudProvider = "gemini" | "cloudflare";

export function AiView({
  berkasInfo,
  modeAwal = "cloud",
}: {
  berkasInfo: { judul: string; path: string } | null;
  modeAwal?: "cloud" | "lokal";
}) {
  const [aiMode, setAiMode] = useState<AiMode>(modeAwal);
  useEffect(() => {
    setAiMode(modeAwal);
  }, [modeAwal]);

  const [cloudProvider, setCloudProvider] = useState<CloudProvider>("gemini");

  // Gemini / OpenAI-Compatible Gateway Credentials
  const [geminiBaseUrl, setGeminiBaseUrl] = useState(() => localStorage.getItem("ruma_gemini_base_url") || "");
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem("ruma_gemini_key") || "");
  const [geminiModel, setGeminiModel] = useState(() => localStorage.getItem("ruma_gemini_model") || "gemini-2.5-flash");

  // Cloudflare Workers AI Credentials
  const [cfAccountId, setCfAccountId] = useState(() => localStorage.getItem("ruma_cf_account_id") || "");
  const [cfApiToken, setCfApiToken] = useState(() => localStorage.getItem("ruma_cf_api_token") || "");
  const [cfModelText, setCfModelText] = useState("@cf/qwen/qwen2.5-7b-instruct");

  // Local AI State
  const [ollamaUrl] = useState("http://localhost:11434");
  const [modelsOllama, setModelsOllama] = useState<OllamaModelItem[]>([]);
  const [modelLokalDipilih, setModelLokalDipilih] = useState("");
  const [statusOllama, setStatusOllama] = useState<"ok" | "gagal" | "memeriksa">("memeriksa");

  const [modelsWhisper, setModelsWhisper] = useState<WhisperModelInfo[]>([]);
  const [sedangUnduhWhisper, setSedangUnduhWhisper] = useState<string | null>(null);
  const [sedangPullOllama, setSedangPullOllama] = useState<string | null>(null);

  // Data Rapat & Transkrip
  const [judulRapat, setJudulRapat] = useState(berkasInfo?.judul || "Rapat Koordinasi Al Akhyar");
  const [audioPath, setAudioPath] = useState(berkasInfo?.path || "");
  const [transkrip, setTranskrip] = useState(
    "Kepala Sekolah: Assalamualaikum wr wb, bapak ibu sekalian. Hari ini kita bahas persiapan ujian semester ganjil dan evaluasi program tahfidz pekanan.\n\n" +
      "Wakasek Kurikulum: Untuk jadwal ujian sudah kami susun, dimulai tanggal 15 Desember. Naskah soal mohon dikumpulkan paling lambat 1 Desember ke tim kurikulum.\n\n" +
      "Koordinator Tahfidz: Alhamdulillah target juz 30 untuk kelas 7 sudah tercapai 85%. Namun perlu tambahan jam setoran khusus untuk 12 siswa yang tertinggal.\n\n" +
      "Kepala Sekolah: Baik, kita sepakati ujian dimulai 15 Desember, naskah soal kumpul 1 Desember ke Ust. Budi. Untuk tahfidz, adakan klinik setoran sore setiap Selasa dan Kamis dipandu Ustazah Fatimah."
  );

  const [sedangTranskrip, setSedangTranskrip] = useState(false);
  const [sedangMemproses, setSedangMemproses] = useState(false);
  const [hasilNotulen, setHasilNotulen] = useState<NotulenLokalResult | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [suksesMsg, setSuksesMsg] = useState<string | null>(null);
  const [tersalin, setTersalin] = useState(false);

  useEffect(() => {
    if (berkasInfo) {
      setJudulRapat(berkasInfo.judul);
      setAudioPath(berkasInfo.path);
    }
  }, [berkasInfo]);

  // Simpan pengaturan otomatis ke localStorage
  const simpanGeminiBaseUrl = (u: string) => {
    setGeminiBaseUrl(u);
    localStorage.setItem("ruma_gemini_base_url", u);
  };

  const simpanGeminiKey = (k: string) => {
    setGeminiKey(k);
    localStorage.setItem("ruma_gemini_key", k);
  };

  const simpanGeminiModel = (m: string) => {
    setGeminiModel(m);
    localStorage.setItem("ruma_gemini_model", m);
  };

  const simpanCfCredentials = (accId: string, token: string) => {
    setCfAccountId(accId);
    setCfApiToken(token);
    localStorage.setItem("ruma_cf_account_id", accId);
    localStorage.setItem("ruma_cf_api_token", token);
  };

  const muatDataLokal = async () => {
    try {
      const wModels = await listWhisperModels();
      setModelsWhisper(wModels);
    } catch (e) {
      console.error(e);
    }

    setStatusOllama("memeriksa");
    try {
      const list = await checkOllama(ollamaUrl);
      setModelsOllama(list);
      if (list.length > 0) {
        setStatusOllama("ok");
        const qwen = list.find((m) => m.name.toLowerCase().includes("qwen"));
        setModelLokalDipilih(qwen ? qwen.name : list[0]!.name);
      } else {
        setStatusOllama("gagal");
      }
    } catch {
      setStatusOllama("gagal");
    }
  };

  useEffect(() => {
    void muatDataLokal();
  }, []);

  const handleUnduhWhisper = async (id: string) => {
    setSedangUnduhWhisper(id);
    setGalat(null);
    try {
      await downloadWhisperModel(id);
      const wModels = await listWhisperModels();
      setModelsWhisper(wModels);
    } catch (err) {
      setGalat(err instanceof Error ? err.message : String(err));
    } finally {
      setSedangUnduhWhisper(null);
    }
  };

  const handlePullOllama = async (modelName: string) => {
    setSedangPullOllama(modelName);
    setGalat(null);
    try {
      await pullOllamaModel(modelName, ollamaUrl);
      await muatDataLokal();
    } catch (err) {
      setGalat(err instanceof Error ? err.message : String(err));
    } finally {
      setSedangPullOllama(null);
    }
  };

  // 1. Transkripsi Audio dengan Cloudflare Whisper
  const handleTranskripCloudflare = async () => {
    if (!cfAccountId || !cfApiToken) {
      setGalat("Masukkan Cloudflare Account ID dan API Token terlebih dahulu.");
      return;
    }
    if (!audioPath) {
      setGalat("Pilih atau rekam berkas audio WAV terlebih dahulu.");
      return;
    }

    setGalat(null);
    setSuksesMsg(null);
    setSedangTranskrip(true);

    try {
      const text = await transcribeCloudflareWhisper({
        accountId: cfAccountId,
        apiToken: cfApiToken,
        wavPath: audioPath,
      });
      setTranskrip(text);
      setSuksesMsg("Audio berhasil ditranskripsikan via Cloudflare Whisper! ✨");
    } catch (err) {
      setGalat(err instanceof Error ? err.message : String(err));
    } finally {
      setSedangTranskrip(false);
    }
  };

  // 2. Pembuatan Notulen (Cloud vs Lokal)
  const handleBuatNotulen = async () => {
    if (!transkrip.trim()) {
      setGalat("Transkrip rapat tidak boleh kosong.");
      return;
    }

    setGalat(null);
    setSuksesMsg(null);
    setSedangMemproses(true);
    setHasilNotulen(null);

    try {
      let res: NotulenLokalResult;
      if (aiMode === "cloud") {
        if (cloudProvider === "gemini") {
          res = await generateNotulenGemini({
            baseUrl: geminiBaseUrl.trim() || undefined,
            apiKey: geminiKey,
            model: geminiModel,
            transcript: transkrip,
            title: judulRapat,
          });
        } else {
          if (!cfAccountId.trim() || !cfApiToken.trim()) {
            throw new Error("Masukkan Cloudflare Account ID & API Token terlebih dahulu.");
          }
          res = await generateNotulenCloudflare({
            accountId: cfAccountId,
            apiToken: cfApiToken,
            model: cfModelText,
            transcript: transkrip,
            title: judulRapat,
          });
        }
      } else {
        if (!modelLokalDipilih) {
          throw new Error("Pilih model Text LLM Ollama terlebih dahulu.");
        }
        res = await generateNotulen({
          baseUrl: ollamaUrl,
          model: modelLokalDipilih,
          transcript: transkrip,
          title: judulRapat,
        });
      }

      setHasilNotulen(res);
      setSuksesMsg("Notulen berhasil disusun oleh AI! 🎉");
    } catch (err) {
      setGalat(err instanceof Error ? err.message : String(err));
    } finally {
      setSedangMemproses(false);
    }
  };

  const buatMarkdown = () => {
    if (!hasilNotulen) return "";
    return `
# Notulen Rapat: ${judulRapat}

## Ringkasan Eksekutif
${hasilNotulen.ringkasan}

## Agenda Pembahasan
${hasilNotulen.agenda.map((a) => `- ${a}`).join("\n")}

## Keputusan Rapat
${hasilNotulen.keputusan.map((k) => `- ${k}`).join("\n")}

## Tindak Lanjut (Action Items)
| Tugas | PIC | Tenggat |
|---|---|---|
${hasilNotulen.tindak_lanjut.map((t) => `| ${t.tugas} | ${t.pic || "-"} | ${t.tenggat || "-"} |`).join("\n")}
    `.trim();
  };

  const salinMarkdown = () => {
    const md = buatMarkdown();
    if (!md) return;
    void navigator.clipboard.writeText(md);
    setTersalin(true);
    setTimeout(() => setTersalin(false), 2000);
  };

  const handleSimpanNotulenKeDrive = async () => {
    if (!hasilNotulen) return;
    const dest = localStorage.getItem("ruma_save_dir") || (await getDefaultSaveDir());
    try {
      const p = await saveNotulenFile({
        destDir: dest,
        title: judulRapat,
        contentMd: buatMarkdown(),
      });
      setSuksesMsg(`Notulen berhasil disimpan: ${p} ✨`);
    } catch (err) {
      setGalat(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div style={{ flex: 1, padding: "24px 28px", display: "flex", flexDirection: "column", gap: "18px", overflowY: "auto" }}>
      {/* Header & Switcher Mode AI */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ fontSize: "20px", fontWeight: "700", color: "#153e35" }}>
            Pusat Notulensi AI (Cloud & Lokal)
          </h2>
          <p style={{ color: "#64748b", fontSize: "13px", marginTop: "2px" }}>
            Pilih antara Cloud AI cepat tanpa unduh model atau AI Lokal 100% offline.
          </p>
        </div>

        <div style={{ display: "flex", background: "#e2e8f0", padding: "4px", borderRadius: "10px", gap: "2px" }}>
          <button
            onClick={() => setAiMode("cloud")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 14px",
              borderRadius: "7px",
              border: "none",
              background: aiMode === "cloud" ? "#153e35" : "transparent",
              color: aiMode === "cloud" ? "#ffffff" : "#475569",
              fontWeight: "700",
              fontSize: "12px",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <Cloud size={14} />
            <span>Cloud AI (Bebas Unduh)</span>
          </button>
          <button
            onClick={() => setAiMode("lokal")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 14px",
              borderRadius: "7px",
              border: "none",
              background: aiMode === "lokal" ? "#153e35" : "transparent",
              color: aiMode === "lokal" ? "#ffffff" : "#475569",
              fontWeight: "700",
              fontSize: "12px",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <Cpu size={14} />
            <span>AI Lokal (100% Offline)</span>
          </button>
        </div>
      </div>

      {galat && (
        <div style={{ padding: "12px 16px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "10px", color: "#991b1b", fontSize: "13px" }}>
          {galat}
        </div>
      )}

      {suksesMsg && (
        <div style={{ padding: "12px 16px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "10px", color: "#166534", fontSize: "13px" }}>
          {suksesMsg}
        </div>
      )}

      {/* PENGATURAN MODE CLOUD AI */}
      {aiMode === "cloud" && (
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #cbd5e1",
            borderRadius: "14px",
            padding: "18px 20px",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Key size={18} color="#153e35" />
              <span style={{ fontSize: "13px", fontWeight: "700", color: "#153e35", textTransform: "uppercase" }}>
                Pengaturan Endpoint & API Key (BYOK)
              </span>
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => setCloudProvider("gemini")}
                style={{
                  padding: "6px 14px",
                  borderRadius: "8px",
                  border: cloudProvider === "gemini" ? "1px solid #153e35" : "1px solid #cbd5e1",
                  background: cloudProvider === "gemini" ? "#f0fdf4" : "#ffffff",
                  color: cloudProvider === "gemini" ? "#153e35" : "#64748b",
                  fontWeight: "700",
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                Gemini / OpenAI Gateway
              </button>
              <button
                onClick={() => setCloudProvider("cloudflare")}
                style={{
                  padding: "6px 14px",
                  borderRadius: "8px",
                  border: cloudProvider === "cloudflare" ? "1px solid #153e35" : "1px solid #cbd5e1",
                  background: cloudProvider === "cloudflare" ? "#f0fdf4" : "#ffffff",
                  color: cloudProvider === "cloudflare" ? "#153e35" : "#64748b",
                  fontWeight: "700",
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                Cloudflare Workers AI
              </button>
            </div>
          </div>

          {cloudProvider === "gemini" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {/* Baris 1: Base URL Gateway */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label style={{ fontSize: "11px", fontWeight: "600", color: "#475569", textTransform: "uppercase" }}>
                    Base URL (OpenAI-Compatible Gateway / Custom Proxy)
                  </label>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>
                    Kosongkan jika menggunakan endpoint resmi default
                  </span>
                </div>
                <input
                  type="url"
                  value={geminiBaseUrl}
                  onChange={(e) => simpanGeminiBaseUrl(e.target.value)}
                  placeholder="https://my-gateway-proxy.com/v1 (atau kosongkan untuk default)"
                  style={{ height: "42px", padding: "10px 14px", borderRadius: "10px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                />
              </div>

              {/* Baris 2: API Key dan Model */}
              <div style={{ display: "flex", gap: "16px", alignItems: "flex-end" }}>
                <div style={{ flex: 2, display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <label style={{ fontSize: "11px", fontWeight: "600", color: "#475569", textTransform: "uppercase" }}>
                      API Key (Bearer Token)
                    </label>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: "11px", color: "#153e35", textDecoration: "none", display: "flex", alignItems: "center", gap: "2px" }}
                    >
                      <span>Info API Key</span>
                      <ExternalLink size={10} />
                    </a>
                  </div>
                  <input
                    type="password"
                    value={geminiKey}
                    onChange={(e) => simpanGeminiKey(e.target.value)}
                    placeholder="Ketikkan API Key / Token Anda..."
                    style={{ height: "42px", padding: "10px 14px", borderRadius: "10px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                  />
                </div>

                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "11px", fontWeight: "600", color: "#475569", textTransform: "uppercase" }}>
                    Nama Model (Ketik Manual / Preset)
                  </label>
                  <input
                    type="text"
                    list="preset-gemini-models"
                    value={geminiModel}
                    onChange={(e) => simpanGeminiModel(e.target.value)}
                    placeholder="gemini-2.5-flash"
                    style={{ height: "42px", padding: "10px 14px", borderRadius: "10px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                  />
                  <datalist id="preset-gemini-models">
                    <option value="gemini-2.5-flash" />
                    <option value="gemini-1.5-flash" />
                    <option value="gemini-1.5-pro" />
                    <option value="gpt-4o-mini" />
                    <option value="gpt-4o" />
                  </datalist>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", gap: "16px", alignItems: "flex-end" }}>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "11px", fontWeight: "600", color: "#475569", textTransform: "uppercase" }}>
                  Cloudflare Account ID
                </label>
                <input
                  type="text"
                  value={cfAccountId}
                  onChange={(e) => simpanCfCredentials(e.target.value, cfApiToken)}
                  placeholder="Contoh: a89b1c2..."
                  style={{ height: "42px", padding: "10px 14px", borderRadius: "10px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                />
              </div>

              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "11px", fontWeight: "600", color: "#475569", textTransform: "uppercase" }}>
                  Cloudflare API Token
                </label>
                <input
                  type="password"
                  value={cfApiToken}
                  onChange={(e) => simpanCfCredentials(cfAccountId, e.target.value)}
                  placeholder="Bearer Token Cloudflare..."
                  style={{ height: "42px", padding: "10px 14px", borderRadius: "10px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                />
              </div>

              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "11px", fontWeight: "600", color: "#475569", textTransform: "uppercase" }}>
                  Model Notulensi (Ketik Manual / Preset)
                </label>
                <input
                  type="text"
                  list="preset-cf-models"
                  value={cfModelText}
                  onChange={(e) => setCfModelText(e.target.value)}
                  placeholder="@cf/qwen/qwen2.5-7b-instruct"
                  style={{ height: "42px", padding: "10px 14px", borderRadius: "10px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                />
                <datalist id="preset-cf-models">
                  <option value="@cf/qwen/qwen2.5-7b-instruct" />
                  <option value="@cf/meta/llama-3.1-8b-instruct" />
                  <option value="@cf/deepseek-ai/deepseek-r1-distill-qwen-32b" />
                </datalist>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PENGATURAN MODE LOKAL (MODEL MANAGER) */}
      {aiMode === "lokal" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "14px", padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <FileAudio size={18} color="#153e35" />
              <span style={{ fontSize: "13px", fontWeight: "700", color: "#153e35", textTransform: "uppercase" }}>
                1. Model Whisper Lokal (Audio ➔ Teks)
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {modelsWhisper.map((m) => (
                <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: "8px", background: m.terunduh ? "#f0fdf4" : "#f8fafc", border: m.terunduh ? "1px solid #bbf7d0" : "1px solid #cbd5e1" }}>
                  <div>
                    <div style={{ fontSize: "12px", fontWeight: "600", color: m.terunduh ? "#166534" : "#1e293b" }}>{m.nama}</div>
                    <div style={{ fontSize: "11px", color: "#64748b" }}>{m.ukuran_label}</div>
                  </div>
                  {m.terunduh ? (
                    <span style={{ fontSize: "11px", color: "#166534", fontWeight: "600", display: "flex", alignItems: "center", gap: "4px" }}>
                      <CheckCircle2 size={14} /> Siap Pakai
                    </span>
                  ) : (
                    <button
                      onClick={() => void handleUnduhWhisper(m.id)}
                      disabled={sedangUnduhWhisper !== null}
                      style={{ padding: "6px 12px", borderRadius: "6px", background: "#153e35", color: "#ffffff", border: "none", fontSize: "11px", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                    >
                      <Download size={12} />
                      <span>{sedangUnduhWhisper === m.id ? "Mengunduh..." : "Unduh"}</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "14px", padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Cpu size={18} color="#153e35" />
                <span style={{ fontSize: "13px", fontWeight: "700", color: "#153e35", textTransform: "uppercase" }}>
                  2. Model Ollama Lokal (Notulensi)
                </span>
              </div>
              <button
                onClick={() => void muatDataLokal()}
                style={{ background: "transparent", border: "none", color: "#153e35", fontSize: "11px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
              >
                <RefreshCw size={11} /> Refresh
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {[
                { id: "qwen2.5:7b", nama: "Qwen 2.5 7B (Rekomendasi)", ukuran: "~4.7 GB" },
                { id: "qwen2.5:3b", nama: "Qwen 2.5 3B (Laptop Ringan)", ukuran: "~2.0 GB" },
                { id: "llama3.1:8b", nama: "Llama 3.1 8B", ukuran: "~4.9 GB" },
              ].map((def) => {
                const ada = modelsOllama.some((m) => m.name.startsWith(def.id));
                return (
                  <div key={def.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: "8px", background: ada ? "#f0fdf4" : "#f8fafc", border: ada ? "1px solid #bbf7d0" : "1px solid #cbd5e1" }}>
                    <div>
                      <div style={{ fontSize: "12px", fontWeight: "600", color: ada ? "#166534" : "#1e293b" }}>{def.nama}</div>
                      <div style={{ fontSize: "11px", color: "#64748b" }}>{def.ukuran}</div>
                    </div>
                    {ada ? (
                      <span style={{ fontSize: "11px", color: "#166534", fontWeight: "600", display: "flex", alignItems: "center", gap: "4px" }}>
                        <CheckCircle2 size={14} /> Terpasang
                      </span>
                    ) : (
                      <button
                        onClick={() => void handlePullOllama(def.id)}
                        disabled={sedangPullOllama !== null || statusOllama !== "ok"}
                        style={{ padding: "6px 12px", borderRadius: "6px", background: "#153e35", color: "#ffffff", border: "none", fontSize: "11px", fontWeight: "600", cursor: statusOllama === "ok" ? "pointer" : "not-allowed", display: "flex", alignItems: "center", gap: "4px" }}
                      >
                        <Download size={12} />
                        <span>{sedangPullOllama === def.id ? "Menarik..." : "Unduh"}</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Bagian Transkrip & Eksekusi */}
      <div style={{ display: "flex", gap: "20px" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Kolom Berkas Audio & Transkrip Cepat */}
          <div style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
            <div style={{ flex: 2, display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "11px", fontWeight: "600", color: "#475569", textTransform: "uppercase" }}>
                Berkas Rekaman Audio WAV
              </label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  type="text"
                  value={audioPath}
                  onChange={(e) => setAudioPath(e.target.value)}
                  placeholder="Path file WAV di hardisk..."
                  style={{ flex: 1, height: "42px", padding: "10px 14px", borderRadius: "10px", border: "1px solid #cbd5e1", fontSize: "12px", fontFamily: "monospace" }}
                />
                <button
                  type="button"
                  onClick={async () => {
                    const f = await pickAudioFile();
                    if (f) setAudioPath(f);
                  }}
                  style={{
                    height: "42px",
                    padding: "0 16px",
                    borderRadius: "10px",
                    background: "#f1f5f9",
                    color: "#1e293b",
                    border: "1px solid #cbd5e1",
                    fontWeight: "600",
                    fontSize: "12px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    whiteSpace: "nowrap",
                  }}
                >
                  <FolderOpen size={15} />
                  <span>Browse...</span>
                </button>
              </div>
            </div>
            {cfAccountId && cfApiToken && (
              <button
                onClick={() => void handleTranskripCloudflare()}
                disabled={sedangTranskrip || !audioPath}
                style={{
                  padding: "0 18px",
                  borderRadius: "10px",
                  background: "#153e35",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: "600",
                  fontSize: "12px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  height: "42px",
                }}
              >
                <Mic size={15} />
                <span>{sedangTranskrip ? "Mentranskripsi..." : "Transkrip Cloud Whisper"}</span>
              </button>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "11px", fontWeight: "600", color: "#475569", textTransform: "uppercase" }}>
              Teks Transkrip Rapat
            </label>
            <textarea
              rows={8}
              value={transkrip}
              onChange={(e) => setTranskrip(e.target.value)}
              placeholder="Tempel transkrip atau klik tombol Transkrip di atas..."
              style={{
                padding: "12px 14px",
                borderRadius: "10px",
                border: "1px solid #cbd5e1",
                fontSize: "13px",
                lineHeight: "1.6",
                resize: "vertical",
              }}
            />
          </div>

          <button
            onClick={() => void handleBuatNotulen()}
            disabled={sedangMemproses}
            style={{
              height: "46px",
              padding: "0 24px",
              borderRadius: "10px",
              background: "#153e35",
              color: "#ffffff",
              border: "none",
              fontWeight: "700",
              fontSize: "14px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            <Sparkles size={16} />
            <span>
              {sedangMemproses
                ? "Sedang Menganalisis & Menyusun Notulen..."
                : aiMode === "cloud"
                ? `Buat Notulen dengan ${cloudProvider === "gemini" ? "Gemini / Gateway" : "Cloudflare AI"}`
                : "Buat Notulen dengan Model Lokal (Ollama)"}
            </span>
          </button>
        </div>

        {/* Panel Hasil Notulen */}
        <div
          style={{
            flex: 1,
            background: "#ffffff",
            border: "1px solid #cbd5e1",
            borderRadius: "14px",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
            maxHeight: "520px",
            overflowY: "auto",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "13px", fontWeight: "700", color: "#153e35", textTransform: "uppercase" }}>
              Hasil Notulen Resmi Al Akhyar
            </span>
            {hasilNotulen && (
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={handleSimpanNotulenKeDrive}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "6px 12px",
                    borderRadius: "6px",
                    border: "1px solid #86efac",
                    background: "#f0fdf4",
                    fontSize: "12px",
                    cursor: "pointer",
                    fontWeight: "600",
                    color: "#166534",
                  }}
                >
                  <Save size={14} />
                  <span>Simpan ke Drive</span>
                </button>
                <button
                  onClick={salinMarkdown}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "6px 12px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    background: "#f8fafc",
                    fontSize: "12px",
                    cursor: "pointer",
                    fontWeight: "600",
                  }}
                >
                  {tersalin ? <Check size={14} color="#166534" /> : <Copy size={14} />}
                  <span>{tersalin ? "Tersalin" : "Salin MD"}</span>
                </button>
              </div>
            )}
          </div>

          {!hasilNotulen ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: "13px", textAlign: "center", padding: "40px" }}>
              Klik tombol "Buat Notulen" untuk menganalisis transkrip dengan AI pilihan Anda.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", fontSize: "13px" }}>
              <div>
                <strong style={{ color: "#153e35" }}>Ringkasan Eksekutif:</strong>
                <p style={{ marginTop: "4px", color: "#334155", lineHeight: "1.5" }}>{hasilNotulen.ringkasan}</p>
              </div>

              <div>
                <strong style={{ color: "#153e35" }}>Agenda Pembahasan:</strong>
                <ul style={{ paddingLeft: "20px", marginTop: "4px", color: "#334155" }}>
                  {hasilNotulen.agenda.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>

              <div>
                <strong style={{ color: "#153e35" }}>Keputusan yang Disepakati:</strong>
                <ul style={{ paddingLeft: "20px", marginTop: "4px", color: "#334155" }}>
                  {hasilNotulen.keputusan.map((k, i) => (
                    <li key={i}>{k}</li>
                  ))}
                </ul>
              </div>

              <div>
                <strong style={{ color: "#153e35" }}>Matriks Tindak Lanjut (Action Items):</strong>
                <div style={{ marginTop: "6px", border: "1px solid #cbd5e1", borderRadius: "8px", overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                        <th style={{ padding: "8px 12px", borderBottom: "1px solid #cbd5e1" }}>Tugas</th>
                        <th style={{ padding: "8px 12px", borderBottom: "1px solid #cbd5e1" }}>PIC</th>
                        <th style={{ padding: "8px 12px", borderBottom: "1px solid #cbd5e1" }}>Tenggat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hasilNotulen.tindak_lanjut.map((t, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "8px 12px" }}>{t.tugas}</td>
                          <td style={{ padding: "8px 12px", color: "#166534", fontWeight: "600" }}>{t.pic || "-"}</td>
                          <td style={{ padding: "8px 12px", color: "#dc2626" }}>{t.tenggat || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
