import { execSync } from "node:child_process";
import fs from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, "dist");
const zipOut = resolve(__dirname, "ruma-meet.zip");
const crxTarget = resolve(__dirname, "dist.crx");
const finalCrx = resolve(__dirname, "ruma-meet.crx");
const keyPem = resolve(__dirname, "key.pem");

async function pack() {
  console.log("📦 Memulai pengemasan ruma. Chrome Extension...");

  // 1. Pastikan dist/ terbaru
  execSync("tsx build.ts", { cwd: __dirname, stdio: "inherit" });

  // 2. Buat ruma-meet.zip untuk Chrome Web Store / Google Admin Console
  console.log("🗜️  Membuat berkas ZIP (siap upload Web Store / Admin Console)...");
  if (fs.existsSync(zipOut)) {
    fs.unlinkSync(zipOut);
  }
  execSync(`cd "${distDir}" && zip -r "${zipOut}" . -x "*.DS_Store"`, { stdio: "inherit" });
  console.log(`✅ Berkas ZIP berhasil dibuat: ${zipOut}`);

  // 3. Kemas menjadi berkas .crx jika Chrome CLI tersedia
  const chromeBinary = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  if (fs.existsSync(chromeBinary)) {
    console.log("🔒 Mengemas ekstensi menjadi .crx dengan kunci privat...");
    const keyFlag = fs.existsSync(keyPem) ? `--pack-extension-key="${keyPem}"` : "";
    execSync(`"${chromeBinary}" --pack-extension="${distDir}" ${keyFlag}`, { stdio: "pipe" });

    if (fs.existsSync(crxTarget)) {
      if (fs.existsSync(finalCrx)) fs.unlinkSync(finalCrx);
      fs.renameSync(crxTarget, finalCrx);
      console.log(`✅ Berkas CRX berhasil dibuat: ${finalCrx}`);
    }
  }

  console.log("\n🎉 Pengemasan selesai!");
  console.log("1. ruma-meet.zip  -> Unggah ke Chrome Web Store (bisa disetel Private khusus guru Al Akhyar)");
  console.log("2. ruma-meet.crx  -> Seret (drag-and-drop) langsung ke tab chrome://extensions");
}

void pack();
