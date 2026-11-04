import { useEffect, useState, useRef } from "react";
import { Mic, Square, RefreshCw, FolderCheck, AlertCircle, Folder, FolderOpen, Cloud } from "lucide-react";
import {
  listAudioDevices,
  getDefaultSaveDir,
  pickFolder,
  detectGoogleDriveFolder,
  startRecording,
  stopRecording,
  getAudioLevel,
  type AudioDeviceItem,
} from "../lib/tauri";

export function RecordingView({
  onSelesaiRekam,
  onBukaCloudAi,
}: {
  onSelesaiRekam: (info: { judul: string; path: string }) => void;
  onBukaCloudAi?: () => void;
}) {
  const [perangkat, setPerangkat] = useState<AudioDeviceItem[]>([]);
  const [perangkatDipilih, setPerangkatDipilih] = useState<string>("");
  const [judulRapat, setJudulRapat] = useState("Rapat Koordinasi Al Akhyar");
  const [folderSimpan, setFolderSimpan] = useState<string>("");
  const [sedangMerekam, setSedangMerekam] = useState(false);
  const [detik, setDetik] = useState(0);
  const [levelAudio, setLevelAudio] = useState(0);
  const [berkasTersimpan, setBerkasTersimpan] = useState<string | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [memproses, setMemproses] = useState(false);

  const timerRef = useRef<number | null>(null);
  const meterRef = useRef<number | null>(null);

  const [gdrivePath, setGdrivePath] = useState<string | null>(null);

  const muatDataAwal = async () => {
    try {
      const [items, defDir, gdrive] = await Promise.all([
        listAudioDevices(),
        getDefaultSaveDir(),
        detectGoogleDriveFolder(),
      ]);
      setPerangkat(items);
      setGdrivePath(gdrive);

      const savedDir = localStorage.getItem("ruma_save_dir");
      setFolderSimpan(savedDir || defDir);

      const savedDevice = localStorage.getItem("ruma_audio_device");
      const def =
        items.find((p: AudioDeviceItem) => p.name === savedDevice) ||
        items.find((p: AudioDeviceItem) => p.is_default);
      if (def) {
        setPerangkatDipilih(def.name);
      } else if (items[0]) {
        setPerangkatDipilih(items[0].name);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const gantiFolder = (f: string) => {
    setFolderSimpan(f);
    localStorage.setItem("ruma_save_dir", f);
  };

  const gantiPerangkat = (d: string) => {
    setPerangkatDipilih(d);
    localStorage.setItem("ruma_audio_device", d);
  };

  useEffect(() => {
    void muatDataAwal();
  }, []);

  const formatWaktu = (total: number) => {
    const jam = Math.floor(total / 3600);
    const sisa = total % 3600;
    const mnt = Math.floor(sisa / 60);
    const dtk = sisa % 60;
    if (jam > 0) {
      return `${jam}:${String(mnt).padStart(2, "0")}:${String(dtk).padStart(2, "0")}`;
    }
    return `${String(mnt).padStart(2, "0")}:${String(dtk).padStart(2, "0")}`;
  };

  const handleMulai = async () => {
    setGalat(null);
    setMemproses(true);
    try {
      await startRecording({
        deviceName: perangkatDipilih || undefined,
        customDir: folderSimpan || undefined,
        title: judulRapat,
      });
      setSedangMerekam(true);
      setDetik(0);
      setBerkasTersimpan(null);

      // Jalankan timer
      timerRef.current = window.setInterval(() => {
        setDetik((d) => d + 1);
      }, 1000);

      // Jalankan VU meter
      meterRef.current = window.setInterval(async () => {
        const lvl = await getAudioLevel();
        setLevelAudio(lvl);
      }, 80);
    } catch (err) {
      setGalat(err instanceof Error ? err.message : String(err));
    } finally {
      setMemproses(false);
    }
  };

  const handleBerhenti = async () => {
    setMemproses(true);
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (meterRef.current !== null) {
      clearInterval(meterRef.current);
      meterRef.current = null;
    }
    setLevelAudio(0);

    try {
      const pathWav = await stopRecording();
      setSedangMerekam(false);
      setBerkasTersimpan(pathWav);
      onSelesaiRekam({ judul: judulRapat, path: pathWav });
    } catch (err) {
      setGalat(err instanceof Error ? err.message : String(err));
      setSedangMerekam(false);
    } finally {
      setMemproses(false);
    }
  };

  return (
    <div style={{ flex: 1, padding: "28px", display: "flex", flexDirection: "column", gap: "20px", overflowY: "auto" }}>
      {/* Header Info */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h2 style={{ fontSize: "20px", fontWeight: "700", color: "#153e35" }}>
            Perekam Audio Native Desktop
          </h2>
          <p style={{ color: "#64748b", fontSize: "13px", marginTop: "2px" }}>
            Merekam suara rapat berformat WAV 16-bit uncompressed untuk akurasi transkripsi Whisper maksimal.
          </p>
        </div>
      </div>

      {/* Banner Pintasan Cloud AI */}
      <div
        style={{
          background: "#ecfdf5",
          border: "1px solid #a7f3d0",
          borderRadius: "12px",
          padding: "12px 18px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Cloud size={18} color="#059669" />
          <div style={{ fontSize: "13px", color: "#065f46" }}>
            <strong>Ingin memakai API Key sendiri?</strong> Anda bisa menggunakan Google Gemini (Base URL custom / OpenAI-compatible) atau Cloudflare Whisper tanpa perlu download model.
          </div>
        </div>
        {onBukaCloudAi && (
          <button
            onClick={onBukaCloudAi}
            style={{
              padding: "6px 14px",
              borderRadius: "8px",
              background: "#153e35",
              color: "#ffffff",
              border: "none",
              fontSize: "12px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            Buka Menu Cloud AI ➔
          </button>
        )}
      </div>
      {galat && (
        <div
          style={{
            padding: "12px 16px",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "10px",
            color: "#991b1b",
            fontSize: "13px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <AlertCircle size={16} />
          <span>{galat}</span>
        </div>
      )}

      {/* Form Pengaturan */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "16px",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569", textTransform: "uppercase" }}>
            Judul Pertemuan / Agenda
          </label>
          <input
            type="text"
            value={judulRapat}
            onChange={(e) => setJudulRapat(e.target.value)}
            disabled={sedangMerekam}
            style={{
              padding: "10px 14px",
              borderRadius: "10px",
              border: "1px solid #cbd5e1",
              fontSize: "14px",
              color: "#0f172a",
              background: sedangMerekam ? "#f8fafc" : "#ffffff",
            }}
          />
        </div>

        {/* Lokasi Penyimpanan Hardisk */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569", textTransform: "uppercase" }}>
              Lokasi Penyimpanan di Hardisk (Default: Documents/ruma-notulen)
            </label>
            <button
              onClick={async () => {
                const def = await getDefaultSaveDir();
                setFolderSimpan(def);
              }}
              disabled={sedangMerekam}
              style={{
                background: "transparent",
                border: "none",
                color: "#153e35",
                fontSize: "11px",
                cursor: "pointer",
              }}
            >
              Reset ke Default
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", gap: "8px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  flex: 1,
                  padding: "0 12px",
                  height: "42px",
                  borderRadius: "10px",
                  border: "1px solid #cbd5e1",
                  background: sedangMerekam ? "#f8fafc" : "#ffffff",
                }}
              >
                <Folder size={16} color="#64748b" />
                <input
                  type="text"
                  value={folderSimpan}
                  onChange={(e) => gantiFolder(e.target.value)}
                  disabled={sedangMerekam}
                  placeholder="C:/Users/Nama/Documents/ruma-notulen atau ~/Documents/ruma-notulen"
                  style={{
                    border: "none",
                    outline: "none",
                    width: "100%",
                    fontSize: "13px",
                    color: "#0f172a",
                    fontFamily: "monospace",
                    background: "transparent",
                    height: "100%",
                    padding: "0",
                  }}
                />
              </div>

              <button
                type="button"
                onClick={async () => {
                  const f = await pickFolder();
                  if (f) gantiFolder(f);
                }}
                disabled={sedangMerekam}
                style={{
                  height: "42px",
                  padding: "0 18px",
                  borderRadius: "10px",
                  background: "#153e35",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: "600",
                  fontSize: "13px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  whiteSpace: "nowrap",
                }}
              >
                <FolderOpen size={16} />
                <span>Browse...</span>
              </button>
            </div>
            {gdrivePath && (
              <button
                type="button"
                onClick={() => gantiFolder(gdrivePath)}
                disabled={sedangMerekam}
                style={{
                  padding: "6px 12px",
                  borderRadius: "8px",
                  background: folderSimpan === gdrivePath ? "#f0fdf4" : "#f8fafc",
                  border: folderSimpan === gdrivePath ? "1px solid #86efac" : "1px solid #cbd5e1",
                  color: folderSimpan === gdrivePath ? "#166534" : "#334155",
                  fontSize: "12px",
                  fontWeight: "600",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  alignSelf: "flex-start",
                }}
              >
                <Cloud size={14} color={folderSimpan === gdrivePath ? "#166534" : "#64748b"} />
                <span>
                  {folderSimpan === gdrivePath
                    ? "✓ Terhubung ke Google Drive Desktop (My Drive/ruma. Notulen)"
                    : "Hubungkan ke Google Drive Desktop (My Drive/ruma. Notulen)"}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Pilihan Mikrofon */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569", textTransform: "uppercase" }}>
              Pilihan Mikrofon / Sumber Audio
            </label>
            <button
              onClick={() => void muatDataAwal()}
              disabled={sedangMerekam}
              style={{
                background: "transparent",
                border: "none",
                color: "#153e35",
                fontSize: "12px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <RefreshCw size={12} />
              <span>Pindai Ulang</span>
            </button>
          </div>
          <select
            value={perangkatDipilih}
            onChange={(e) => gantiPerangkat(e.target.value)}
            disabled={sedangMerekam}
            style={{
              height: "42px",
              padding: "10px 14px",
              borderRadius: "10px",
              border: "1px solid #cbd5e1",
              fontSize: "13px",
              color: "#0f172a",
              background: sedangMerekam ? "#f8fafc" : "#ffffff",
            }}
          >
            {perangkat.map((d) => (
              <option key={d.name} value={d.name}>
                {d.name} {d.is_default ? "(Default Sistem)" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Kotak Rekaman & Visualizer */}
      <div
        style={{
          background: sedangMerekam ? "#f0fdf4" : "#ffffff",
          border: sedangMerekam ? "2px solid #86efac" : "1px solid #e2e8f0",
          borderRadius: "16px",
          padding: "32px 20px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "16px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          transition: "all 0.2s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {sedangMerekam && (
            <div
              style={{
                width: "12px",
                height: "12px",
                background: "#dc2626",
                borderRadius: "50%",
                boxShadow: "0 0 10px rgba(220, 38, 38, 0.6)",
              }}
            />
          )}
          <span style={{ fontSize: "40px", fontWeight: "800", fontFamily: "monospace", color: "#153e35" }}>
            {formatWaktu(detik)}
          </span>
        </div>

        {/* Bar Visualizer Gelombang Audio */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", height: "36px" }}>
          {Array.from({ length: 24 }).map((_, idx) => {
            const variasi = (Math.sin(idx * 0.8 + Date.now() / 200) + 1) / 2;
            const tinggi = sedangMerekam ? Math.max(6, Math.round(levelAudio * 36 * (0.5 + 0.5 * variasi))) : 6;
            return (
              <div
                key={idx}
                style={{
                  width: "6px",
                  height: `${tinggi}px`,
                  background: sedangMerekam ? "#153e35" : "#cbd5e1",
                  borderRadius: "3px",
                  transition: "height 0.08s ease",
                }}
              />
            );
          })}
        </div>

        {/* Kontrol Utama */}
        <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
          {!sedangMerekam ? (
            <button
              onClick={() => void handleMulai()}
              disabled={memproses}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "12px 28px",
                borderRadius: "9999px",
                border: "none",
                background: "#153e35",
                color: "#ffffff",
                fontWeight: "600",
                fontSize: "15px",
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(21, 62, 53, 0.3)",
              }}
            >
              <Mic size={18} />
              <span>{memproses ? "Menyiapkan..." : "Mulai Rekam Rapat"}</span>
            </button>
          ) : (
            <button
              onClick={() => void handleBerhenti()}
              disabled={memproses}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "12px 28px",
                borderRadius: "9999px",
                border: "none",
                background: "#dc2626",
                color: "#ffffff",
                fontWeight: "600",
                fontSize: "15px",
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(220, 38, 38, 0.3)",
              }}
            >
              <Square size={16} fill="white" />
              <span>{memproses ? "Menyimpan..." : "Selesai & Simpan Berkas"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Info Berkas Tersimpan */}
      {berkasTersimpan && (
        <div
          style={{
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: "14px",
            padding: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <FolderCheck size={22} color="#166534" />
            <div>
              <div style={{ fontSize: "14px", fontWeight: "600", color: "#166534" }}>
                Berkas Audio Rapat Berhasil Disimpan di Hardisk
              </div>
              <div style={{ fontSize: "12px", color: "#15803d", fontFamily: "monospace", marginTop: "2px" }}>
                {berkasTersimpan}
              </div>
            </div>
          </div>
          <button
            onClick={() => onSelesaiRekam({ judul: judulRapat, path: berkasTersimpan })}
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              background: "#153e35",
              color: "#ffffff",
              border: "none",
              fontWeight: "600",
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            Buat Notulen dengan AI ➔
          </button>
        </div>
      )}
    </div>
  );
}
