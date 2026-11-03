#!/usr/bin/env bash
# Mengaktifkan rilis API di VPS. Dijalankan di server sebagai site user API (lihat docs/deploy-cloudpanel.md):
#
#   ssh user@host "APP_DIR=... PM2_NAME=... bash -s -- <ID_RILIS>" < deploy/remote-api.sh
#
# Urutan: periksa prasyarat -> migrasi DB -> pindah symlink `current` -> reload pm2 -> health check.
# Health check gagal = kembali ke rilis sebelumnya (kode saja; migrasi TIDAK dibatalkan, jadi migrasi harus
# kompatibel dengan kode lama: tambah kolom/tabel dulu, hapus belakangan).
set -euo pipefail

RELEASE_ID="${1:?id rilis wajib}"
APP_DIR="${APP_DIR:-app}"
PM2_NAME="${PM2_NAME:-ruma-api}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"
# APP_DIR boleh relatif terhadap home; pm2 (cwd) butuh path absolut.
mkdir -p "$APP_DIR/releases" "$APP_DIR/shared"
APP_DIR="$(cd "$APP_DIR" && pwd)"
export APP_DIR PM2_NAME

# ssh non-interaktif tidak memuat profil, sedangkan Node milik site user CloudPanel dipasang lewat nvm.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  set +u
  . "$NVM_DIR/nvm.sh" >/dev/null
  nvm use --silent default >/dev/null 2>&1 || true
  set -u
fi

REL="$APP_DIR/releases/$RELEASE_ID"
SHARED="$APP_DIR/shared"
CURRENT="$APP_DIR/current"

die() { echo "[deploy] GAGAL: $*" >&2; exit 1; }

command -v node >/dev/null || die "node tidak ditemukan (nvm site user belum aktif?)"
command -v pm2 >/dev/null || die "pm2 belum terpasang untuk site user ini: npm install -g pm2"
[ -d "$REL" ] || die "rilis tidak ada: $REL"
[ -f "$SHARED/.env" ] || die "$SHARED/.env belum dibuat (salin dari deploy/api.env.production.example)"
command -v ffmpeg >/dev/null && command -v ffprobe >/dev/null \
  || echo "[deploy] PERINGATAN: ffmpeg/ffprobe tidak ada di PATH; transkripsi tidak akan berjalan (apt install ffmpeg sebagai root)"

ln -sfn "$SHARED/.env" "$REL/.env"
PREV="$(readlink "$CURRENT" 2>/dev/null || true)"
echo "[deploy] node $(node -v), rilis $RELEASE_ID (sebelumnya: ${PREV:-tidak ada})"

echo "[deploy] migrasi database"
(cd "$REL" && node --env-file=.env dist/db/migrate.js)

aktifkan() {
  ln -sfn "$1" "$CURRENT"
  if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
    pm2 reload "$APP_DIR/current/ecosystem.config.cjs" --update-env >/dev/null
  else
    pm2 start "$APP_DIR/current/ecosystem.config.cjs" >/dev/null
  fi
  pm2 save >/dev/null
}

port="$(grep -E '^PORT=' "$SHARED/.env" | tail -1 | cut -d= -f2- | tr -d '"'"'"'\r ' || true)"
port="${port:-3000}"

sehat() {
  local kode
  for _ in $(seq 1 40); do
    kode="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$port/health" 2>/dev/null || true)"
    [ "$kode" = "200" ] && return 0
    sleep 1
  done
  return 1
}

echo "[deploy] mengaktifkan rilis"
aktifkan "$REL"

if sehat; then
  echo "[deploy] health check OK (http://127.0.0.1:$port/health)"
else
  echo "[deploy] health check GAGAL; 40 baris log terakhir:" >&2
  pm2 logs "$PM2_NAME" --nostream --lines 40 >&2 || true
  if [ -n "$PREV" ] && [ -d "$PREV" ]; then
    echo "[deploy] kembali ke rilis sebelumnya: $PREV" >&2
    aktifkan "$PREV"
    sehat && echo "[deploy] rilis sebelumnya kembali sehat" >&2 || echo "[deploy] rilis sebelumnya JUGA tidak sehat: periksa pm2 logs" >&2
  fi
  exit 1
fi

# Simpan KEEP_RELEASES rilis terbaru (nama berawalan stempel waktu UTC, jadi urutan nama = urutan waktu).
n=0
for d in $(ls -1r "$APP_DIR/releases"); do
  n=$((n + 1))
  [ "$n" -le "$KEEP_RELEASES" ] && continue
  [ "$APP_DIR/releases/$d" = "$(readlink "$CURRENT")" ] && continue
  rm -rf "${APP_DIR:?}/releases/$d"
done
echo "[deploy] selesai: $RELEASE_ID"
