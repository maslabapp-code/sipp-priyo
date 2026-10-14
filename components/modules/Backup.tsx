"use client";

import { useEffect, useState } from "react";
import { useAutoRefresh } from "@/components/layout/DataSync";

type BackupFile = { filename: string; sizeBytes: number; createdAt: string };

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

export function Backup() {
  const [rows, setRows] = useState<BackupFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    const res = await fetch("/api/backup");
    if (res.ok) setRows(await res.json());
    if (!silent) setLoading(false);
  }

  useAutoRefresh(() => load(true));

  useEffect(() => {
    load();
  }, []);

  async function runBackupNow() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/backup", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Gagal membuat backup.");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membuat backup.");
    } finally {
      setRunning(false);
    }
  }

  async function removeBackup(filename: string) {
    if (!confirm(`Hapus file backup "${filename}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    await fetch(`/api/backup/${encodeURIComponent(filename)}`, { method: "DELETE" });
    setRows((r) => r.filter((b) => b.filename !== filename));
  }

  return (
    <div className="h-full flex flex-col p-5">
      <div className="flex items-center justify-between mb-4 gap-3 shrink-0">
        <div>
          <h1 className="text-[15px] font-semibold">Backup Database</h1>
          <p className="text-[12.5px]" style={{ color: "var(--text-secondary)" }}>
            {rows.length} file backup tersimpan di server. Backup otomatis harian juga berjalan
            terjadwal di background (lihat scripts/SCHEDULE.md).
          </p>
        </div>
        <button
          onClick={runBackupNow}
          disabled={running}
          className="h-8 px-3 rounded-md text-[12.5px] font-medium text-white cursor-pointer shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ background: "var(--accent)" }}
        >
          {running ? "Membuat backup..." : "Backup Sekarang"}
        </button>
      </div>

      {error && (
        <div
          className="mb-4 px-3 py-2 rounded-md text-[12.5px]"
          style={{ background: "#fee2e2", color: "#991b1b", border: "1px solid #fca5a5" }}
        >
          {error}
        </div>
      )}

      <div className="rounded-lg overflow-auto flex-1 min-h-0" style={{ border: "1px solid var(--border)" }}>
        <table className="text-[12.5px] border-collapse w-full">
          <thead className="sticky top-0 z-10">
            <tr>
              <th
                className="px-3 py-2 font-medium sticky top-0 text-left"
                style={{ color: "var(--text-secondary)", background: "var(--surface-muted)" }}
              >
                Nama File
              </th>
              <th
                className="px-3 py-2 font-medium sticky top-0 text-left whitespace-nowrap"
                style={{ color: "var(--text-secondary)", background: "var(--surface-muted)", width: 170 }}
              >
                Waktu Dibuat
              </th>
              <th
                className="px-3 py-2 font-medium sticky top-0 text-right whitespace-nowrap"
                style={{ color: "var(--text-secondary)", background: "var(--surface-muted)", width: 90 }}
              >
                Ukuran
              </th>
              <th
                className="px-3 py-2 font-medium sticky top-0 text-center whitespace-nowrap"
                style={{ color: "var(--text-secondary)", background: "var(--surface-muted)", width: 140 }}
              >
                Aksi
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center" style={{ color: "var(--text-muted)" }}>
                  Memuat...
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center" style={{ color: "var(--text-muted)" }}>
                  Belum ada backup. Klik &quot;Backup Sekarang&quot; untuk membuat yang pertama.
                </td>
              </tr>
            )}
            {rows.map((b) => (
              <tr key={b.filename} style={{ borderTop: "1px solid var(--border)" }}>
                <td className="px-3 py-1.5 truncate max-w-0" title={b.filename}>
                  {b.filename}
                </td>
                <td className="px-3 py-1.5 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                  {formatDate(b.createdAt)}
                </td>
                <td className="px-3 py-1.5 text-right whitespace-nowrap font-mono-num" style={{ color: "var(--text-secondary)" }}>
                  {formatSize(b.sizeBytes)}
                </td>
                <td className="px-3 py-1.5 text-center whitespace-nowrap">
                  <a
                    href={`/api/backup/${encodeURIComponent(b.filename)}`}
                    className="text-[12px] font-medium mr-3"
                    style={{ color: "var(--accent)" }}
                  >
                    Unduh
                  </a>
                  <button
                    onClick={() => removeBackup(b.filename)}
                    className="text-[12px] cursor-pointer"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Hapus
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
