import type { Role, User } from "./db/schema.js";

/** Peran yang otomatis boleh membuat sesi rapat/supervisi tanpa moderasi. */
const LANGSUNG: readonly Role[] = ["superadmin", "admin", "kepsek", "wakasek"];

/** Peran yang boleh memoderasi permintaan dan mengelola user. */
export const MODERATOR: readonly Role[] = ["superadmin", "admin"];

/** Peran langsung, atau user yang diberi izin khusus (`bisaMerekam`) oleh admin. */
export const bisaBuatSesiLangsung = (u: User) => LANGSUNG.includes(u.role) || u.bisaMerekam;
