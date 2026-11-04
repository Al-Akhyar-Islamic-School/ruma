# Panduan Admin IT: Pemasangan Otomatis (Force-Install) Ekstensi ruma. via Google Workspace Admin

Dokumen ini adalah Prosedur Operasional Standar (SOP) bagi Administrator IT Yayasan Al Akhyar untuk memasang ekstensi **ruma. Notulis Google Meet** secara otomatis ke seluruh laptop guru dan staf melalui Google Workspace Admin Console.

---

## 🎯 Manfaat Kebijakan Pemasangan Paksa (Force-Install)

1. **Zero-Click bagi Guru:** Guru tidak perlu membuka link, mencari di toko, atau mengklik tombol instal. Ekstensi terpasang otomatis di latar belakang.
2. **Otomatis Tersemat (Pinned):** Ikon ruma. langsung muncul di pojok kanan atas Google Chrome tanpa perlu dipin manual.
3. **Anti-Hapus:** Guru tidak bisa menghapus ekstensi secara tidak sengaja karena dikunci oleh kebijakan yayasan.
4. **100% Privat untuk Sekolah:** Ekstensi disetel *Private*, sehingga orang luar di luar domain `@alakhyar.sch.id` tidak bisa melihat atau menginstalnya.
5. **Pembaruan Otomatis (Auto-Update):** Setiap kali ada fitur baru atau perbaikan, Google Chrome otomatis memperbarui ekstensi di semua laptop guru tanpa perlu tindakan admin ulang.

---

## 📦 Prasyarat & Penyiapan Berkas

Jalankan perintah pengemasan dari folder utama projek:
```bash
pnpm pack:extension
```
Perintah ini menghasilkan berkas siap unggah:
```
apps/extension/ruma-meet.zip
```

---

## 🛠️ Langkah Demi Langkah

### Langkah 1: Unggah Ekstensi ke Chrome Web Store (Setelan Privat)

1. Buka [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
2. Masuk menggunakan akun admin Google Workspace sekolah (misal: `admin@alakhyar.sch.id`).
   *(Catatan: Google mengenakan biaya registrasi developer $5 sekali seumur hidup untuk organisasi sekolah).*
3. Klik tombol **"Add new item"** (Tambah item baru) di pojok kanan atas.
4. Unggah berkas ZIP:
   `apps/extension/ruma-meet.zip`
5. Isi data dasar aplikasi:
   - **Name:** `ruma. Notulis Google Meet`
   - **Summary:** `Asisten pencatat notulen rapat Google Meet otomatis Sekolah Islam Al Akhyar`
   - **Category:** `Productivity` (Produktivitas)
6. Masuk ke tab **"Privacy & Visibility"** (Privasi & Visibilitas):
   - Gulir ke bagian **Visibility (Visibilitas)**.
   - Pilih opsi: **"Private"** (Privat).
   - Centang: **"Everyone in alakhyar.sch.id"** (Semua orang di domain alakhyar.sch.id).
   - *(Penting: Jangan pilih Public agar ekstensi tidak dapat diakses masyarakat umum).*
7. Klik tombol **"Submit for review"** / **"Publish item"**.
8. Setelah terbit, salin **ID Ekstensi** (string 32 huruf unik di dashboard, misal: `abcdefghijklmnopqrstuvwxyz123456`).

---

### Langkah 2: Terapkan Kebijakan Force-Install di Google Admin Console

1. Buka [Google Workspace Admin Console](https://admin.google.com).
2. Di menu navigasi sebelah kiri, buka:
   👉 **Devices (Perangkat)** ➔ **Chrome** ➔ **Apps & extensions (Aplikasi & ekstensi)** ➔ **Users & browsers (Pengguna & browser)**.
3. Di panel sebelah kiri, pilih Unit Organisasi (*Organizational Unit*) yang dituju:
   - Pilih unit akar **"Yayasan Al Akhyar"** jika ingin berlaku untuk semua staf.
   - Atau pilih unit khusus **"Guru & Tenaga Kependidikan"**.
4. Di pojok kanan bawah, klik ikon tombol kuning **`+`** (Tambah) ➔ pilih **"Add from Chrome Web Store"** (Tambahkan dari Chrome Web Store).
5. Cari **ruma. Notulis Google Meet** atau tempelkan **ID Ekstensi** dari Langkah 1.
6. Klik tombol **Select (Pilih)**.
7. Di tabel aplikasi, temukan baris `ruma. Notulis Google Meet`, lalu ubah kolom **Installation policy (Kebijakan pemasangan)** dari *"Allow install"* menjadi:
   👉 **`Force install + pin to browser toolbar`** *(Pasang paksa + sematkan ke bilah peramban)*.
8. Klik tombol **Save (Simpan)** di pojok kanan atas halaman.

---

### Langkah 3: Verifikasi di Laptop Guru

Untuk memastikan kebijakan sudah berjalan di laptop guru:

1. Minta salah satu guru membuka browser Google Chrome di laptopnya dan memastikan sudah login dengan akun `@alakhyar.sch.id`.
2. Ikon hijau **ruma.** akan otomatis muncul di bilah peramban Chrome (biasanya dalam 1–5 menit).
3. Buka rapat Google Meet (`https://meet.google.com/`).
4. Widget mengambang hijau **ruma.** akan otomatis tampil di sudut kanan atas layar rapat Google Meet dan siap digunakan merekam notulen.

> **Tips Mempercepat Sinkronisasi:**
> Jika ekstensi belum langsung muncul di laptop guru, buka tab baru di Chrome laptop guru, ketik `chrome://policy`, lalu klik tombol **"Reload policies"** untuk menarik kebijakan terbaru secara instan.

---

### Langkah 4: Pembaruan Versi di Masa Depan

Bila tim pengembang ruma. merilis pembaruan ekstensi:
1. Naikkan nomor versi di `apps/extension/manifest.json` (misal dari `1.0.0` ke `1.0.1`).
2. Jalankan kembali `pnpm pack:extension`.
3. Buka Chrome Web Store Developer Dashboard, klik item ruma., lalu klik **"Package"** ➔ **"Upload new package"** (Unggah berkas `ruma-meet.zip` yang baru).
4. Klik **Publish**.
5. Google Chrome di laptop semua guru akan otomatis mengunduh versi terbaru secara diam-diam tanpa perlu setel ulang di Google Admin Console.
