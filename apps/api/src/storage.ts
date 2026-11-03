import { randomUUID } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "./env.js";

/** Penyimpanan audio. Implementasi disk sekarang; bisa diganti R2/S3 tanpa menyentuh route. */
export interface AudioStorage {
  put(key: string, data: Uint8Array): Promise<void>;
  /** Path berkas lokal untuk `key` (ffmpeg dan pemutar audio membaca dari disk). Implementasi R2 harus mengunduh dulu. */
  localPath(key: string): string;
}

class DiskStorage implements AudioStorage {
  private readonly root: string;

  constructor(root: string) {
    this.root = path.resolve(root);
  }

  localPath(key: string) {
    const target = path.resolve(this.root, key);
    if (!target.startsWith(this.root + path.sep)) throw new Error(`key di luar root: ${key}`);
    return target;
  }

  async put(key: string, data: Uint8Array) {
    const target = this.localPath(key);
    await mkdir(path.dirname(target), { recursive: true });
    // Tulis ke berkas sementara lalu rename: pembaca tidak pernah melihat chunk setengah jadi.
    const tmp = `${target}.${randomUUID()}.tmp`;
    await writeFile(tmp, data);
    await rename(tmp, target);
  }
}

export const audioStorage: AudioStorage = new DiskStorage(env.AUDIO_DIR);

export const chunkKey = (sesiUuid: string, seq: number) =>
  `${sesiUuid}/${String(seq).padStart(6, "0")}.part`;
