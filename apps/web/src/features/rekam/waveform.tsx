import { useEffect, useRef } from "react";

const LEBAR_BAR = 3;
const JARAK_BAR = 3;
/** Satu bar baru tiap 70 ms; bar bergeser mulus di antara dua bar, bukan melompat. */
const INTERVAL_BAR_MS = 70;
/** Cadangan bila token tema tidak terbaca (nilai mode gelap: --record dan --muted-foreground). */
const FALLBACK_AKTIF = "#E5706F";
const FALLBACK_DIAM = "#A3B1A7";

/**
 * Waveform langsung: riwayat tingkat suara (RMS) yang bergulir ke kiri, dihaluskan agar tidak berkedip.
 * Saat `aktif` false (dijeda) gambar membeku; tanpa `analyser` hanya garis diam.
 */
export function Waveform({ analyser, aktif, className }: { analyser: AnalyserNode | null; aktif: boolean; className?: string }) {
  const kanvas = useRef<HTMLCanvasElement>(null);
  const aktifRef = useRef(aktif);
  useEffect(() => {
    aktifRef.current = aktif;
  }, [aktif]);

  useEffect(() => {
    const el = kanvas.current;
    const g = el?.getContext("2d");
    if (!el || !g) return;

    const sampel = analyser ? new Uint8Array(analyser.fftSize) : null;
    const riwayat: number[] = [];
    let tingkat = 0;
    let akumulasi = 0;
    let terakhir = performance.now();
    let lebar = 0;
    let tinggi = 0;
    let frame = 0;
    let warnaAktif = FALLBACK_AKTIF;
    let warnaDiam = FALLBACK_DIAM;

    const ukur = () => {
      const dpr = window.devicePixelRatio || 1;
      const r = el.getBoundingClientRect();
      lebar = r.width;
      tinggi = r.height;
      el.width = Math.max(1, Math.round(lebar * dpr));
      el.height = Math.max(1, Math.round(tinggi * dpr));
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Canvas tidak bisa memakai kelas Tailwind: baca token tema saat mengukur, bukan tiap frame.
      const gaya = getComputedStyle(el);
      warnaAktif = gaya.getPropertyValue("--record").trim() || FALLBACK_AKTIF;
      warnaDiam = gaya.getPropertyValue("--muted-foreground").trim() || FALLBACK_DIAM;
    };
    const pengamat = new ResizeObserver(ukur);
    pengamat.observe(el);
    ukur();

    const langkah = LEBAR_BAR + JARAK_BAR;

    const gambar = (sekarang: number) => {
      frame = requestAnimationFrame(gambar);
      const dt = Math.min(100, sekarang - terakhir);
      terakhir = sekarang;

      if (aktifRef.current && analyser && sampel) {
        analyser.getByteTimeDomainData(sampel);
        let jumlah = 0;
        for (const v of sampel) {
          const x = (v - 128) / 128;
          jumlah += x * x;
        }
        const rms = Math.sqrt(jumlah / sampel.length);
        const target = Math.min(1, Math.sqrt(rms) * 1.7);
        tingkat += (target - tingkat) * 0.25;
        akumulasi += dt;
        while (akumulasi >= INTERVAL_BAR_MS) {
          akumulasi -= INTERVAL_BAR_MS;
          riwayat.push(tingkat);
        }
        const kapasitas = Math.ceil(lebar / langkah) + 2;
        if (riwayat.length > kapasitas) riwayat.splice(0, riwayat.length - kapasitas);
      }

      g.clearRect(0, 0, lebar, tinggi);
      const fase = akumulasi / INTERVAL_BAR_MS;
      const n = riwayat.length;
      const tengah = tinggi / 2;
      if (n === 0) {
        g.fillStyle = warnaDiam;
        g.globalAlpha = 0.6;
        for (let x = LEBAR_BAR; x < lebar; x += langkah) g.fillRect(x, tengah - 1, LEBAR_BAR, 2);
        g.globalAlpha = 1;
        return;
      }
      g.fillStyle = warnaAktif;
      for (let umur = 0; umur < n; umur++) {
        const x = lebar - langkah * (umur + fase) - LEBAR_BAR;
        if (x < -langkah) break;
        const v = riwayat[n - 1 - umur] ?? 0;
        const h = Math.max(3, v * tinggi * 0.92);
        g.globalAlpha = Math.max(0.2, 1 - umur / (n + 1)) * (aktifRef.current ? 1 : 0.55);
        g.beginPath();
        g.roundRect(x, tengah - h / 2, LEBAR_BAR, h, LEBAR_BAR / 2);
        g.fill();
      }
      g.globalAlpha = 1;
    };
    frame = requestAnimationFrame(gambar);

    return () => {
      cancelAnimationFrame(frame);
      pengamat.disconnect();
    };
  }, [analyser]);

  return <canvas ref={kanvas} role="img" aria-label="Gelombang suara langsung" className={className} />;
}
