"use client";

import { useEffect, useState } from "react";
import { useAutoRefresh } from "@/components/layout/DataSync";
import { EditableCell } from "../ui/EditableCell";
import { SortableTh } from "../ui/SortableTh";
import { useTableControls } from "@/lib/hooks/useTableControls";
import { SearchableSelect } from "../ui/SearchableSelect";
import { uniqueOptions } from "@/lib/unique-options";
import { JENIS_MATERIAL } from "@/lib/material-jenis";

type RawMaterial = { id: string; nama: string; satuan: string | null; jenis: string; grade: string | null; ukuran: string | null; parts?: { namaBarang: string }[] };

export function MasterBahanBaku() {
  const [rows, setRows] = useState<RawMaterial[]>([]);
  const [loading, setLoading] = useState(true);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    const res = await fetch("/api/raw-materials");
    setRows(await res.json());
    if (!silent) setLoading(false);
  }

  useAutoRefresh(() => load(true));

  useEffect(() => {
    load();
  }, []);

  const { filteredSorted, filters, setFilter, sortKey, sortDir, toggleSort } = useTableControls<RawMaterial>(
    rows,
    { nama: (r) => r.nama, satuan: (r) => r.satuan, jenis: (r) => r.jenis, grade: (r) => r.grade, ukuran: (r) => r.ukuran }
  );

  async function addRow() {
    const res = await fetch("/api/raw-materials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nama: "Bahan Baku Baru" }),
    });
    if (res.ok) {
      const row = await res.json();
      setRows((r) => [row, ...r]);
    }
  }

  async function update(id: string, field: string, value: string) {
    await fetch(`/api/raw-materials/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    if (field === "jenis") {
      const satuan = JENIS_MATERIAL.find((j) => j.value === value)?.satuan ?? null;
      setRows((r) => r.map((x) => (x.id === id ? { ...x, jenis: value, satuan } : x)));
      return;
    }
    setRows((r) => r.map((x) => (x.id === id ? { ...x, [field]: value } : x)));
  }

  async function removeRow(id: string) {
    if (!confirm("Hapus bahan baku ini? (Hanya bisa dihapus kalau belum ada batch stok yang memakainya)")) return;
    const res = await fetch(`/api/raw-materials/${id}`, { method: "DELETE" });
    if (res.ok) setRows((r) => r.filter((x) => x.id !== id));
    else alert("Gagal hapus — kemungkinan masih dipakai di Stok Bahan Baku.");
  }

  const inputStyle: React.CSSProperties = {
    background: "var(--surface)",
    color: "var(--text-primary)",
    border: "1px solid var(--border)",
  };

  return (
    <div className="h-full flex flex-col p-5">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h1 className="text-[15px] font-semibold">Master Bahan Baku</h1>
          <p className="text-[12.5px]" style={{ color: "var(--text-secondary)" }}>
            {filteredSorted.length} / {rows.length} jenis bahan baku. Dipakai sebagai pilihan di Stok Bahan Baku.
          </p>
        </div>
        <button
          onClick={addRow}
          className="h-8 px-3 rounded-md text-[12.5px] font-medium text-white cursor-pointer"
          style={{ background: "var(--accent)" }}
        >
          + Tambah Bahan Baku
        </button>
      </div>

      <div className="rounded-lg overflow-auto flex-1 min-h-0" style={{ border: "1px solid var(--border)" }}>
        <table className="text-[12.5px] border-collapse w-full">
          <thead className="sticky top-0 z-10">
            <tr>
              <th
                className="px-2 py-2 font-medium sticky top-0 whitespace-nowrap text-left"
                style={{ color: "var(--text-secondary)", background: "var(--surface-muted)", width: 48 }}
              >
                No
              </th>
              <SortableTh label="Nama Bahan Baku" active={sortKey === "nama"} dir={sortDir} onClick={() => toggleSort("nama")} width={320} />
              <SortableTh label="Jenis Material" active={sortKey === "jenis"} dir={sortDir} onClick={() => toggleSort("jenis")} width={190} />
              <SortableTh label="Spesifikasi" active={sortKey === "grade"} dir={sortDir} onClick={() => toggleSort("grade")} width={130} />
              <SortableTh label="Ukuran (tebal x lebar)" active={sortKey === "ukuran"} dir={sortDir} onClick={() => toggleSort("ukuran")} width={160} />
              <SortableTh label="Satuan Tagihan" active={sortKey === "satuan"} dir={sortDir} onClick={() => toggleSort("satuan")} width={130} />
              <th className="px-2 py-2 font-medium sticky top-0 text-left" style={{ color: "var(--text-secondary)", background: "var(--surface-muted)", minWidth: 150 }}>Dipakai part</th>
              <th className="w-10 sticky top-0" style={{ background: "var(--surface-muted)" }}></th>
            </tr>
            <tr style={{ background: "var(--surface)" }}>
              <td className="px-2 py-1" style={{ borderBottom: "1px solid var(--border)" }}></td>
              <td className="px-2 py-1" style={{ borderBottom: "1px solid var(--border)" }}>
                <SearchableSelect options={uniqueOptions(rows, (r) => r.nama)} value={filters.nama ?? ""} onChange={(v) => setFilter("nama", v)} placeholder="Cari nama bahan baku..." size="sm" />
              </td>
              <td className="px-2 py-1" style={{ borderBottom: "1px solid var(--border)" }}></td>
              <td className="px-2 py-1" style={{ borderBottom: "1px solid var(--border)" }}></td>
              <td className="px-2 py-1" style={{ borderBottom: "1px solid var(--border)" }}></td>
              <td className="px-2 py-1" style={{ borderBottom: "1px solid var(--border)" }}></td>
              <td className="px-2 py-1" style={{ borderBottom: "1px solid var(--border)" }}></td>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center" style={{ color: "var(--text-muted)" }}>
                  Memuat...
                </td>
              </tr>
            )}
            {!loading && filteredSorted.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center" style={{ color: "var(--text-muted)" }}>
                  {rows.length === 0 ? 'Belum ada bahan baku. Klik "Tambah Bahan Baku".' : "Tidak ada hasil pencarian."}
                </td>
              </tr>
            )}
            {filteredSorted.map((r, idx) => (
              <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td className="px-2 py-1.5 font-mono-num" style={{ color: "var(--text-muted)" }}>
                  {idx + 1}
                </td>
                <td className="p-0">
                  <EditableCell value={r.nama} onSave={(v) => update(r.id, "nama", v)} />
                </td>
                <td className="px-1">
                  <select
                    value={r.jenis}
                    onChange={(e) => update(r.id, "jenis", e.target.value)}
                    className="w-full h-7 px-1.5 rounded text-[12px]"
                    style={inputStyle}
                  >
                    {JENIS_MATERIAL.map((j) => (
                      <option key={j.value} value={j.value}>{j.label}</option>
                    ))}
                  </select>
                </td>
                <td className="p-0">
                  <EditableCell value={r.grade ?? ""} onSave={(v) => update(r.id, "grade", v)} placeholder="mis. SPCC SD" />
                </td>
                <td className="p-0">
                  <EditableCell value={r.ukuran ?? ""} onSave={(v) => update(r.id, "ukuran", v)} placeholder="mis. 1.6 x 113" />
                </td>
                <td className="p-0">
                  <EditableCell value={r.satuan ?? ""} onSave={(v) => update(r.id, "satuan", v)} placeholder="Kg / pcs" />
                </td>
                <td className="px-2 py-1.5 text-[11.5px]" style={{ color: "var(--text-secondary)" }} title={(r.parts ?? []).map((x) => x.namaBarang).join(", ")}>
                  {(r.parts?.length ?? 0) === 0 ? <span style={{ color: "var(--text-muted)" }}>—</span> : `${r.parts?.length} part`}
                </td>
                <td className="text-center">
                  <button
                    onClick={() => removeRow(r.id)}
                    className="w-6 h-6 rounded cursor-pointer"
                    style={{ color: "var(--text-muted)" }}
                    title="Hapus"
                  >
                    ×
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
