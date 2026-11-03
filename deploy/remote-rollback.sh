#!/usr/bin/env bash
# Kembali ke rilis API sebelumnya (atau yang disebut). Hanya kode; database TIDAK dikembalikan.
#
#   ssh user@host "APP_DIR=... PM2_NAME=... bash -s -- [ID_RILIS]" < deploy/remote-rollback.sh
set -euo pipefail

APP_DIR="${APP_DIR:-app}"
PM2_NAME="${PM2_NAME:-ruma-api}"
APP_DIR="$(cd "$APP_DIR" && pwd)"
export APP_DIR PM2_NAME

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  set +u
  . "$NVM_DIR/nvm.sh" >/dev/null
  nvm use --silent default >/dev/null 2>&1 || true
  set -u
fi

CURRENT="$APP_DIR/current"
AKTIF="$(readlink "$CURRENT" 2>/dev/null || true)"
TARGET=""
if [ -n "${1:-}" ]; then
  TARGET="$APP_DIR/releases/$1"
else
  # Rilis tepat sebelum yang aktif (terbaru lebih dulu). Rilis yang lebih baru dari yang aktif (mis. deploy yang
  # gagal health check) dilewati.
  lewat=0
  for d in $(ls -1r "$APP_DIR/releases"); do
    if [ "$lewat" = 1 ]; then
      TARGET="$APP_DIR/releases/$d"
      break
    fi
    [ "$APP_DIR/releases/$d" = "$AKTIF" ] && lewat=1
  done
fi
[ -n "$TARGET" ] && [ -d "$TARGET" ] || { echo "[rollback] GAGAL: tidak ada rilis tujuan" >&2; exit 1; }
[ "$TARGET" = "$AKTIF" ] && { echo "[rollback] rilis itu sudah aktif"; exit 0; }

echo "[rollback] $AKTIF -> $TARGET"
ln -sfn "$TARGET" "$CURRENT"
pm2 reload "$APP_DIR/current/ecosystem.config.cjs" --update-env >/dev/null
pm2 save >/dev/null

port="$(grep -E '^PORT=' "$APP_DIR/shared/.env" | tail -1 | cut -d= -f2- | tr -d '"'"'"'\r ' || true)"
port="${port:-3000}"
for _ in $(seq 1 40); do
  [ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$port/health" 2>/dev/null || true)" = "200" ] && { echo "[rollback] sehat"; exit 0; }
  sleep 1
done
echo "[rollback] rilis tujuan tidak sehat; periksa: pm2 logs $PM2_NAME" >&2
exit 1
