"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

// Pembaruan data antar tab dan antar komputer.
//
// Cara kerja:
// 1. Setiap simpan/ubah/hapus yang berhasil dari browser ini dicatat (localVersion).
// 2. Browser menanyakan "token perubahan data" ke server tiap beberapa detik. Kalau berubah karena orang
//    lain (komputer lain), dicatat sebagai remoteVersion.
// 3. Tab yang aktif memuat ulang datanya secara diam-diam kalau ada perubahan, dan tab yang baru
//    diaktifkan memuat ulang kalau ada perubahan sejak terakhir dimuat. Filter, scroll, dan isian
//    yang sedang diketik tidak terganggu.

const POLL_MS = 20_000; // tanya server tiap 20 detik saat jendela terlihat
const ECHO_MS = 1_500; // jeda sebelum token disamakan setelah simpan sendiri (supaya tidak dianggap perubahan orang lain)
const STALE_MS = 60_000; // tab yang diaktifkan dimuat ulang kalau datanya sudah lebih tua dari ini

type Ctx = { localVersion: number; remoteVersion: number };
const SyncContext = createContext<Ctx>({ localVersion: 0, remoteVersion: 0 });
const ActiveContext = createContext<boolean>(true);

export const TabActiveProvider = ActiveContext.Provider;

// Aksi yang tidak mengubah data (unduh file, cadangan) tidak dihitung sebagai perubahan.
function mengubahData(url: string, method: string): boolean {
  if (method === "GET" || method === "HEAD") return false;
  let path = url;
  try {
    path = new URL(url, window.location.origin).pathname;
  } catch {
    // pakai apa adanya
  }
  if (!path.startsWith("/api/")) return false;
  if (path.startsWith("/api/data-version") || path.startsWith("/api/backup")) return false;
  if (path.includes("/export") || path.endsWith("/pdf")) return false;
  return true;
}

export function DataSyncProvider({ children }: { children: React.ReactNode }) {
  const [ctx, setCtx] = useState<Ctx>({ localVersion: 0, remoteVersion: 0 });
  const baseline = useRef<string | null>(null);
  const echoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ambilToken = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch("/api/data-version", { cache: "no-store" });
      if (!res.ok) return null;
      const d = await res.json();
      return typeof d.token === "string" ? d.token : null;
    } catch {
      return null;
    }
  }, []);

  // Catat simpan/ubah/hapus yang berhasil dari browser ini tanpa perlu mengubah kode tiap menu.
  useEffect(() => {
    const asli = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const res = await asli(input, init);
      try {
        const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        if (res.ok && mengubahData(url, method)) {
          setCtx((c) => ({ ...c, localVersion: c.localVersion + 1 }));
          // Samakan token setelah simpan sendiri, supaya perubahan kita tidak terbaca sebagai perubahan orang lain.
          if (echoTimer.current) clearTimeout(echoTimer.current);
          echoTimer.current = setTimeout(async () => {
            const t = await ambilToken();
            if (t !== null) baseline.current = t;
          }, ECHO_MS);
        }
      } catch {
        // pencatatan tidak boleh mengganggu request aslinya
      }
      return res;
    };
    return () => {
      window.fetch = asli;
      if (echoTimer.current) clearTimeout(echoTimer.current);
    };
  }, [ambilToken]);

  // Tanya server berkala: apakah ada perubahan dari komputer lain?
  useEffect(() => {
    let berhenti = false;

    async function cek() {
      if (berhenti || document.visibilityState !== "visible") return;
      const t = await ambilToken();
      if (t === null || berhenti) return;
      if (baseline.current === null) {
        baseline.current = t;
        return;
      }
      if (t !== baseline.current) {
        baseline.current = t;
        setCtx((c) => ({ ...c, remoteVersion: c.remoteVersion + 1 }));
      }
    }

    cek();
    const timer = setInterval(cek, POLL_MS);
    const saatKembali = () => {
      if (document.visibilityState === "visible") cek();
    };
    document.addEventListener("visibilitychange", saatKembali);
    window.addEventListener("focus", saatKembali);
    return () => {
      berhenti = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", saatKembali);
      window.removeEventListener("focus", saatKembali);
    };
  }, [ambilToken]);

  return <SyncContext.Provider value={ctx}>{children}</SyncContext.Provider>;
}

function sedangMengetik(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (el as HTMLElement).isContentEditable;
}

/**
 * Pasang di tiap menu: `useAutoRefresh(() => load(true))`.
 * - Tab aktif: dimuat ulang diam-diam kalau ada perubahan dari komputer lain (ditunda selagi kita mengetik).
 * - Tab yang baru diaktifkan: dimuat ulang kalau ada perubahan sejak terakhir dimuat, atau datanya sudah tua.
 * Fungsi `load` harus diam-diam: tidak menampilkan "Memuat..." dan tidak menghapus isian yang sedang dikerjakan.
 */
export function useAutoRefresh(load: () => void | Promise<void>) {
  const active = useContext(ActiveContext);
  const { localVersion, remoteVersion } = useContext(SyncContext);
  const loadRef = useRef(load);
  loadRef.current = load;

  const seenLocal = useRef(localVersion);
  const seenRemote = useRef(remoteVersion);
  const lastLoad = useRef(Date.now());
  const wasActive = useRef(active);

  useEffect(() => {
    const barusajaAktif = active && !wasActive.current;
    wasActive.current = active;
    if (!active) return;

    const adaPerubahan = localVersion !== seenLocal.current || remoteVersion !== seenRemote.current;
    const terlaluTua = Date.now() - lastLoad.current > STALE_MS;
    // Simpan sendiri di tab ini tidak memicu muat ulang di tab yang sama; baru berlaku saat berpindah tab.
    const perluSaatAktif = barusajaAktif && (adaPerubahan || terlaluTua);
    const perluSaatAktifBerjalan = !barusajaAktif && remoteVersion !== seenRemote.current;
    if (!perluSaatAktif && !perluSaatAktifBerjalan) return;

    let batal = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const jalankan = () => {
      if (batal) return;
      if (sedangMengetik()) {
        timer = setTimeout(jalankan, 2000); // tunda selagi sedang mengetik
        return;
      }
      seenLocal.current = localVersion;
      seenRemote.current = remoteVersion;
      lastLoad.current = Date.now();
      Promise.resolve(loadRef.current()).catch(() => {
        // muat ulang diam-diam gagal: biarkan data lama tampil
      });
    };
    jalankan();
    return () => {
      batal = true;
      if (timer) clearTimeout(timer);
    };
  }, [active, localVersion, remoteVersion]);
}
