"use client";

import { useEffect, useState } from "react";
import { useAutoRefresh } from "@/components/layout/DataSync";
import { SortableTh } from "../ui/SortableTh";
import { useTableControls } from "@/lib/hooks/useTableControls";
import { ReturnDetailModal } from "./ReturnDetailModal";
import { ExportButton } from "../ui/ExportButton";
import { SearchableSelect } from "../ui/SearchableSelect";
import { uniqueOptions } from "@/lib/unique-options";

type Row = {
  id: string;
  namaBarang: string;
  kodePart: string | null;
  customerNama: string | null;
  totalDatang: number;
  totalKirimUlang: number;
  totalSpoilage: number;
  sisa: number;
};

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(n);
}

export function Return() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailPart, setDetailPart] = useState<Row | null>(null);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    const res = await fetch("/api/return/summary");
    setRows(await res.json());
    if (!silent) setLoading(false);
  }

  useAutoRefresh(() => load(true));

  useEffect(() => {
    load();
  }, []);

  const { filteredSorted, filters, setFilter, sortKey, sortDir, toggleSort } = useTableControls<Row>(rows, {
    namaBarang: (r) => r.namaBarang,
    customerNama: (r) => r.customerNama,
    totalDatang: (r) => r.totalDatang,
    sisa: (r) => r.sisa,
  });

  const inputStyle: React.CSSProperties = {
    background: "var(--surface)",
    color: "var(--text-primary)",
    border: "1px solid var(--border)",
  };

  return (
    <div className="h-full flex flex-col p-5">
      <div className="mb-4 flex items-start justify-between gap-3 flex-wrap shrink-0">
        <div>
          <h1 className="text-[15px] font-semibold">Return</h1>
          <p className="text-[12.5px]" style={{ color: "var(--text-secondary)" }}>
            {filteredSorted.length} part pernah ada retur. Klik "Detail" untuk isi barang datang & resolusi.
          </p>
          <p className="text-[11.5px] mt-1" style={{ color: "var(--text-muted)" }}>
            Catatan: Return terpisah dari Kirim PO bulanan — tidak mempengaruhi Actual Penjualan di Transaksi Bulanan.
          </p>
        </div>
        <ExportButton baseUrl="/api/export/return" />
      </div>

      <div className="rounded-lg overflow-auto flex-1 min-h-0" style={{ border: "1px solid var(--border)" }}>
        <table className="text-[12.5px] border-collapse w-full">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="px-2 py-2 font-medium sticky top-0 text-left" style={{ color: "var(--text-secondary)", background: "var(--surface-muted)", minWidth: 44 }}>No</th>
              <SortableTh label="Nama Barang" active={sortKey === "namaBarang"} dir={sortDir} onClick={() => toggleSort("namaBarang")} width={200} />
              <SortableTh label="Customer" active={sortKey === "customerNama"} dir={sortDir} onClick={() => toggleSort("customerNama")} width={110} />
              <SortableTh label="Datang" align="right" active={sortKey === "totalDatang"} dir={sortDir} onClick={() => toggleSort("totalDatang")} width={90} />
              <th className="px-2 py-2 font-medium sticky top-0 text-right" style={{ color: "var(--text-secondary)", background: "var(--surface-muted)", minWidth: 95 }}>Kirim Ulang</th>
              <th className="px-2 py-2 font-medium sticky top-0 text-right" style={{ color: "var(--text-secondary)", background: "var(--surface-muted)", minWidth: 85 }}>Spoilage</th>
              <SortableTh label="Sisa" align="right" active={sortKey === "sisa"} dir={sortDir} onClick={() => toggleSort("sisa")} width={85} />
              <th className="sticky top-0" style={{ background: "var(--surface-muted)", minWidth: 70 }}></th>
            </tr>
            <tr style={{ background: "var(--surface)" }}>
              <td className="px-1 py-1" style={{ borderBottom: "1px solid var(--border)" }}></td>
              <td className="px-1 py-1" style={{ borderBottom: "1px solid var(--border)" }}>
                <SearchableSelect options={uniqueOptions(rows, (r) => r.namaBarang)} value={filters.namaBarang ?? ""} onChange={(v) => setFilter("namaBarang", v)} placeholder="Cari..." size="sm" />
              </td>
              <td className="px-1 py-1" style={{ borderBottom: "1px solid var(--border)" }}>
                <SearchableSelect options={uniqueOptions(rows, (r) => r.customerNama)} value={filters.customerNama ?? ""} onChange={(v) => setFilter("customerNama", v)} placeholder="Cari..." size="sm" />
              </td>
              <td colSpan={4} className="px-1 py-1" style={{ borderBottom: "1px solid var(--border)" }}></td>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} className="px-3 py-6 text-center" style={{ color: "var(--text-muted)" }}>Memuat...</td></tr>
            )}
            {!loading && filteredSorted.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-6 text-center" style={{ color: "var(--text-muted)" }}>
                Belum ada retur tercatat. Retur baru muncul di sini setelah ada catatan "Barang Datang" pertama — buka detail dari part terkait.
              </td></tr>
            )}
            {filteredSorted.map((r, idx) => (
              <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td className="px-2 py-1.5 font-mono-num" style={{ color: "var(--text-muted)" }}>{idx + 1}</td>
                <td className="px-2 py-1.5 truncate" title={r.namaBarang}>{r.namaBarang}</td>
                <td className="px-2 py-1.5 truncate" style={{ color: "var(--text-secondary)" }}>{r.customerNama ?? "—"}</td>
                <td className="px-2 py-1.5 text-right font-mono-num">{fmt(r.totalDatang)}</td>
                <td className="px-2 py-1.5 text-right font-mono-num" style={{ color: "var(--success)" }}>{fmt(r.totalKirimUlang)}</td>
                <td className="px-2 py-1.5 text-right font-mono-num" style={{ color: "var(--danger)" }}>{fmt(r.totalSpoilage)}</td>
                <td className="px-2 py-1.5 text-right font-mono-num font-medium" style={{ color: r.sisa > 0 ? "var(--warn)" : "var(--text-secondary)" }}>{fmt(r.sisa)}</td>
                <td className="text-center">
                  <button onClick={() => setDetailPart(r)} className="h-6 px-2 rounded text-[11px] font-medium cursor-pointer" style={{ border: "1px solid var(--border)", color: "var(--accent)" }}>
                    Detail
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ReturnPartPicker onAdded={load} />

      {detailPart && (
        <ReturnDetailModal
          partId={detailPart.id}
          namaBarang={detailPart.namaBarang}
          onClose={() => setDetailPart(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}

// Kalau part belum pernah ada retur, dia tidak muncul di tabel ringkasan (karena totalDatang=0
// difilter di API). Jadi sediakan cara mulai retur baru: pilih part, langsung buka detail modal-nya.
function ReturnPartPicker({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [parts, setParts] = useState<{ id: string; namaBarang: string }[]>([]);
  const [selected, setSelected] = useState<{ id: string; namaBarang: string } | null>(null);

  async function loadParts() {
    const res = await fetch("/api/parts");
    setParts(await res.json());
  }

  return (
    <div className="mt-3">
      {!open && (
        <button
          onClick={() => {
            setOpen(true);
            loadParts();
          }}
          className="h-8 px-3 rounded-md text-[12.5px] font-medium text-white cursor-pointer"
          style={{ background: "var(--accent)" }}
        >
          + Catat Retur Baru
        </button>
      )}
      {open && (
        <div className="flex items-center gap-1.5">
          <SearchableSelect
            options={parts.map((p) => ({ value: p.id, label: p.namaBarang }))}
            value={selected?.id ?? ""}
            onChange={(v) => {
              const p = parts.find((x) => x.id === v);
              setSelected(p ?? null);
            }}
            placeholder="Pilih part yang retur..."
            className="w-64"
          />
          <button onClick={() => setOpen(false)} className="h-8 px-2 rounded-md text-[12.5px] cursor-pointer" style={{ color: "var(--text-muted)" }}>
            Batal
          </button>
        </div>
      )}
      {selected && (
        <ReturnDetailModal
          partId={selected.id}
          namaBarang={selected.namaBarang}
          onClose={() => {
            setSelected(null);
            setOpen(false);
          }}
          onChanged={onAdded}
        />
      )}
    </div>
  );
}
