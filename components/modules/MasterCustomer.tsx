"use client";

import { useEffect, useState } from "react";
import { useAutoRefresh } from "@/components/layout/DataSync";
import { EditableCell } from "../ui/EditableCell";
import { SortableTh } from "../ui/SortableTh";
import { useTableControls } from "@/lib/hooks/useTableControls";
import { SearchableSelect } from "../ui/SearchableSelect";
import { uniqueOptions } from "@/lib/unique-options";
import { fetchJson } from "@/lib/api-client";

type Customer = { id: string; nama: string };

export function MasterCustomer() {
  const [rows, setRows] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    const res = await fetch("/api/customers");
    setRows(await res.json());
    if (!silent) setLoading(false);
  }

  useAutoRefresh(() => load(true));

  useEffect(() => {
    load();
  }, []);

  const { filteredSorted, filters, setFilter, sortKey, sortDir, toggleSort } = useTableControls<Customer>(
    rows,
    { nama: (r) => r.nama }
  );

  const [adding, setAdding] = useState(false);
  const [newNama, setNewNama] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function bukaForm() {
    setAdding(true);
    setNewNama("");
    setError("");
  }

  async function addRow() {
    const nama = newNama.trim();
    if (!nama) {
      setError("Nama customer wajib diisi");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const row = await fetchJson<Customer>("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nama }),
      });
      setRows((r) => [row, ...r]);
      setAdding(false);
      setNewNama("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menambah customer");
    } finally {
      setSaving(false);
    }
  }

  async function updateNama(id: string, nama: string) {
    const baru = nama.trim();
    if (!baru) {
      alert("Nama customer tidak boleh kosong");
      return;
    }
    try {
      await fetchJson(`/api/customers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nama: baru }),
      });
      setRows((r) => r.map((c) => (c.id === id ? { ...c, nama: baru } : c)));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Gagal menyimpan nama customer");
      load();
    }
  }

  async function removeRow(id: string) {
    if (!confirm("Hapus customer ini?")) return;
    try {
      await fetchJson(`/api/customers/${id}`, { method: "DELETE" });
      setRows((r) => r.filter((c) => c.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Gagal menghapus customer");
    }
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
          <h1 className="text-[15px] font-semibold">Master Customer</h1>
          <p className="text-[12.5px]" style={{ color: "var(--text-secondary)" }}>
            {filteredSorted.length} / {rows.length} customer. Klik nama untuk edit, klik header untuk urutkan.
          </p>
        </div>
        <button
          onClick={bukaForm}
          className="h-8 px-3 rounded-md text-[12.5px] font-medium text-white cursor-pointer"
          style={{ background: "var(--accent)" }}
        >
          + Tambah Customer
        </button>
      </div>

      {adding && (
        <div className="mb-3 shrink-0 rounded-lg p-3 flex flex-wrap items-center gap-2" style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
          <input
            autoFocus
            value={newNama}
            onChange={(e) => setNewNama(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addRow();
              if (e.key === "Escape") setAdding(false);
            }}
            placeholder="Ketik nama customer baru..."
            className="h-9 px-2.5 rounded-md text-[13px] w-72"
            style={inputStyle}
          />
          <button
            onClick={addRow}
            disabled={saving}
            className="h-9 px-3 rounded-md text-[12.5px] font-medium text-white cursor-pointer disabled:opacity-60"
            style={{ background: "var(--accent)" }}
          >
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
          <button
            onClick={() => setAdding(false)}
            className="h-9 px-3 rounded-md text-[12.5px] cursor-pointer"
            style={{ ...inputStyle }}
          >
            Batal
          </button>
          {error && (
            <span className="text-[12.5px]" style={{ color: "#c0392b" }}>
              {error}
            </span>
          )}
        </div>
      )}

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
              <SortableTh
                label="Nama Customer"
                active={sortKey === "nama"}
                dir={sortDir}
                onClick={() => toggleSort("nama")}
                width={260}
              />
              <th
                className="px-2 py-2 font-medium sticky top-0 whitespace-nowrap text-center"
                style={{ color: "var(--text-secondary)", background: "var(--surface-muted)", width: 40 }}
              ></th>
            </tr>
            <tr style={{ background: "var(--surface)" }}>
              <td className="px-2 py-1" style={{ borderBottom: "1px solid var(--border)" }}></td>
              <td className="px-2 py-1" style={{ borderBottom: "1px solid var(--border)" }}>
                <SearchableSelect options={uniqueOptions(rows, (r) => r.nama)} value={filters.nama ?? ""} onChange={(v) => setFilter("nama", v)} placeholder="Cari nama customer..." size="sm" />
              </td>
              <td className="px-2 py-1" style={{ borderBottom: "1px solid var(--border)" }}></td>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center" style={{ color: "var(--text-muted)" }}>
                  Memuat...
                </td>
              </tr>
            )}
            {!loading && filteredSorted.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center" style={{ color: "var(--text-muted)" }}>
                  {rows.length === 0 ? 'Belum ada customer. Klik "Tambah Customer".' : "Tidak ada hasil pencarian."}
                </td>
              </tr>
            )}
            {filteredSorted.map((c, idx) => (
              <tr key={c.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td className="px-2 py-1.5 font-mono-num" style={{ color: "var(--text-muted)" }}>
                  {idx + 1}
                </td>
                <td className="p-0">
                  <EditableCell value={c.nama} onSave={(v) => updateNama(c.id, v)} />
                </td>
                <td className="text-center">
                  <button
                    onClick={() => removeRow(c.id)}
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
