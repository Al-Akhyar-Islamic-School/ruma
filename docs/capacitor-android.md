# Rencana: aplikasi Android (Capacitor) untuk ruma.

**Status:** Selesai dikerjakan (Fase A-D selesai; APK debug `sch.alakhyar.ruma` 4.6 MB berhasil di-build dan siap diuji coba di perangkat).

## 1. Tujuan dan alasan

PWA sudah cukup untuk merekam selama layar menyala. APK dibuat untuk dua hal yang PWA tidak bisa menjamin:

1. **Merekam dengan layar mati / app di latar belakang.** Android menghentikan perekaman WebView saat app tidak terlihat, kecuali ada *foreground service* bertipe mikrofon. Ini alasan utama.
2. **Pemasangan seperti app biasa** (ikon, tanpa bilah browser, sideload APK ke ponsel guru/kepsek) tanpa Play Store.

Bukan tujuan: fitur baru, UI terpisah, atau menggantikan PWA. PWA tetap menjadi sumber kode yang sama (`apps/web`); APK hanya cangkang.

## 2. Acuan yang sudah ada

- Proyek CBT (`erapor-cbt/apps/ujian`) memakai Capacitor 7, `appId sch.alakhyar.ujian`, skrip `android:apk` = `vite build && cap sync android && cd android && ./gradlew assembleDebug`, `MainActivity` yang mendaftarkan plugin native (`UjianNativePlugin`), dan APK debug disebar langsung. ruma mengikuti pola yang sama.
- Mesin pengembangan ini: Android SDK ada (`platforms` 33-35, `build-tools` 34, ada `system-images/android-34`), **JDK belum terpasang** (Capacitor 7 butuh JDK 21).

## 3. Keputusan yang perlu dikonfirmasi

| # | Keputusan | Usulan | Dampak bila lain |
|---|---|---|---|
| 1 | Distribusi | APK langsung (sideload), `assembleDebug`/rilis bertanda tangan sendiri | Play Store menambah: akun developer, tanda tangan App Bundle, kebijakan izin mikrofon/foreground service, kebijakan data murid |
| 2 | Perekaman layar mati di versi pertama | Ya (alasan utama APK) | Tanpa ini APK nyaris tak beda dari PWA |
| 3 | Domain produksi | `ruma.<domain>` untuk web, `api.ruma.<domain>` untuk API (sama-situs) | Menentukan `server.hostname` dan cookie sesi (lihat 4.2) |
| 4 | `appId` | `sch.alakhyar.ruma` | Juga menjadi skema deep link |
| 5 | Pembaruan app | Manual (unduh APK baru) di fase 1 | Pembaruan dari dalam app (seperti CBT `pasangApk`) bisa menyusul |

## 4. Rancangan

### 4.1 Login Google di app (perubahan backend + web)

Google **menolak OAuth di WebView** (`disallowed_useragent`), jadi login tidak boleh berjalan di dalam WebView app.

Alur: browser sistem (Custom Tabs, `@capacitor/browser`) + **PKCE** + deep link.

```
App          : buat verifier acak; tantangan = base64url(sha256(verifier)); simpan verifier (localStorage)
App          : Browser.open(API/auth/google?app=1&c=<tantangan>)
API          : simpan tantangan di cookie transaksi; arahkan ke Google (alur yang sudah ada)
API callback : verifikasi ID token (hd, nonce, dst. sudah ada); buat KODE sekali pakai (hash di DB, TTL 2 menit, terikat tantangan);
               tampilkan halaman yang membuka  sch.alakhyar.ruma://masuk?kode=...  (pengalihan otomatis + tombol manual)
App          : @capacitor/app `appUrlOpen` -> POST /auth/aplikasi/tukar {kode, verifier}
API          : kode ada, belum kedaluwarsa, sha256(verifier) == tantangan -> hapus kode -> buat sesi (cookie) -> {ok:true}
```

- **PKCE wajib**: skema kustom bisa disadap aplikasi lain; tanpa verifier yang hanya dimiliki app, kode curian tidak berguna.
- Kode **satu kesempatan**: dihapus sebelum diperiksa, jadi verifier tidak bisa ditebak berulang.
- Tabel baru `kalam_kode_aplikasi` (migrasi `0003`), env `APP_SCHEME`, endpoint `POST /auth/aplikasi/tukar`, bagian `?app=1` di `GET /auth/google` dan callback; pembersihan kode kedaluwarsa di job purge sesi.
- Sudah dirancang dan sempat ditulis, lalu ditarik kembali untuk menunggu transkripsi. Dapat ditulis ulang dengan cepat dari rancangan ini.

### 4.2 Cookie sesi di WebView

Origin WebView Capacitor default `https://localhost` berbeda situs dari API, sehingga cookie `SameSite=Lax` tidak terkirim. Solusi tanpa mengubah model sesi: set `server.hostname` Capacitor ke **host yang sama dengan `APP_URL`** (mis. `ruma.alakhyar.sch.id`, `androidScheme: https`).

- `Origin` yang dikirim WebView = `APP_URL`, jadi CORS dan pemeriksaan origin API tetap lolos tanpa perubahan.
- API di `api.ruma.alakhyar.sch.id` sama-situs dengan itu, jadi cookie `Lax` terkirim, termasuk untuk `<audio src>`.
- Akibatnya WebView menyajikan aset lokal untuk host itu (app tidak membuka PWA daring di host yang sama; wajar).
- Syarat: `APP_URL` berskema `https` di produksi. Untuk uji dengan API lokal berskema `http`, pakai `androidScheme: http` pada build uji.

### 4.3 Plugin native perekam (Java, mengikuti `UjianNativePlugin`)

`RumaRecorderPlugin` (nama plugin `RumaRecorder`) + `RumaRecorderService`:

- `mulai({judul})`: menjalankan **foreground service** bertipe `microphone` dengan notifikasi "ruma sedang merekam: {judul}", menahan `PARTIAL_WAKE_LOCK` (agar CPU tetap hidup saat layar mati; ada batas waktu pengaman), dan opsional `FLAG_KEEP_SCREEN_ON`.
- `berhenti()`: menghentikan service, melepas wake lock.
- **Urutan penting (Android 14):** service bertipe mikrofon hanya boleh dimulai bila izin `RECORD_AUDIO` sudah diberikan. Jadi JS memanggil `getUserMedia` lebih dulu (memicu dialog izin), baru `RumaRecorder.mulai()`. Plugin memeriksa izin dan menolak dengan galat jelas, bukan crash.
- Izin manifest: `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MICROPHONE`, `POST_NOTIFICATIONS` (Android 13+; bila ditolak, service tetap berjalan, hanya notifikasi tak tampil), `WAKE_LOCK`.
- Sisi web: pembungkus `features/rekam/native.ts` (`registerPlugin`, tanpa efek di web) dipanggil dari `use-perekam.ts` saat mulai dan selesai/batal.
- Hal yang harus diperiksa di kode sumber `@capacitor/android`: apakah `BridgeActivity` memanggil `WebView.onPause()` saat app ke latar belakang. Bila ya, `MainActivity` perlu menimpanya (mis. `resumeTimers()`) agar `MediaRecorder` dan timer JS terus berjalan.

### 4.4 Cangkang aplikasi

- `apps/web/capacitor.config.ts`: `appId`, `appName: ruma.`, `webDir: dist`, `server.hostname/androidScheme` dari env, `allowMixedContent: false`.
- Folder `apps/web/android/` (dihasilkan `cap add android`, di-commit seperti CBT; `build/` dan `local.properties` diabaikan).
- `AndroidManifest`: izin di atas; `intent-filter` deep link `sch.alakhyar.ruma://masuk` (BROWSABLE); `allowBackup=false` (data rekaman kelas); service dengan `foregroundServiceType="microphone"`.
- Ikon launcher dari `public/icon.svg` (semua kepadatan + ikon adaptif, latar `#0284c7`).
- Build native: `VITE_NATIVE=1` mematikan service worker PWA (aset sudah lokal; SW hanya menambah risiko cache usang). `VITE_API_URL` produksi wajib diisi saat build (tidak boleh default ke localhost).
- Skrip: `android:sync` (`VITE_NATIVE=1 vite build && cap sync android`) dan `android:apk` (`... && ./gradlew assembleDebug`).

## 5. Tahapan dan kriteria selesai

| Fase | Isi | Status |
|---|---|---|
| A | Siapkan toolchain: JDK 21 di `/opt/homebrew/opt/openjdk@21`, Android SDK di `~/Library/Android/sdk` | ✅ **Selesai** (`./gradlew --version` sukses) |
| B | Cangkang: Capacitor 7, `cap add android`, ikon adaptive `#153e35`, manifest, skrip build | ✅ **Selesai** (`pnpm --filter @kalam/web android:apk` sukses menghasilkan APK 4.6 MB) |
| C | Login app: Google OAuth via browser sistem (`@capacitor/browser`) + PKCE + deep link `sch.alakhyar.ruma://masuk` | ✅ **Selesai** (Unit test PKCE lolos 100%, endpoint `/auth/aplikasi/tukar` teruji) |
| D | Plugin perekam: Foreground service mikrofon (`RumaRecorderService`) + `PARTIAL_WAKE_LOCK` + `resumeTimers` WebView | ✅ **Selesai** (Terintegrasi di `use-perekam.ts` & manifest Android 14) |
| E | Uji coba di perangkat nyata (ponsel guru/kepsek) | 🟡 **Siap Uji** (Instal `app-debug.apk` via `adb install` atau bagikan berkas APK) |

## 6. Risiko

- **Perilaku `MediaRecorder` di WebView saat latar belakang tidak bisa dibuktikan tanpa perangkat.** Emulator cukup untuk memeriksa service dan izin, bukan untuk semua merek (penghemat baterai Xiaomi/Oppo/Vivo dapat mematikan service). Perlu uji perangkat nyata sebelum diklaim andal.
- Pembatasan Android 14 pada foreground service dan notifikasi (lihat urutan izin di 4.3).
- Kode deep link yang tersadap: dimitigasi PKCE dan TTL pendek.
- Beban pemeliharaan: dua target (PWA dan APK) dari satu basis kode; pembaruan APK manual.

## 7. Di luar cakupan

Play Store, pembaruan otomatis dari dalam app, iOS, notifikasi push.
