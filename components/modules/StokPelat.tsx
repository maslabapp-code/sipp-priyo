"use client";

import { useEffect, useState } from "react";
import { SortableTh } from "../ui/SortableTh";
import { useTableControls } from "@/lib/hooks/useTableControls";
import { StokPelatDetailModal } from "./StokPelatDetailModal";
import { SearchableSelect } from "../ui/SearchableSelect";
import { uniqueOptions } from "@/lib/unique-options";

type Row = {
  id: string;
  tanggal: string;
  namaBarang: string;
  qty: string;
  totalTerpakai: number;
  sisa: number;
  jumlahCatatanPakai: number;
};

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(n);
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export function StokPelat() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailBatch, setDetailBatch] = useState<Row | null>(null);
  const [newBatch, setNewBatch] = useState({ tanggal: todayInputValue(), namaBarang: "", qty: "" });

  async function load() {
    setLoading(true);
    const res = await fetch("/api/raw-material/summary");
    setRows(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const { filteredSorted, filters, setFilter, sortKey, sortDir, toggleSort } = useTableControls<Row>(rows, {
    namaBarang: (r) => r.namaBarang,
    qty: (r) => Number(r.qty),
    totalTerpakai: (r) => r.totalTerpakai,
    sisa: (r) => r.sisa,
  });

  async function addBatch() {
    if (!newBatch.namaBarang || !newBatch.qty) return;
    const res = await fetch("/api/raw-material-batches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newBatch),
    });
    if (res.ok) {
      const row = await res.json();
      setRows((r) => [{ ...row, totalTerpakai: 0, sisa: Number(row.qty), jumlahCatatanPakai: 0 }, ...r]);
      setNewBatch({ tanggal: todayInputValue(), namaBarang: "", qty: "" });
    }
  }

  async function removeBatch(id: string) {
    if (!confirm("Hapus batch pelat ini? Semua riwayat pemakaiannya ikut terhapus.")) return;
    await fetch(`/api/raw-material-batches/${id}`, { method: "DELETE" });
    setRows((r) => r.filter((x) => x.id !== id));
  }

  const inputStyle: React.CSSProperties = {
    background: "var(--surface)",
    color: "var(--text-primary)",
    border: "1px solid var(--border)",
  };

  return (
    <div className="h-full flex flex-col p-5">
      <div className="flex items-end justify-between mb-4 gap-3 flex-wrap shrink-0">
        <div>
          <h1 className="text-[15px] font-semibold">Stok Pelat</h1>
          <p className="text-[12.5px]" style={{ color: "var(--text-secondary)" }}>
            {filteredSorted.length} / {rows.length} batch bahan baku. Klik "Detail" untuk isi pemakaian.
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <input type="date" value={newBatch.tanggal} onChange={(e) => setNewBatch((s) => ({ ...s, tanggal: e.target.value }))} className="h-8 px-2 rounded-md text-[12.5px]" style={inputStyle} />
          <input type="text" placeholder="Nama pelat..." value={newBatch.namaBarang} onChange={(e) => setNewBatch((s) => ({ ...s, namaBarang: e.target.value }))} className="h-8 px-2 rounded-md text-[12.5px] w-40" style={inputStyle} />
          <input type="number" placeholder="Qty" value={newBatch.qty} onChange={(e) => setNewBatch((s) => ({ ...s, qty: e.target.value }))} className="h-8 px-2 rounded-md text-[12.5px] w-20 font-mono-num" style={inputStyle} />
          <button onClick={addBatch} className="h-8 px-3 rounded-md text-[12.5px] font-medium text-white cursor-pointer" style={{ background: "var(--accent)" }}>
            + Tambah
          </button>
        </div>
      </div>

      <div className="rounded-lg overflow-auto flex-1 min-h-0" style={{ border: "1px solid var(--border)" }}>
        <table className="text-[12.5px] border-collapse w-full">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="px-2 py-2 font-medium sticky top-0 text-left" style={{ color: "var(--text-secondary)", background: "var(--surface-muted)", minWidth: 44 }}>No</th>
              <th className="px-2 py-2 font-medium sticky top-0 text-left" style={{ color: "var(--text-secondary)", background: "var(--surface-muted)", minWidth: 100 }}>Tanggal</th>
              <SortableTh label="Nama Barang" active={sortKey === "namaBarang"} dir={sortDir} onClick={() => toggleSort("namaBarang")} width={220} />
              <SortableTh label="Qty Masuk" align="right" active={sortKey === "qty"} dir={sortDir} onClick={() => toggleSort("qty")} width={95} />
              <SortableTh label="Terpakai" align="right" active={sortKey === "totalTerpakai"} dir={sortDir} onClick={() => toggleSort("totalTerpakai")} width={95} />
              <SortableTh label="Sisa" align="right" active={sortKey === "sisa"} dir={sortDir} onClick={() => toggleSort("sisa")} width={95} />
              <th className="sticky top-0" style={{ background: "var(--surface-muted)", minWidth: 90 }}></th>
            </tr>
            <tr style={{ background: "var(--surface)" }}>
              <td className="px-1 py-1" style={{ borderBottom: "1px solid var(--border)" }}></td>
              <td className="px-1 py-1" style={{ borderBottom: "1px solid var(--border)" }}></td>
              <td className="px-1 py-1" style={{ borderBottom: "1px solid var(--border)" }}>
                <SearchableSelect options={uniqueOptions(rows, (r) => r.namaBarang)} value={filters.namaBarang ?? ""} onChange={(v) => setFilter("namaBarang", v)} placeholder="Cari..." size="sm" />
              </td>
              <td className="px-1 py-1" style={{ borderBottom: "1px solid var(--border)" }}></td>
              <td className="px-1 py-1" style={{ borderBottom: "1px solid var(--border)" }}></td>
              <td className="px-1 py-1" style={{ borderBottom: "1px solid var(--border)" }}></td>
              <td className="px-1 py-1" style={{ borderBottom: "1px solid var(--border)" }}></td>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className="px-3 py-6 text-center" style={{ color: "var(--text-muted)" }}>Memuat...</td></tr>
            )}
            {!loading && filteredSorted.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center" style={{ color: "var(--text-muted)" }}>
                {rows.length === 0 ? 'Belum ada batch pelat. Tambahkan lewat form di atas.' : "Tidak ada hasil pencarian."}
              </td></tr>
            )}
            {filteredSorted.map((r, idx) => (
              <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td className="px-2 py-1.5 font-mono-num" style={{ color: "var(--text-muted)" }}>{idx + 1}</td>
                <td className="px-2 py-1.5 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>{fmtDate(r.tanggal)}</td>
                <td className="px-2 py-1.5 truncate" title={r.namaBarang}>{r.namaBarang}</td>
                <td className="px-2 py-1.5 text-right font-mono-num">{fmt(Number(r.qty))}</td>
                <td className="px-2 py-1.5 text-right font-mono-num">{fmt(r.totalTerpakai)}</td>
                <td className="px-2 py-1.5 text-right font-mono-num font-medium" style={{ color: r.sisa > 0 ? "var(--success)" : "var(--danger)" }}>
                  {fmt(r.sisa)}
                </td>
                <td className="text-center whitespace-nowrap">
                  <button onClick={() => setDetailBatch(r)} className="h-6 px-2 rounded text-[11px] font-medium cursor-pointer" style={{ border: "1px solid var(--border)", color: "var(--accent)" }}>
                    Detail
                  </button>{" "}
                  <button onClick={() => removeBatch(r.id)} className="w-6 h-6 rounded cursor-pointer" style={{ color: "var(--text-muted)" }} title="Hapus">×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detailBatch && (
        <StokPelatDetailModal
          batchId={detailBatch.id}
          namaBarang={detailBatch.namaBarang}
          qtyMasuk={Number(detailBatch.qty)}
          onClose={() => setDetailBatch(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}
