import { useSyncExternalStore } from "react";

export type Tema = "system" | "light" | "dark";
const KEY = "kalam.tema";
const subs = new Set<() => void>();

const baca = (): Tema => (localStorage.getItem(KEY) as Tema | null) ?? "system";

function terapkan(t: Tema) {
  const gelap = t === "dark" || (t === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", gelap);
}

export function setTema(t: Tema) {
  localStorage.setItem(KEY, t);
  terapkan(t);
  subs.forEach((f) => f());
}

// Ikuti perubahan tema sistem selama pilihan = "system".
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => terapkan(baca()));

export const useTema = () =>
  useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    baca,
  );
