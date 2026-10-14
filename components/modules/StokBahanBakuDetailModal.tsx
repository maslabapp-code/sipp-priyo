"use client";

import { useEffect, useState } from "react";
type Usage = { id: string; batchId: string; partId: string | null; namaBarang: string | null; tanggal: string; qty: string; cutId: string | null };

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(n);
}

type Lain = { id: string; label: string; sisa: number; satuan: string };

export function StokBahanBakuDetailModal({
  batchId,
  namaBahanBaku,
  qtyMasuk,
  satuanStok,
  kedatanganLain,
  onClose,
  onChanged,
}: {
  batchId: string;
  rawMaterialId?: string;
  namaBahanBaku: string;
  qtyMasuk: number;
  satuanStok?: string;
  kedatanganLain: Lain[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [usages, setUsages] = useState<Usage[]>([]);
  const [loading, setLoading] = useState(true);
  const [pesan, setPesan] = useState("");
  const [bekerja, setBekerja] = useState(false);

  async function load() {
    setLoading(true);
    const uRes = await fetch(`/api/raw-material-usages?batchId=${batchId}`);
    setUsages((await uRes.json()).reverse());
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId]);

  const totalTerpakai = usages.reduce((s, u) => s + Number(u.qty), 0);
  const sisa = qtyMasuk - totalTerpakai;

  // Pindahkan satu pemakaian ke kedatangan lain dari bahan baku yang sama
  async function pindah(usageId: string, tujuanId: string) {
    if (!tujuanId) return;
    setPesan("");
    const res = await fetch(`/api/raw-material-usages/${usageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batchId: tujuanId }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setPesan(d.error || "Gagal memindahkan.");
      return;
    }
    await load();
    onChanged();
  }

  // Kompensasi otomatis: pindahkan pemakaian terbaru ke kedatangan lain yang masih ada sisa sampai tidak minus
  async function kompensasi() {
    setPesan("");
    setBekerja(true);
    const res = await fetch(`/api/raw-material-batches/${batchId}/kompensasi`, { method: "POST" });
    setBekerja(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setPesan(d.error || "Gagal melakukan kompensasi.");
      return;
    }
    setPesan(
      d.masihKurang > 0
        ? `Dipindahkan ${fmt(d.dipindah)} ${d.satuan}. Masih kurang ${fmt(d.masihKurang)} ${d.satuan}, kedatangan lain tidak cukup. Cek qty kedatangan.`
        : `Selesai: ${fmt(d.dipindah)} ${d.satuan} dipindahkan ke kedatangan lain.`
    );
    await load();
    onChanged();
  }

  const punyaTujuan = kedatanganLain.some((k) => k.sisa > 0);

  async function removeUsage(id: string) {
    if (!confirm("Hapus catatan pemakaian manual lama ini?")) return;
    const res = await fetch(`/api/raw-material-usages/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error || "Gagal menghapus.");
      return;
    }
    setUsages((u) => u.filter((x) => x.id !== id));
    onChanged();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(15, 20, 28, 0.5)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[92vw] max-w-[1400px] rounded-xl overflow-hidden flex flex-col"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", maxHeight: "85vh" }}
      >
        <div className="px-5 py-3.5 flex items-center justify-between shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div>
            <div className="text-[13.5px] font-semibold">{namaBahanBaku}</div>
            <div className="text-[12px] font-mono-num" style={{ color: "var(--text-secondary)" }}>
              Qty Masuk {fmt(qtyMasuk)} · Terpakai {fmt(totalTerpakai)} · Sisa{" "}
              <span style={{ color: sisa > 0 ? "var(--success)" : "var(--danger)" }}>{fmt(sisa)}</span>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-md cursor-pointer flex items-center justify-center" style={{ color: "var(--text-muted)" }}>
            ×
          </button>
        </div>

        <div className="p-3 flex-1 overflow-auto">
          <div className="mb-3 px-3 py-2 rounded-md text-[11.5px]" style={{ background: "var(--surface-muted)", color: "var(--text-secondary)" }}>
            Pemakaian tercatat otomatis dari catatan potong di menu Produksi, jadi qty tidak diubah di sini. Yang bisa dilakukan hanya memindahkan pemakaian ke kedatangan lain.
          </div>

          {sisa < 0 && (
            <div className="mb-3 px-3 py-2 rounded-md text-[12px]" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
              Sisa kedatangan ini minus {fmt(-sisa)} {satuanStok ?? ""}. Kemungkinan qty kedatangan salah input, atau pembatas batch salah.
              {punyaTujuan ? (
                <div className="mt-1.5">
                  <button
                    onClick={kompensasi}
                    disabled={bekerja}
                    className="h-7 px-3 rounded-md text-[12px] font-medium text-white cursor-pointer disabled:opacity-50"
                    style={{ background: "var(--accent)" }}
                  >
                    {bekerja ? "Memproses..." : "Kompensasi otomatis dari kedatangan lain"}
                  </button>
                </div>
              ) : (
                <div className="mt-1" style={{ color: "var(--text-secondary)" }}>Tidak ada kedatangan lain yang masih punya sisa.</div>
              )}
            </div>
          )}
          {pesan && (
            <div className="mb-3 px-3 py-2 rounded-md text-[12px]" style={{ background: "var(--surface-muted)", color: "var(--text-secondary)" }}>{pesan}</div>
          )}

          <table className="w-full text-[12px] border-collapse">
            <thead>
              <tr style={{ background: "var(--surface-muted)" }}>
                <th className="px-2 py-1.5 text-left font-medium" style={{ color: "var(--text-secondary)" }}>Tanggal</th>
                <th className="px-2 py-1.5 text-right font-medium" style={{ color: "var(--text-secondary)" }}>Qty</th>
                <th className="px-2 py-1.5 text-left font-medium" style={{ color: "var(--text-secondary)" }}>Dipakai untuk</th>
                <th className="px-2 py-1.5 text-left font-medium" style={{ color: "var(--text-secondary)" }}>Sumber</th>
                <th className="w-40"></th>
              </tr>
            </thead>
            <tbody>
              {!loading && usages.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-2 py-4 text-center" style={{ color: "var(--text-muted)" }}>
                    Belum ada catatan pemakaian.
                  </td>
                </tr>
              )}
              {usages.map((u) => (
                <tr key={u.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td className="px-2 py-1 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>{fmtDate(u.tanggal)}</td>
                  <td className="px-2 py-1 text-right font-mono-num">{fmt(Number(u.qty))}</td>
                  <td className="px-2 py-1">{u.namaBarang ?? <span style={{ color: "var(--text-muted)" }}>—</span>}</td>
                  <td className="px-2 py-1" style={{ color: u.cutId ? "var(--accent)" : "var(--text-muted)" }}>
                    {u.cutId ? "Produksi" : "Manual (lama)"}
                  </td>
                  <td className="text-center whitespace-nowrap">
                    {kedatanganLain.length > 0 && (
                      <select
                        value=""
                        onChange={(e) => pindah(u.id, e.target.value)}
                        className="h-6 px-1 rounded text-[11px] mr-1"
                        style={{ background: "var(--surface)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
                        title="Pindahkan pemakaian ini ke kedatangan lain"
                      >
                        <option value="">Pindah ke...</option>
                        {kedatanganLain.map((k) => (
                          <option key={k.id} value={k.id}>
                            {k.label} · sisa {fmt(k.sisa)} {k.satuan}
                          </option>
                        ))}
                      </select>
                    )}
                    {!u.cutId && (
                      <button onClick={() => removeUsage(u.id)} className="w-5 h-5 rounded cursor-pointer" style={{ color: "var(--text-muted)" }} title="Hapus catatan manual lama">×</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
