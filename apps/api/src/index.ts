import { serve } from "@hono/node-server";
import { app } from "./app.js";
import { closeDb } from "./db/index.js";
import { purgeExpiredSessions } from "./auth/session.js";
import { env } from "./env.js";

const server = serve({ fetch: app.fetch, port: env.PORT }, (i) =>
  console.log(`kalam-api listening on :${i.port}`),
);

const purge = setInterval(() => void purgeExpiredSessions().catch(console.error), 60 * 60 * 1000);

const shutdown = () => {
  clearInterval(purge);
  server.close(() => void closeDb().then(() => process.exit(0)));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
