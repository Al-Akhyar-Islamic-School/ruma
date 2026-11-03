import { migrate } from "drizzle-orm/mysql2/migrator";
import { closeDb, db } from "./index.js";

await migrate(db, { migrationsFolder: "./drizzle" });
await closeDb();
console.log("migrasi selesai");
