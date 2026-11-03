// Konfigurasi pm2 untuk API ruma. Dipakai oleh deploy/remote-api.sh di VPS (site user CloudPanel).
//
// - Satu instance saja (fork): worker transkripsi berjalan di dalam proses API (WORKER_INLINE=true).
// - cwd = symlink `current` (bukan path rilis): tiap restart membaca rilis yang sedang aktif.
// - .env dibaca node lewat --env-file; berkasnya symlink ke shared/.env (rahasia tidak ikut rilis).
const path = require("node:path");

const appDir = process.env.APP_DIR || path.join(process.env.HOME, "app");

module.exports = {
  apps: [
    {
      name: process.env.PM2_NAME || "ruma-api",
      cwd: path.join(appDir, "current"),
      script: "dist/index.js",
      node_args: ["--env-file=.env"],
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      restart_delay: 3000,
      // API menunggu worker selesai (maks 30 dtk) saat SIGINT; beri pm2 sedikit lebih lama sebelum SIGKILL.
      kill_timeout: 35000,
      time: true,
    },
  ],
};
