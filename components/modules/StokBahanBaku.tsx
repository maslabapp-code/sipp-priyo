"use client";

import { useEffect, useState } from "react";
import { useAutoRefresh } from "@/components/layout/DataSync";
import { SortableTh } from "../ui/SortableTh";
import { useTableControls } from "@/lib/hooks/useTableControls";
import { StokBahanBakuDetailModal } from "./StokBahanBakuDetailModal";
import { SearchableSelect } from "../ui/SearchableSelect";
import { uniqueOptions } from "@/lib/unique-options";
import { QuickAddMaterial } from "../ui/QuickAddModal";
import { ExportButton } from "../ui/ExportButton";

type Row = {
  id: string;
  rawMaterialId: string;
  namaBahanBaku: string;
  satuan: string | null;
  tanggal: string;
  qty: string;
  qty2: string | null;
  satuan2: string | null;
  noSj: string | null;
  customerNama: string | null;
  sumber: string; // sj | stok_awal
  catatan: string | null;
  qtyStok: number;
  satuanStok: string;
  totalTerpakai: number;
  sisa: number;
  sisaKg: number | null;
  jumlahCatatanPakai: number;
};
type RawMaterial = { id: string; nama: string; satuan: string | null; jenis: string };

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(n);
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export function StokBahanBaku() {
  const [rows, setRows] = useState<Row[]>([]);
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailBatch, setDetailBatch] = useState<Row | null>(null);
  const blankAwal = { tanggal: todayInputValue(), rawMaterialId: "", qty: "", qty2: "", satuan2: "Pita", catatan: "" };
  const [showAwal, setShowAwal] = useState(false);
  const [awal, setAwal] = useState(blankAwal);
  const [awalError, setAwalError] = useState("");
  const [quickMat, setQuickMat] = useState<string | null>(null);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    const [res, matRes] = await Promise.all([
      fetch("/api/raw-material/summary"),
      fetch("/api/raw-materials"),
    ]);
    setRows(await res.json());
    setMaterials(await matRes.json());
    if (!silent) setLoading(false);
  }

  useAutoRefresh(() => load(true));

  useEffect(() => {
    load();
  }, []);

  const { filteredSorted, filters, setFilter, sortKey, sortDir, toggleSort } = useTableControls<Row>(rows, {
    namaBahanBaku: (r) => r.namaBahanBaku,
    qty: (r) => Number(r.qty),
    totalTerpakai: (r) => r.totalTerpakai,
    sisa: (r) => r.sisa,
  });

  const awalMat = materials.find((m) => m.id === awal.rawMaterialId);
  const awalPerluQty2 = awalMat?.jenis === "lembaran" || awalMat?.jenis === "sheet_pita";

  async function addStokAwal() {
    setAwalError("");
    if (!awal.rawMaterialId || !(Number(awal.qty) > 0)) {
      setAwalError("Pilih bahan baku dan isi qty lebih dari 0.");
      return;
    }
    if (awalPerluQty2 && !(Number(awal.qty2) > 0)) {
      setAwalError("Jumlah pita/lembar wajib diisi untuk bahan baku ini.");
      return;
    }
    if (!awal.catatan.trim()) {
      setAwalError("Keterangan wajib diisi, mis. stok awal pemakaian aplikasi atau koreksi hasil hitung fisik.");
      return;
    }
    const res = await fetch("/api/raw-material-batches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tanggal: awal.tanggal,
        rawMaterialId: awal.rawMaterialId,
        qty: Number(awal.qty),
        qty2: awal.qty2 ? Number(awal.qty2) : null,
        satuan2: awal.qty2 ? awal.satuan2 : null,
        catatan: awal.catatan,
      }),
    });
    if (res.ok) {
      setAwal(blankAwal);
      setShowAwal(false);
      load();
    } else {
      const d = await res.json().catch(() => ({}));
      setAwalError(d.error || "Gagal menyimpan stok awal.");
    }
  }

  async function removeBatch(id: string) {
    if (!confirm("Hapus stok ini?")) return;
    const res = await fetch(`/api/raw-material-batches/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error || "Gagal menghapus.");
      return;
    }
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
          <h1 className="text-[15px] font-semibold">Stok Bahan Baku</h1>
          <p className="text-[12.5px]" style={{ color: "var(--text-secondary)" }}>
            {filteredSorted.length} / {rows.length} kedatangan. Kedatangan masuk lewat Surat Jalan Masuk, pemakaian tercatat otomatis dari Produksi.
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button onClick={() => setShowAwal((v) => !v)} className="h-8 px-3 rounded-md text-[12.5px] font-medium cursor-pointer" style={{ border: "1px solid var(--border)", color: "var(--accent)" }}>
            {showAwal ? "Tutup Stok Awal" : "+ Stok Awal / Koreksi"}
          </button>
          <ExportButton baseUrl="/api/export/stok-bahan-baku" />
        </div>
      </div>

      {showAwal && (
        <div className="mb-3 p-3 rounded-lg shrink-0" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="text-[12.5px] font-medium mb-0.5">Stok Awal / Koreksi</div>
          <div className="text-[11.5px] mb-2" style={{ color: "var(--text-secondary)" }}>
            Untuk stok awal saat mulai memakai aplikasi, atau koreksi hasil hitung fisik. Material yang datang dari CPL dicatat lewat Surat Jalan Masuk, bukan di sini.
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-6 gap-2 mb-2">
            <input type="date" value={awal.tanggal} onChange={(e) => setAwal((s) => ({ ...s, tanggal: e.target.value }))} className="h-8 px-2 rounded-md text-[12.5px]" style={inputStyle} />
            <div className="sm:col-span-2">
              <SearchableSelect
                options={materials.map((m) => ({ value: m.id, label: m.nama }))}
                value={awal.rawMaterialId}
                onChange={(v) => setAwal((s) => ({ ...s, rawMaterialId: v }))}
                placeholder="Pilih bahan baku..."
                onCreate={(t) => setQuickMat(t)}
                createLabel="bahan baku"
              />
            </div>
            <input type="number" placeholder={`Qty (${awalMat?.satuan ?? "Kg"})`} value={awal.qty} onChange={(e) => setAwal((s) => ({ ...s, qty: e.target.value }))} className="h-8 px-2 rounded-md text-[12.5px] font-mono-num" style={inputStyle} />
            <input type="number" placeholder={awalPerluQty2 ? "Jumlah pita/lembar (wajib)" : "Pita/lembar (opsional)"} value={awal.qty2} onChange={(e) => setAwal((s) => ({ ...s, qty2: e.target.value }))} className="h-8 px-2 rounded-md text-[12.5px] font-mono-num" style={inputStyle} />
            <select value={awal.satuan2} onChange={(e) => setAwal((s) => ({ ...s, satuan2: e.target.value }))} className="h-8 px-2 rounded-md text-[12.5px]" style={inputStyle}>
              <option value="Pita">Pita</option>
              <option value="Lembar">Lembar</option>
            </select>
          </div>
          <div className="flex gap-2 items-center">
            <input value={awal.catatan} onChange={(e) => setAwal((s) => ({ ...s, catatan: e.target.value }))} placeholder="Keterangan (wajib): stok awal pemakaian aplikasi / koreksi hasil hitung fisik..." className="flex-1 h-8 px-2 rounded-md text-[12.5px]" style={inputStyle} />
            <button onClick={addStokAwal} className="h-8 px-4 rounded-md text-[12.5px] font-medium text-white cursor-pointer" style={{ background: "var(--accent)" }}>Simpan</button>
          </div>
          {awalError && <div className="text-[12px] mt-2" style={{ color: "var(--danger)" }}>{awalError}</div>}
        </div>
      )}

      {quickMat !== null && (
        <QuickAddMaterial
          initialName={quickMat}
          existing={materials}
          onClose={() => setQuickMat(null)}
          onCreated={(row) => {
            const m: RawMaterial = { id: row.id, nama: row.nama, satuan: (row.satuan as string | null) ?? null, jenis: (row.jenis as string) ?? "lembaran" };
            setMaterials((list) => (list.some((x) => x.id === m.id) ? list : [...list, m]));
            setAwal((s) => ({ ...s, rawMaterialId: m.id }));
            setQuickMat(null);
          }}
        />
      )}

      {materials.length === 0 && !loading && (
        <div className="mb-3 px-3 py-2 rounded-md text-[12.5px]" style={{ background: "var(--warn-soft)", color: "var(--warn)" }}>
          Belum ada Master Bahan Baku. Tambahkan dulu di menu "Master Bahan Baku" (atau impor lewat Master Part) sebelum mencatat kedatangan.
        </div>
      )}

      <div className="rounded-lg overflow-auto flex-1 min-h-0" style={{ border: "1px solid var(--border)" }}>
        <table className="text-[12.5px] border-collapse w-full">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="px-2 py-2 font-medium sticky top-0 text-left" style={{ color: "var(--text-secondary)", background: "var(--surface-muted)", minWidth: 44 }}>No</th>
              <th className="px-2 py-2 font-medium sticky top-0 text-left" style={{ color: "var(--text-secondary)", background: "var(--surface-muted)", minWidth: 100 }}>Tanggal</th>
              <SortableTh label="Nama Bahan Baku" active={sortKey === "namaBahanBaku"} dir={sortDir} onClick={() => toggleSort("namaBahanBaku")} width={220} />
              <th className="px-2 py-2 font-medium sticky top-0 text-left" style={{ color: "var(--text-secondary)", background: "var(--surface-muted)", minWidth: 150 }}>No. SJ / Asal</th>
              <SortableTh label="Qty Masuk" align="right" active={sortKey === "qty"} dir={sortDir} onClick={() => toggleSort("qty")} width={95} />
              <SortableTh label="Terpakai" align="right" active={sortKey === "totalTerpakai"} dir={sortDir} onClick={() => toggleSort("totalTerpakai")} width={95} />
              <SortableTh label="Sisa" align="right" active={sortKey === "sisa"} dir={sortDir} onClick={() => toggleSort("sisa")} width={95} />
              <th className="sticky top-0" style={{ background: "var(--surface-muted)", minWidth: 90 }}></th>
            </tr>
            <tr style={{ background: "var(--surface)" }}>
              <td className="px-1 py-1" style={{ borderBottom: "1px solid var(--border)" }}></td>
              <td className="px-1 py-1" style={{ borderBottom: "1px solid var(--border)" }}></td>
              <td className="px-1 py-1" style={{ borderBottom: "1px solid var(--border)" }}>
                <SearchableSelect options={uniqueOptions(rows, (r) => r.namaBahanBaku)} value={filters.namaBahanBaku ?? ""} onChange={(v) => setFilter("namaBahanBaku", v)} placeholder="Cari..." size="sm" />
              </td>
              <td className="px-1 py-1" style={{ borderBottom: "1px solid var(--border)" }}></td>
              <td className="px-1 py-1" style={{ borderBottom: "1px solid var(--border)" }}></td>
              <td className="px-1 py-1" style={{ borderBottom: "1px solid var(--border)" }}></td>
              <td className="px-1 py-1" style={{ borderBottom: "1px solid var(--border)" }}></td>
              <td className="px-1 py-1" style={{ borderBottom: "1px solid var(--border)" }}></td>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} className="px-3 py-6 text-center" style={{ color: "var(--text-muted)" }}>Memuat...</td></tr>
            )}
            {!loading && filteredSorted.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-6 text-center" style={{ color: "var(--text-muted)" }}>
                {rows.length === 0 ? "Belum ada kedatangan. Catat lewat Surat Jalan Masuk, atau Stok Awal untuk stok yang sudah ada." : "Tidak ada hasil pencarian."}
              </td></tr>
            )}
            {filteredSorted.map((r, idx) => (
              <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td className="px-2 py-1.5 font-mono-num" style={{ color: "var(--text-muted)" }}>{idx + 1}</td>
                <td className="px-2 py-1.5 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>{fmtDate(r.tanggal)}</td>
                <td className="px-2 py-1.5 truncate" title={r.namaBahanBaku}>
                  {r.namaBahanBaku}
                  {r.satuan && <span className="ml-1" style={{ color: "var(--text-muted)" }}>({r.satuan})</span>}
                </td>
                <td className="px-2 py-1.5 text-[11.5px]" style={{ color: "var(--text-secondary)" }}>
                  {r.sumber === "sj" ? (
                    <>
                      <span className="font-mono-num">{r.noSj ?? "—"}</span>
                      {r.customerNama && <div style={{ color: "var(--text-muted)" }}>{r.customerNama}</div>}
                    </>
                  ) : (
                    <>
                      <span className="font-medium" style={{ color: "var(--warn)" }}>Stok Awal / Koreksi</span>
                      {r.catatan && <div style={{ color: "var(--text-muted)" }}>{r.catatan}</div>}
                    </>
                  )}
                </td>
                <td className="px-2 py-1.5 text-right font-mono-num">
                  {fmt(Number(r.qty))}
                  {r.qty2 && <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>{fmt(Number(r.qty2))} {r.satuan2}</div>}
                </td>
                <td className="px-2 py-1.5 text-right font-mono-num">
                  {fmt(r.totalTerpakai)}
                  {r.satuanStok && <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>{r.satuanStok}</div>}
                </td>
                <td className="px-2 py-1.5 text-right font-mono-num font-medium" style={{ color: r.sisa > 0 ? "var(--success)" : "var(--danger)" }}>
                  {fmt(r.sisa)}
                  {r.satuanStok && <div className="text-[11px] font-normal" style={{ color: "var(--text-muted)" }}>{r.satuanStok}</div>}
                  {r.sisaKg != null && <div className="text-[11px] font-normal" style={{ color: "var(--text-muted)" }}>≈ {fmt(r.sisaKg)} Kg</div>}
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
        <StokBahanBakuDetailModal
          batchId={detailBatch.id}
          rawMaterialId={detailBatch.rawMaterialId}
          namaBahanBaku={detailBatch.namaBahanBaku}
          qtyMasuk={detailBatch.qtyStok}
          satuanStok={detailBatch.satuanStok}
          kedatanganLain={rows
            .filter((r) => r.rawMaterialId === detailBatch.rawMaterialId && r.id !== detailBatch.id)
            .map((r) => ({ id: r.id, label: r.noSj ?? "Stok Awal / Koreksi", sisa: r.sisa, satuan: r.satuanStok }))}
          onClose={() => setDetailBatch(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}
