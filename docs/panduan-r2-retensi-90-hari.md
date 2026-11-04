# Panduan Konfigurasi Cloudflare R2 & Retensi Audio 90 Hari

Dokumen ini menjelaskan konfigurasi Cloudflare R2 sebagai penyimpanan objek audio untuk ruma. (menggantikan penyimpanan lokal VPS) serta penerapan aturan siklus hidup (*Lifecycle Rule*) untuk menghapus audio otomatis setelah 90 hari.

---

## 1. Keuntungan Penyimpanan R2 di ruma.

1. **Zero Disk VPS:** Berkas rekaman audio panjang (1-3 jam, ~15-45 MB/sesi) tidak lagi menumpuk dan menghabiskan ruang penyimpanan SSD VPS.
2. **Zero Egress Fee:** Cloudflare R2 tidak memungut biaya transfer data keluar (*egress*), sehingga streaming pemutar audio rapat tidak membebani anggaran sekolah.
3. **Penyimpanan Terpisah & Aman:** Berkas audio diakses secara privat via endpoint API ruma. yang memvalidasi sesi dan otorisasi pengguna sebelum meneruskan aliran audio dengan *Range Request* (HTTP 206).
4. **Retensi Otomatis 90 Hari:** Audio operasional aktif di server terhapus otomatis setelah 90 hari. Untuk arsip jangka panjang, sekolah dapat mencentang opsi simpan audio permanen ke Google Drive di folder `"ruma. Notulen"`.

---

## 2. Membuat Bucket R2 & Kredensial API

### Langkah 1: Buat Bucket R2 di Cloudflare
1. Buka [Cloudflare Dashboard](https://dash.cloudflare.com/) dan masuk ke akun Al Akhyar.
2. Pada navigasi kiri, pilih **R2 Object Storage** -> **Overview**.
3. Klik tombol **Create bucket**.
4. Isi nama bucket, misalnya: `ruma-audio-prod`.
5. Pilih lokasi: **Automatic** (atau pilih region terdekat seperti WNAM/APAC).
6. Klik **Create Bucket**.

### Langkah 2: Buat Token API R2
1. Di halaman R2 Overview, klik **Manage R2 API Tokens** di sisi kanan.
2. Klik **Create API token**.
3. Beri nama: `ruma-api-token`.
4. Permissions: **Object Read & Write**.
5. Specify bucket(s): Pilih bucket `ruma-audio-prod` (atau Apply to all buckets).
6. TTL: **Forever** (atau sesuai kebijakan rotasi kunci sekolah).
7. Klik **Create API Token**.
8. Catat nilai:
   - **Account ID** (ada di URL dashboard atau panel R2)
   - **Access Key ID**
   - **Secret Access Key**
   - **Endpoint** (format: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`)

---

## 3. Konfigurasi Aturan Retensi 90 Hari (Object Lifecycle Rule)

Cloudflare R2 menyediakan fitur *Object Lifecycle Rules* bawaan yang menghapus objek lama secara otomatis di sisi Cloudflare tanpa perlu skrip cron manual di server.

### Cara Mengatur via Dashboard Cloudflare:
1. Buka dashboard Cloudflare -> **R2 Object Storage**.
2. Klik bucket `ruma-audio-prod`.
3. Buka tab **Settings**.
4. Gulir ke bawah ke bagian **Object lifecycle rules**.
5. Klik **Add rule**.
6. Atur kolom berikut:
   - **Rule name**: `retensi-audio-90-hari`
   - **Rule scope**: Pilih **Apply to all objects in the bucket** (atau biarkan prefix kosong).
   - **Lifecycle action**: Centang **Delete object**.
   - **Age**: Isi `90` days.
7. Klik **Add rule** untuk menyimpan.

> **Catatan:** Setelah aturan ini aktif, Cloudflare R2 akan secara berkala memindai dan menghapus berkas rekaman (`*.part` atau `playback.mp3`) yang umurnya telah melewati 90 hari sejak tanggal dibuat.

---

## 4. Konfigurasi Environment di Server Produksi (CloudPanel)

Tambahkan variabel berikut ke berkas `.env` API di server produksi:

```env
# Cloudflare R2 Object Storage
R2_ACCOUNT_ID=d7f...
R2_ACCESS_KEY_ID=e1b...
R2_SECRET_ACCESS_KEY=7c8...
R2_BUCKET_NAME=ruma-audio-prod
```

Setelah `.env` diperbarui, lakukan reload proses PM2:
```bash
pm2 restart ruma-api
```

---

## 5. Hubungan dengan Google Drive (Arsip Permanen)

Karena audio di Cloudflare R2 akan terhapus otomatis setelah 90 hari:
* Pengguna memiliki opsi saat menyetujui dokumen untuk mencentang **"Simpan rekaman audio ke Drive"**.
* Berkas rekaman MP3 akan diunggah ke Google Drive sekolah di folder `"ruma. Notulen"` berdampingan dengan berkas Google Docs notulen resmi.
* Berkas audio di Google Drive **tidak terpengaruh** oleh retensi 90 hari Cloudflare R2 dan akan tersimpan selamanya sebagai aset arsip sekolah.
