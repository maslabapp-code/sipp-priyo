"use client";

import { useEffect, useState } from "react";
import { useAutoRefresh } from "@/components/layout/DataSync";
import { SortableTh } from "../ui/SortableTh";
import { useTableControls } from "@/lib/hooks/useTableControls";
import { ExportButton } from "../ui/ExportButton";
import { SearchableSelect } from "../ui/SearchableSelect";
import { uniqueOptions } from "@/lib/unique-options";

type Row = {
  id: string;
  noPo: string | null;
  namaBarang: string;
  customerNama: string | null;
  bulan: number;
  tahun: number;
  totalPo: number;
  kirim: number;
  sisaPo: number;
};

const BULAN_LABEL = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(n);
}

export function OutstandingPO() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlyThisMonth, setOnlyThisMonth] = useState(false);
  const now = new Date();

  async function load(silent = false) {
    if (!silent) setLoading(true);
    const qs = onlyThisMonth ? `?bulan=${now.getMonth() + 1}&tahun=${now.getFullYear()}` : "";
    const res = await fetch(`/api/outstanding-po${qs}`);
    setRows(await res.json());
    if (!silent) setLoading(false);
  }

  useAutoRefresh(() => load(true));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlyThisMonth]);

  const { filteredSorted, filters, setFilter, sortKey, sortDir, toggleSort } = useTableControls<Row>(rows, {
    noPo: (r) => r.noPo,
    namaBarang: (r) => r.namaBarang,
    customerNama: (r) => r.customerNama,
    sisaPo: (r) => r.sisaPo,
  });

  const totalSisa = filteredSorted.reduce((s, r) => s + r.sisaPo, 0);

  const inputStyle: React.CSSProperties = {
    background: "var(--surface)",
    color: "var(--text-primary)",
    border: "1px solid var(--border)",
  };

  return (
    <div className="h-full flex flex-col p-5">
      <div className="flex items-end justify-between mb-4 gap-3 flex-wrap shrink-0">
        <div>
          <h1 className="text-[15px] font-semibold">Outstanding PO</h1>
          <p className="text-[12.5px]" style={{ color: "var(--text-secondary)" }}>
            {filteredSorted.length} PO belum lunas terkirim (Sisa PO &gt; 0).
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-[12.5px] cursor-pointer" style={{ color: "var(--text-secondary)" }}>
            <input type="checkbox" checked={onlyThisMonth} onChange={(e) => setOnlyThisMonth(e.target.checked)} />
            Bulan ini saja ({BULAN_LABEL[now.getMonth()]} {now.getFullYear()})
          </label>
          <ExportButton baseUrl="/api/export/outstanding-po" />
        </div>
      </div>

      <div
        className="mb-3 px-3 py-2 rounded-md text-[12px]"
        style={{ background: "var(--warn-soft)", color: "var(--warn)" }}
      >
        Catatan: 1 No. PO berlaku untuk 1 bulan. Kalau tidak lunas sampai akhir bulan, PO dianggap
        hangus dan bulan berikutnya dimulai dengan PO baru (tidak otomatis nyambung ke bulan depan).
      </div>

      <div className="rounded-lg overflow-auto flex-1 min-h-0" style={{ border: "1px solid var(--border)" }}>
        <table className="text-[12.5px] border-collapse w-full">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="px-2 py-2 font-medium sticky top-0 text-left" style={{ color: "var(--text-secondary)", background: "var(--surface-muted)", minWidth: 44 }}>No</th>
              <SortableTh label="No. PO" active={sortKey === "noPo"} dir={sortDir} onClick={() => toggleSort("noPo")} width={110} />
              <SortableTh label="Nama Part" active={sortKey === "namaBarang"} dir={sortDir} onClick={() => toggleSort("namaBarang")} width={200} />
              <SortableTh label="Customer" active={sortKey === "customerNama"} dir={sortDir} onClick={() => toggleSort("customerNama")} width={110} />
              <th className="px-2 py-2 font-medium sticky top-0 text-left" style={{ color: "var(--text-secondary)", background: "var(--surface-muted)", minWidth: 90 }}>Bulan</th>
              <th className="px-2 py-2 font-medium sticky top-0 text-right" style={{ color: "var(--text-secondary)", background: "var(--surface-muted)", minWidth: 85 }}>Total PO</th>
              <th className="px-2 py-2 font-medium sticky top-0 text-right" style={{ color: "var(--text-secondary)", background: "var(--surface-muted)", minWidth: 85 }}>Kirim</th>
              <SortableTh label="Sisa PO" align="right" active={sortKey === "sisaPo"} dir={sortDir} onClick={() => toggleSort("sisaPo")} width={95} />
            </tr>
            <tr style={{ background: "var(--surface)" }}>
              <td className="px-1 py-1" style={{ borderBottom: "1px solid var(--border)" }}></td>
              <td className="px-1 py-1" style={{ borderBottom: "1px solid var(--border)" }}>
                <input value={filters.noPo ?? ""} onChange={(e) => setFilter("noPo", e.target.value)} placeholder="Cari..." className="w-full h-7 px-1.5 rounded text-[11.5px] outline-none" style={inputStyle} />
              </td>
              <td className="px-1 py-1" style={{ borderBottom: "1px solid var(--border)" }}>
                <SearchableSelect options={uniqueOptions(rows, (r) => r.namaBarang)} value={filters.namaBarang ?? ""} onChange={(v) => setFilter("namaBarang", v)} placeholder="Cari..." size="sm" />
              </td>
              <td className="px-1 py-1" style={{ borderBottom: "1px solid var(--border)" }}>
                <SearchableSelect options={uniqueOptions(rows, (r) => r.customerNama)} value={filters.customerNama ?? ""} onChange={(v) => setFilter("customerNama", v)} placeholder="Cari..." size="sm" />
              </td>
              <td colSpan={3} className="px-1 py-1" style={{ borderBottom: "1px solid var(--border)" }}></td>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} className="px-3 py-6 text-center" style={{ color: "var(--text-muted)" }}>Memuat...</td></tr>
            )}
            {!loading && filteredSorted.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-6 text-center" style={{ color: "var(--text-muted)" }}>
                Tidak ada PO outstanding. Semua PO sudah lunas terkirim. 🎉
              </td></tr>
            )}
            {filteredSorted.map((r, idx) => (
              <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td className="px-2 py-1.5 font-mono-num" style={{ color: "var(--text-muted)" }}>{idx + 1}</td>
                <td className="px-2 py-1.5 font-mono-num">{r.noPo || <span style={{ color: "var(--text-muted)" }}>—</span>}</td>
                <td className="px-2 py-1.5 truncate" title={r.namaBarang}>{r.namaBarang}</td>
                <td className="px-2 py-1.5 truncate" style={{ color: "var(--text-secondary)" }}>{r.customerNama ?? "—"}</td>
                <td className="px-2 py-1.5" style={{ color: "var(--text-secondary)" }}>{BULAN_LABEL[r.bulan - 1]} {r.tahun}</td>
                <td className="px-2 py-1.5 text-right font-mono-num">{fmt(r.totalPo)}</td>
                <td className="px-2 py-1.5 text-right font-mono-num">{fmt(r.kirim)}</td>
                <td className="px-2 py-1.5 text-right font-mono-num font-semibold" style={{ color: "var(--warn)" }}>{fmt(r.sisaPo)}</td>
              </tr>
            ))}
          </tbody>
          {filteredSorted.length > 0 && (
            <tfoot className="sticky bottom-0 z-10">
              <tr style={{ background: "var(--surface-muted)", borderTop: "1px solid var(--border-strong)" }}>
                <td className="px-2 py-2 font-semibold" colSpan={7}>Total Sisa Outstanding</td>
                <td className="px-2 py-2 text-right font-mono-num font-semibold" style={{ color: "var(--warn)" }}>{fmt(totalSisa)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
