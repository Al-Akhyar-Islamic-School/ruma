import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { copyFile, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { env } from "./env.js";
import { buatKlienR2 } from "./r2.js";

export type HasilStreamAudio = {
  stream: Readable;
  contentLength: number;
  contentRange?: string;
  contentType: string;
  statusCode: 200 | 206;
};

/** Penyimpanan audio: R2 (Cloudflare Object Storage) di produksi, DiskStorage sebagai fallback dev lokal. */
export interface AudioStorage {
  readonly isR2: boolean;
  put(key: string, data: Uint8Array | Buffer, contentType?: string): Promise<void>;
  uploadFromFile(localPath: string, key: string, contentType?: string): Promise<void>;
  downloadToFile(key: string, localDestPath: string): Promise<void>;
  getStream(key: string, rangeHeader?: string): Promise<HasilStreamAudio | null>;
  delete(key: string): Promise<void>;
  deletePrefix(prefix: string): Promise<void>;
  /** Mengembalikan path lokal: langsung dari disk jika DiskStorage, atau diunduh ke scratchpad jika R2. */
  pastikanLokal(key: string, scratchDir?: string): Promise<string>;
  /** Path berkas disk lokal (hanya valid pada DiskStorage). */
  localPath(key: string): string;
}

export class R2AudioStorage implements AudioStorage {
  readonly isR2 = true;
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(client: S3Client, bucket: string) {
    this.client = client;
    this.bucket = bucket;
  }

  localPath(key: string): string {
    throw new Error(
      `localPath tidak didukung langsung pada R2 untuk key '${key}'; gunakan pastikanLokal(key, scratchDir)`
    );
  }

  async put(key: string, data: Uint8Array | Buffer, contentType = "application/octet-stream") {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: contentType,
      })
    );
  }

  async uploadFromFile(localPath: string, key: string, contentType = "audio/mpeg") {
    const data = await readFile(localPath);
    await this.put(key, data, contentType);
  }

  async downloadToFile(key: string, localDestPath: string) {
    await mkdir(path.dirname(localDestPath), { recursive: true });
    const res = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );
    if (!res.Body) throw new Error(`Berkas tidak ditemukan atau kosong di R2: ${key}`);
    const ws = createWriteStream(localDestPath);
    await pipeline(res.Body as Readable, ws);
  }

  async getStream(key: string, rangeHeader?: string): Promise<HasilStreamAudio | null> {
    try {
      const res = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Range: rangeHeader,
        })
      );
      if (!res.Body) return null;
      const isRange = Boolean(rangeHeader && res.ContentRange);
      return {
        stream: res.Body as Readable,
        contentLength: res.ContentLength ?? 0,
        contentRange: res.ContentRange,
        contentType: res.ContentType || "audio/mpeg",
        statusCode: isRange ? 206 : 200,
      };
    } catch (err: unknown) {
      const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (e.name === "NoSuchKey" || e.$metadata?.httpStatusCode === 404) {
        return null;
      }
      throw err;
    }
  }

  async delete(key: string) {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );
  }

  async deletePrefix(prefix: string) {
    let token: string | undefined;
    do {
      const list = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: token,
        })
      );
      if (list.Contents && list.Contents.length > 0) {
        const objects = list.Contents.map((obj) => ({ Key: obj.Key }));
        await this.client.send(
          new DeleteObjectsCommand({
            Bucket: this.bucket,
            Delete: { Objects: objects },
          })
        );
      }
      token = list.NextContinuationToken;
    } while (token);
  }

  async pastikanLokal(key: string, scratchDir?: string): Promise<string> {
    const dir = scratchDir || path.join(os.tmpdir(), "ruma-r2-cache");
    const dest = path.join(dir, key);
    if (!existsSync(dest)) {
      await this.downloadToFile(key, dest);
    }
    return dest;
  }
}

export class DiskStorage implements AudioStorage {
  readonly isR2 = false;
  private readonly root: string;

  constructor(root: string) {
    this.root = path.resolve(root);
  }

  localPath(key: string) {
    const target = path.resolve(this.root, key);
    if (!target.startsWith(this.root + path.sep) && target !== this.root) {
      throw new Error(`key di luar root: ${key}`);
    }
    return target;
  }

  async put(key: string, data: Uint8Array | Buffer) {
    const target = this.localPath(key);
    await mkdir(path.dirname(target), { recursive: true });
    // Tulis ke berkas sementara lalu rename: pembaca tidak pernah melihat chunk setengah jadi.
    const tmp = `${target}.${randomUUID()}.tmp`;
    await writeFile(tmp, data);
    await rename(tmp, target);
  }

  async uploadFromFile(localPath: string, key: string) {
    const target = this.localPath(key);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(localPath, target);
  }

  async downloadToFile(key: string, localDestPath: string) {
    const src = this.localPath(key);
    await mkdir(path.dirname(localDestPath), { recursive: true });
    await copyFile(src, localDestPath);
  }

  async getStream(key: string, rangeHeader?: string): Promise<HasilStreamAudio | null> {
    const target = this.localPath(key);
    let size: number;
    try {
      size = (await stat(target)).size;
    } catch {
      return null;
    }

    if (!rangeHeader) {
      return {
        stream: createReadStream(target),
        contentLength: size,
        contentType: "audio/mpeg",
        statusCode: 200,
      };
    }

    const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
    if (!m) {
      return {
        stream: createReadStream(target),
        contentLength: size,
        contentType: "audio/mpeg",
        statusCode: 200,
      };
    }

    const awal = m[1] ? Number(m[1]) : 0;
    const akhir = m[2] ? Number(m[2]) : size - 1;
    if (awal >= size || akhir >= size || awal > akhir) {
      return {
        stream: Readable.from([]),
        contentLength: 0,
        contentRange: `bytes */${size}`,
        contentType: "audio/mpeg",
        statusCode: 206,
      };
    }

    return {
      stream: createReadStream(target, { start: awal, end: akhir }),
      contentLength: akhir - awal + 1,
      contentRange: `bytes ${awal}-${akhir}/${size}`,
      contentType: "audio/mpeg",
      statusCode: 206,
    };
  }

  async delete(key: string) {
    const target = this.localPath(key);
    await rm(target, { force: true });
  }

  async deletePrefix(prefix: string) {
    const targetDir = this.localPath(prefix);
    await rm(targetDir, { recursive: true, force: true }).catch(() => undefined);
  }

  async pastikanLokal(key: string): Promise<string> {
    return this.localPath(key);
  }
}

const r2Client = buatKlienR2();

export const audioStorage: AudioStorage =
  r2Client && env.R2_BUCKET_NAME
    ? new R2AudioStorage(r2Client, env.R2_BUCKET_NAME)
    : new DiskStorage(env.AUDIO_DIR);

export const chunkKey = (sesiUuid: string, seq: number) =>
  `${sesiUuid}/${String(seq).padStart(6, "0")}.part`;
