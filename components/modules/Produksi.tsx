"use client";

import { useEffect, useMemo, useState } from "react";
import { useAutoRefresh } from "@/components/layout/DataSync";
import { SortableTh } from "../ui/SortableTh";
import { useTableControls } from "@/lib/hooks/useTableControls";
import { ProductionDetailModal } from "./ProductionDetailModal";
import { ExportButton } from "../ui/ExportButton";
import { SearchableSelect } from "../ui/SearchableSelect";
import { uniqueOptions } from "@/lib/unique-options";

type Row = {
  id: string;
  kodePart: string | null;
  namaBarang: string;
  kategori: string | null;
  customerNama: string | null;
  totalPotong: number;
  totalKirim: number;
  sisaStok: number;
  jumlahCatatanPotong: number;
  jumlahCatatanKirim: number;
};

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(n);
}

export function Produksi() {
  const [rows, setRows] = useState<Row[]>([]);
  const [allKategori, setAllKategori] = useState<string[]>([]);
  const [kategori, setKategori] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailPart, setDetailPart] = useState<Row | null>(null);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    const qs = kategori ? `?kategori=${encodeURIComponent(kategori)}` : "";
    const res = await fetch(`/api/production/summary${qs}`);
    setRows(await res.json());
    if (!silent) setLoading(false);
  }

  async function loadKategoriList() {
    const res = await fetch("/api/parts");
    const parts: { kategori: string | null }[] = await res.json();
    const uniq = Array.from(new Set(parts.map((p) => p.kategori).filter(Boolean))) as string[];
    setAllKategori(uniq.sort());
  }

  useEffect(() => {
    loadKategoriList();
  }, []);

  useAutoRefresh(async () => {
    await Promise.all([load(true), loadKategoriList()]);
  });

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kategori]);

  const { filteredSorted, filters, setFilter, sortKey, sortDir, toggleSort } = useTableControls<Row>(rows, {
    namaBarang: (r) => r.namaBarang,
    kodePart: (r) => r.kodePart,
    customerNama: (r) => r.customerNama,
    totalPotong: (r) => r.totalPotong,
    totalKirim: (r) => r.totalKirim,
    sisaStok: (r) => r.sisaStok,
  });

  const grandTotal = useMemo(
    () =>
      filteredSorted.reduce(
        (acc, r) => ({
          totalPotong: acc.totalPotong + r.totalPotong,
          totalKirim: acc.totalKirim + r.totalKirim,
          sisaStok: acc.sisaStok + r.sisaStok,
        }),
        { totalPotong: 0, totalKirim: 0, sisaStok: 0 }
      ),
    [filteredSorted]
  );

  const inputStyle: React.CSSProperties = {
    background: "var(--surface)",
    color: "var(--text-primary)",
    border: "1px solid var(--border)",
  };

  return (
    <div className="h-full flex flex-col p-5">
      <div className="flex items-end justify-between mb-4 gap-3 flex-wrap shrink-0">
        <div>
          <h1 className="text-[15px] font-semibold">Produksi / Potong Bahan Baku</h1>
          <p className="text-[12.5px]" style={{ color: "var(--text-secondary)" }}>
            {filteredSorted.length} / {rows.length} part — klik "Detail" untuk isi riwayat potong & kirim.
          </p>
        </div>

        <div className="flex items-center gap-2">
        <SearchableSelect
          options={[{ value: "", label: "Semua Kategori/Proses" }, ...allKategori.map((k) => ({ value: k, label: k }))]}
          value={kategori}
          onChange={setKategori}
          placeholder="Semua Kategori/Proses"
        />
        <ExportButton baseUrl="/api/export/produksi" params={kategori ? { kategori } : {}} />
        </div>
      </div>

      <div className="rounded-lg overflow-auto flex-1 min-h-0" style={{ border: "1px solid var(--border)" }}>
        <table className="text-[12.5px] border-collapse w-full">
          <thead className="sticky top-0 z-10">
            <tr>
              <th
                className="px-2 py-2 font-medium sticky top-0 text-left"
                style={{ color: "var(--text-secondary)", background: "var(--surface-muted)", minWidth: 44 }}
              >
                No
              </th>
              <SortableTh label="Nama Barang" active={sortKey === "namaBarang"} dir={sortDir} onClick={() => toggleSort("namaBarang")} width={200} />
              <SortableTh label="Kode Part" active={sortKey === "kodePart"} dir={sortDir} onClick={() => toggleSort("kodePart")} width={100} />
              <th
                className="px-2 py-2 font-medium sticky top-0 text-left"
                style={{ color: "var(--text-secondary)", background: "var(--surface-muted)", minWidth: 100 }}
              >
                Kategori
              </th>
              <SortableTh label="Customer" active={sortKey === "customerNama"} dir={sortDir} onClick={() => toggleSort("customerNama")} width={110} />
              <SortableTh label="Total Potong" align="right" active={sortKey === "totalPotong"} dir={sortDir} onClick={() => toggleSort("totalPotong")} width={110} />
              <SortableTh label="Total Kirim" align="right" active={sortKey === "totalKirim"} dir={sortDir} onClick={() => toggleSort("totalKirim")} width={105} />
              <SortableTh label="Sisa Stok" align="right" active={sortKey === "sisaStok"} dir={sortDir} onClick={() => toggleSort("sisaStok")} width={100} />
              <th className="sticky top-0" style={{ background: "var(--surface-muted)", minWidth: 70 }}></th>
            </tr>
            <tr style={{ background: "var(--surface)" }}>
              <td className="px-1 py-1" style={{ borderBottom: "1px solid var(--border)" }}></td>
              <td className="px-1 py-1" style={{ borderBottom: "1px solid var(--border)" }}>
                <SearchableSelect options={uniqueOptions(rows, (r) => r.namaBarang)} value={filters.namaBarang ?? ""} onChange={(v) => setFilter("namaBarang", v)} placeholder="Cari..." size="sm" />
              </td>
              <td className="px-1 py-1" style={{ borderBottom: "1px solid var(--border)" }}>
                <input value={filters.kodePart ?? ""} onChange={(e) => setFilter("kodePart", e.target.value)} placeholder="Cari..." className="w-full h-7 px-1.5 rounded text-[11.5px] outline-none" style={inputStyle} />
              </td>
              <td className="px-1 py-1" style={{ borderBottom: "1px solid var(--border)" }}></td>
              <td className="px-1 py-1" style={{ borderBottom: "1px solid var(--border)" }}>
                <SearchableSelect options={uniqueOptions(rows, (r) => r.customerNama)} value={filters.customerNama ?? ""} onChange={(v) => setFilter("customerNama", v)} placeholder="Cari..." size="sm" />
              </td>
              <td className="px-1 py-1" style={{ borderBottom: "1px solid var(--border)" }}></td>
              <td className="px-1 py-1" style={{ borderBottom: "1px solid var(--border)" }}></td>
              <td className="px-1 py-1" style={{ borderBottom: "1px solid var(--border)" }}></td>
              <td className="px-1 py-1" style={{ borderBottom: "1px solid var(--border)" }}></td>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center" style={{ color: "var(--text-muted)" }}>
                  Memuat...
                </td>
              </tr>
            )}
            {!loading && filteredSorted.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center" style={{ color: "var(--text-muted)" }}>
                  {rows.length === 0
                    ? "Belum ada part untuk kategori ini. Tambahkan kategori di Master Part dulu."
                    : "Tidak ada hasil pencarian."}
                </td>
              </tr>
            )}
            {filteredSorted.map((r, idx) => (
              <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td className="px-2 py-1.5 font-mono-num" style={{ color: "var(--text-muted)" }}>
                  {idx + 1}
                </td>
                <td className="px-2 py-1.5 truncate" title={r.namaBarang}>
                  {r.namaBarang}
                </td>
                <td className="px-2 py-1.5" style={{ color: "var(--text-secondary)" }}>
                  {r.kodePart ?? "—"}
                </td>
                <td className="px-2 py-1.5">
                  {r.kategori ? (
                    <span
                      className="px-1.5 py-0.5 rounded text-[11px]"
                      style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                    >
                      {r.kategori}
                    </span>
                  ) : (
                    <span style={{ color: "var(--text-muted)" }}>—</span>
                  )}
                </td>
                <td className="px-2 py-1.5 truncate" style={{ color: "var(--text-secondary)" }}>
                  {r.customerNama ?? "—"}
                </td>
                <td className="px-2 py-1.5 text-right font-mono-num">{fmt(r.totalPotong)}</td>
                <td className="px-2 py-1.5 text-right font-mono-num">{fmt(r.totalKirim)}</td>
                <td
                  className="px-2 py-1.5 text-right font-mono-num font-medium"
                  style={{ color: r.sisaStok > 0 ? "var(--warn)" : "var(--success)" }}
                >
                  {fmt(r.sisaStok)}
                </td>
                <td className="text-center">
                  <button
                    onClick={() => setDetailPart(r)}
                    className="h-6 px-2 rounded text-[11px] font-medium cursor-pointer"
                    style={{ border: "1px solid var(--border)", color: "var(--accent)" }}
                  >
                    Detail
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          {filteredSorted.length > 0 && (
            <tfoot className="sticky bottom-0 z-10">
              <tr style={{ background: "var(--surface-muted)", borderTop: "1px solid var(--border-strong)" }}>
                <td className="px-2 py-2 font-semibold" colSpan={5}>
                  Total ({filteredSorted.length} part)
                </td>
                <td className="px-2 py-2 text-right font-mono-num font-semibold">{fmt(grandTotal.totalPotong)}</td>
                <td className="px-2 py-2 text-right font-mono-num font-semibold">{fmt(grandTotal.totalKirim)}</td>
                <td className="px-2 py-2 text-right font-mono-num font-semibold">{fmt(grandTotal.sisaStok)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {detailPart && (
        <ProductionDetailModal
          partId={detailPart.id}
          namaBarang={detailPart.namaBarang}
          onClose={() => setDetailPart(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}
