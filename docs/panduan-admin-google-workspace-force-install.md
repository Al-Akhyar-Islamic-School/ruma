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

## 🛠️ Langkah Demi Langkah (Pilihan Metode)

### METODE UTAMA: Pemasangan Otomatis via Custom URL Server Sendiri (100% GRATIS / $0)

Metode ini **TIDAK MEMERLUKAN Chrome Web Store dan TIDAK ADA BIAYA $5 sama sekali**. Berkas ekstensi di-host langsung di server sekolah sendiri (`https://ruma.alakhyar.sch.id`).

#### 1. Data Konfigurasi Ekstensi Sekolah:
- **Extension ID:** `ajikealpdjmgndmjmnekmefngfibepph`
- **URL Pembaruan (Update URL):** `https://ruma.alakhyar.sch.id/extension/update.xml`
- **Berkas Biner (.crx):** `https://ruma.alakhyar.sch.id/extension/ruma-meet.crx`

#### 2. Langkah Pengaturan di Google Admin Console:
1. Buka [Google Workspace Admin Console](https://admin.google.com).
2. Masuk ke menu:
   👉 **Devices (Perangkat)** ➔ **Chrome** ➔ **Apps & extensions (Aplikasi & ekstensi)** ➔ **Users & browsers (Pengguna & browser)**.
3. Di panel sebelah kiri, pilih Unit Organisasi (*Organizational Unit*), misal: **"Guru & Tenaga Kependidikan"** atau unit **"Al Akhyar"**.
4. Klik ikon tombol kuning **`+`** di pojok kanan bawah ➔ pilih **"Add Chrome app or extension by ID"** (Tambahkan aplikasi atau ekstensi Chrome berdasarkan ID).
5. Pilih opsi:
   👉 **`From a custom URL`** *(Dari URL khusus)*.
6. Masukkan data:
   - **Extension ID:** `ajikealpdjmgndmjmnekmefngfibepph`
   - **URL:** `https://ruma.alakhyar.sch.id/extension/update.xml`
7. Klik **Save (Simpan)**.
8. Pada tabel aplikasi, temukan baris `ajikealpdjmgndmjmnekmefngfibepph`, lalu ubah kolom **Installation policy** menjadi:
   👉 **`Force install + pin to browser toolbar`** *(Pasang paksa + sematkan ke bilah peramban)*.
9. Klik **Save (Simpan)** di pojok kanan atas. Selesai!

---

### METODE ALTERNATIF: Melalui Chrome Web Store Privat ($5 Akun Developer)

Jika yayasan ingin mendaftarkan akun pengembang resmi Google Chrome ($5 sekali seumur hidup untuk yayasan):

1. Buka [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) menggunakan akun admin sekolah (`admin@alakhyar.sch.id`).
2. Klik **"Add new item"** dan unggah berkas `apps/extension/ruma-meet.zip`.
3. Di tab **"Privacy & Visibility"**, pilih **"Private"** ➔ Centang **"Everyone in alakhyar.sch.id"**.
4. Klik **Publish item**. Salin **ID Ekstensi** yang muncul di dashboard.
5. Buka Google Admin Console ➔ `Apps & extensions > Users & browsers` ➔ klik `+` ➔ `Add from Chrome Web Store` ➔ masukkan ID Ekstensi ➔ setel **`Force install + pin`** ➔ Simpan.
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
