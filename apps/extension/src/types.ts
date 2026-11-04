export type StatusPerekam =
  | "siap"
  | "meminta_izin"
  | "merekam"
  | "dijeda"
  | "mengunggah"
  | "selesai"
  | "galat";

export type KonfigurasiEkstensi = {
  rumaUrl: string;
  sertakanMic: boolean;
  kategoriDefault: string;
  authToken?: string;
};

export type KeadaanPerekam = {
  status: StatusPerekam;
  detik: number;
  audioLevel: number;
  totalChunk: number;
  sesiUuid: string | null;
  sesiUrl: string | null;
  judul: string;
  kodeMeet: string;
  galat: string | null;
};

export type PesanMulaiRekam = {
  tipe: "START_RECORDING";
  targetTabId?: number;
  judul: string;
  kodeMeet: string;
  includeMic?: boolean;
  kategori?: string;
};

export type PesanJedaRekam = {
  tipe: "PAUSE_RECORDING";
};

export type PesanLanjutRekam = {
  tipe: "RESUME_RECORDING";
};

export type PesanBerhentiRekam = {
  tipe: "STOP_RECORDING";
};

export type PesanAmbilKeadaan = {
  tipe: "GET_RECORDING_STATE";
};

export type PesanKeadaanDiperbarui = {
  tipe: "RECORDING_STATE_UPDATED";
  keadaan: KeadaanPerekam;
};

export type PesanLevelAudio = {
  tipe: "AUDIO_LEVEL_UPDATED";
  level: number;
};

export type PesanOffscreenMulai = {
  tipe: "OFFSCREEN_START";
  streamId: string;
  targetTabId: number;
  judul: string;
  kodeMeet: string;
  includeMic: boolean;
  rumaUrl: string;
  authToken: string;
  kategori?: string;
};

export type PesanEkstensi =
  | PesanMulaiRekam
  | PesanJedaRekam
  | PesanLanjutRekam
  | PesanBerhentiRekam
  | PesanAmbilKeadaan
  | PesanKeadaanDiperbarui
  | PesanLevelAudio
  | PesanOffscreenMulai
  | { tipe: "GET_SESSION_AUTH" }
  | { tipe: "OFFSCREEN_PAUSE" }
  | { tipe: "OFFSCREEN_RESUME" }
  | { tipe: "OFFSCREEN_STOP" }
  | { tipe: "OFFSCREEN_GET_STATE" };
