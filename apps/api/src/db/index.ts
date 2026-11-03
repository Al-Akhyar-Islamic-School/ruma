import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { env } from "../env.js";
import * as schema from "./schema.js";

const pool = mysql.createPool({ uri: env.DATABASE_URL, connectionLimit: 10, timezone: "Z" });
// Drizzle menulis/membaca `timestamp` sebagai UTC. Samakan zona sesi agar default CURRENT_TIMESTAMP
// dan NOW() ikut UTC, apa pun zona server MySQL (tanpa ini created_at bergeser sebesar offset server).
pool.pool.on("connection", (conn) => conn.query("SET time_zone = '+00:00'"));
export const db = drizzle(pool, { schema, mode: "default" });
export const closeDb = () => pool.end();
