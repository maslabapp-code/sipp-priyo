"use client";

import { useEffect, useState } from "react";
import { useAutoRefresh } from "@/components/layout/DataSync";
import { EditableCell } from "../ui/EditableCell";
import { SortableTh } from "../ui/SortableTh";
import { useTableControls } from "@/lib/hooks/useTableControls";
import { SearchableSelect } from "../ui/SearchableSelect";
import { uniqueOptions } from "@/lib/unique-options";
import { ImportMasterMaterialModal } from "./ImportMasterMaterialModal";
import { QuickAddCustomer, QuickAddMaterial, QuickAddKategori } from "../ui/QuickAddModal";

type Part = {
  id: string;
  kodePart: string | null;
  namaBarang: string;
  kategori: string | null;
  hargaJualDefault: string;
  customerId: string | null;
  customerNama: string | null;
  rawMaterialId: string | null;
  bahanBakuNama: string | null;
  satuanPotong: string | null;
  konversiPcs: string | null;
  lebarPotong: string | null;
  beratPerUnit: string | null;
  brutoPerKg: string | null;
  nettoPerKg: string | null;
};
type Material = { id: string; nama: string };
type Customer = { id: string; nama: string };
type Category = { id: string; nama: string };

export function MasterPart() {
  const [rows, setRows] = useState<Part[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [showImport, setShowImport] = useState(false);
  // Popup tambah cepat dari dropdown pada baris part tertentu
  const [quick, setQuick] = useState<null | { type: "customer" | "material" | "kategori"; partId: string; nama: string }>(null);
  const [loading, setLoading] = useState(true);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    const [partsRes, custRes, catRes, matRes] = await Promise.all([
      fetch("/api/parts"),
      fetch("/api/customers"),
      fetch("/api/part-categories"),
      fetch("/api/raw-materials"),
    ]);
    setRows(await partsRes.json());
    setCustomers(await custRes.json());
    setCategories(await catRes.json());
    setMaterials(await matRes.json());
    if (!silent) setLoading(false);
  }

  useAutoRefresh(() => load(true));

  useEffect(() => {
    load();
  }, []);

  const { filteredSorted, filters, setFilter, sortKey, sortDir, toggleSort } = useTableControls<Part>(rows, {
    kodePart: (r) => r.kodePart,
    namaBarang: (r) => r.namaBarang,
    kategori: (r) => r.kategori,
    customerNama: (r) => r.customerNama,
    hargaJualDefault: (r) => Number(r.hargaJualDefault),
    bahanBakuNama: (r) => r.bahanBakuNama,
  });
  const tanpaBahanBaku = rows.filter((r) => !r.rawMaterialId).length;

  async function addRow() {
    const res = await fetch("/api/parts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ namaBarang: "Part Baru" }),
    });
    if (res.ok) {
      const row = await res.json();
      setRows((r) => [{ ...row, customerNama: null, bahanBakuNama: null }, ...r]);
    }
  }

  async function update(id: string, field: string, value: string) {
    await fetch(`/api/parts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value || null }),
    });
    setRows((r) => r.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  }

  async function updateCustomer(id: string, customerId: string) {
    const cust = customers.find((c) => c.id === customerId);
    await fetch(`/api/parts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId: customerId || null }),
    });
    setRows((r) =>
      r.map((p) => (p.id === id ? { ...p, customerId, customerNama: cust?.nama ?? null } : p))
    );
  }

  async function updateBahanBaku(id: string, rawMaterialId: string) {
    const mat = materials.find((m) => m.id === rawMaterialId);
    await fetch(`/api/parts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawMaterialId: rawMaterialId || null }),
    });
    setRows((r) => r.map((p) => (p.id === id ? { ...p, rawMaterialId: rawMaterialId || null, bahanBakuNama: mat?.nama ?? null } : p)));
  }

  async function updateKategori(id: string, value: string) {
    if (value === "__new__") {
      const nama = window.prompt("Nama kategori/proses baru:");
      if (!nama || !nama.trim()) return;
      const res = await fetch("/api/part-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nama: nama.trim() }),
      });
      const newCat = await res.json();
      setCategories((c) => (c.some((x) => x.nama === newCat.nama) ? c : [...c, newCat].sort((a, b) => a.nama.localeCompare(b.nama))));
      await update(id, "kategori", nama.trim());
      return;
    }
    await update(id, "kategori", value);
  }

  async function removeRow(id: string) {
    if (!confirm("Hapus part ini? Semua transaksi bulanannya ikut terhapus.")) return;
    await fetch(`/api/parts/${id}`, { method: "DELETE" });
    setRows((r) => r.filter((p) => p.id !== id));
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
          <h1 className="text-[15px] font-semibold">Master Part</h1>
          <p className="text-[12.5px]" style={{ color: "var(--text-secondary)" }}>
            {filteredSorted.length} / {rows.length} part. Klik cell untuk edit, klik header untuk urutkan.
            {tanpaBahanBaku > 0 && (
              <span style={{ color: "var(--warn)" }}> {tanpaBahanBaku} part belum punya bahan baku.</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="h-8 px-3 rounded-md text-[12.5px] font-medium cursor-pointer"
            style={{ border: "1px solid var(--border)", color: "var(--accent)" }}
          >
            Impor Master Material
          </button>
          <button
            onClick={addRow}
            className="h-8 px-3 rounded-md text-[12.5px] font-medium text-white cursor-pointer"
            style={{ background: "var(--accent)" }}
          >
            + Tambah Part
          </button>
        </div>
      </div>

      <div className="rounded-lg overflow-auto flex-1 min-h-0" style={{ border: "1px solid var(--border)" }}>
        <table className="w-full text-[13px] border-collapse">
          <thead className="sticky top-0 z-10">
            <tr>
              <th
                className="text-left px-3 py-2 font-medium sticky top-0"
                style={{ color: "var(--text-secondary)", background: "var(--surface-muted)", width: 48 }}
              >
                No
              </th>
              <SortableTh label="Kode Part" active={sortKey === "kodePart"} dir={sortDir} onClick={() => toggleSort("kodePart")} width={110} />
              <SortableTh label="Nama Barang" active={sortKey === "namaBarang"} dir={sortDir} onClick={() => toggleSort("namaBarang")} width={220} />
              <SortableTh label="Kategori/Proses" active={sortKey === "kategori"} dir={sortDir} onClick={() => toggleSort("kategori")} width={140} />
              <SortableTh label="Customer" active={sortKey === "customerNama"} dir={sortDir} onClick={() => toggleSort("customerNama")} width={160} />
              <SortableTh label="Harga Jual Default" align="right" active={sortKey === "hargaJualDefault"} dir={sortDir} onClick={() => toggleSort("hargaJualDefault")} width={130} />
              <SortableTh label="Bahan Baku" active={sortKey === "bahanBakuNama"} dir={sortDir} onClick={() => toggleSort("bahanBakuNama")} width={240} />
              {["Satuan Potong", "Pcs / Unit", "Bruto (pcs/kg)", "Netto (pcs/kg)", "Lebar (mm)", "Berat / Unit (kg)"].map((h) => (
                <th key={h} className="px-2 py-2 font-medium sticky top-0 text-right" style={{ color: "var(--text-secondary)", background: "var(--surface-muted)", minWidth: 100 }}>
                  {h}
                </th>
              ))}
              <th className="w-10 sticky top-0" style={{ background: "var(--surface-muted)" }}></th>
            </tr>
            <tr style={{ background: "var(--surface)" }}>
              <td className="px-3 py-1" style={{ borderBottom: "1px solid var(--border)" }}></td>
              <td className="px-1 py-1" style={{ borderBottom: "1px solid var(--border)" }}>
                <input
                  value={filters.kodePart ?? ""}
                  onChange={(e) => setFilter("kodePart", e.target.value)}
                  placeholder="Cari..."
                  className="w-full h-7 px-2 rounded text-[12px] outline-none"
                  style={inputStyle}
                />
              </td>
              <td className="px-1 py-1" style={{ borderBottom: "1px solid var(--border)" }}>
                <SearchableSelect options={uniqueOptions(rows, (r) => r.namaBarang)} value={filters.namaBarang ?? ""} onChange={(v) => setFilter("namaBarang", v)} placeholder="Cari nama barang..." size="sm" />
              </td>
              <td className="px-1 py-1" style={{ borderBottom: "1px solid var(--border)" }}>
                <input
                  value={filters.kategori ?? ""}
                  onChange={(e) => setFilter("kategori", e.target.value)}
                  placeholder="Cari..."
                  className="w-full h-7 px-2 rounded text-[12px] outline-none"
                  style={inputStyle}
                />
              </td>
              <td className="px-1 py-1" style={{ borderBottom: "1px solid var(--border)" }}>
                <SearchableSelect options={uniqueOptions(rows, (r) => r.customerNama)} value={filters.customerNama ?? ""} onChange={(v) => setFilter("customerNama", v)} placeholder="Cari customer..." size="sm" />
              </td>
              <td className="px-1 py-1" style={{ borderBottom: "1px solid var(--border)" }}></td>
              <td className="px-1 py-1" style={{ borderBottom: "1px solid var(--border)" }}>
                <SearchableSelect options={uniqueOptions(rows, (r) => r.bahanBakuNama)} value={filters.bahanBakuNama ?? ""} onChange={(v) => setFilter("bahanBakuNama", v)} placeholder="Cari bahan baku..." size="sm" />
              </td>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <td key={i} className="px-1 py-1" style={{ borderBottom: "1px solid var(--border)" }}></td>
              ))}
              <td className="px-1 py-1" style={{ borderBottom: "1px solid var(--border)" }}></td>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={14} className="px-3 py-4 text-center" style={{ color: "var(--text-muted)" }}>
                  Memuat...
                </td>
              </tr>
            )}
            {!loading && filteredSorted.length === 0 && (
              <tr>
                <td colSpan={14} className="px-3 py-4 text-center" style={{ color: "var(--text-muted)" }}>
                  {rows.length === 0 ? 'Belum ada part. Klik "Tambah Part".' : "Tidak ada hasil pencarian."}
                </td>
              </tr>
            )}
            {filteredSorted.map((p, idx) => (
              <tr key={p.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td className="px-3 py-1.5 font-mono-num" style={{ color: "var(--text-muted)" }}>
                  {idx + 1}
                </td>
                <td className="p-0 w-32">
                  <EditableCell value={p.kodePart ?? ""} onSave={(v) => update(p.id, "kodePart", v)} />
                </td>
                <td className="p-0 min-w-[220px]">
                  <EditableCell value={p.namaBarang} onSave={(v) => update(p.id, "namaBarang", v)} />
                </td>
                <td className="p-1 w-40">
                  <SearchableSelect
                    options={categories.map((c) => ({ value: c.nama, label: c.nama }))}
                    value={p.kategori ?? ""}
                    onChange={(v) => updateKategori(p.id, v)}
                    placeholder="—"
                    size="sm"
                    onCreate={(t) => setQuick({ type: "kategori", partId: p.id, nama: t })}
                    createLabel="kategori"
                  />
                </td>
                <td className="p-1 w-44">
                  <SearchableSelect
                    options={customers.map((c) => ({ value: c.id, label: c.nama }))}
                    value={p.customerId ?? ""}
                    onChange={(v) => updateCustomer(p.id, v)}
                    placeholder="—"
                    size="sm"
                    onCreate={(t) => setQuick({ type: "customer", partId: p.id, nama: t })}
                    createLabel="customer"
                  />
                </td>
                <td className="p-0 w-32">
                  <EditableCell
                    value={p.hargaJualDefault}
                    align="right"
                    type="number"
                    mono
                    onSave={(v) => update(p.id, "hargaJualDefault", v)}
                  />
                </td>
                <td className="p-1 w-60">
                  <SearchableSelect
                    options={materials.map((m) => ({ value: m.id, label: m.nama }))}
                    value={p.rawMaterialId ?? ""}
                    onChange={(v) => updateBahanBaku(p.id, v)}
                    placeholder="—"
                    size="sm"
                    onCreate={(t) => setQuick({ type: "material", partId: p.id, nama: t })}
                    createLabel="bahan baku"
                  />
                </td>
                <td className="p-1 w-28">
                  <select
                    value={p.satuanPotong ?? ""}
                    onChange={(e) => update(p.id, "satuanPotong", e.target.value)}
                    className="w-full h-7 px-1.5 rounded text-[12px]"
                    style={inputStyle}
                  >
                    <option value="">—</option>
                    <option value="Kg">Kg</option>
                    <option value="Lembar">Lembar</option>
                    <option value="Pita">Pita</option>
                  </select>
                </td>
                {(["konversiPcs", "brutoPerKg", "nettoPerKg", "lebarPotong", "beratPerUnit"] as const).map((f) => (
                  <td key={f} className="p-0 w-28">
                    <EditableCell
                      value={p[f] == null ? "" : String(Number(p[f]))}
                      align="right"
                      type="number"
                      mono
                      onSave={(v) => update(p.id, f, v)}
                    />
                  </td>
                ))}
                <td className="text-center w-10">
                  <button
                    onClick={() => removeRow(p.id)}
                    className="w-7 h-7 rounded cursor-pointer"
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

      {showImport && <ImportMasterMaterialModal onClose={() => setShowImport(false)} onDone={load} />}

      {quick?.type === "customer" && (
        <QuickAddCustomer
          initialName={quick.nama}
          existing={customers}
          onClose={() => setQuick(null)}
          onCreated={async (row) => {
            setCustomers((c) => (c.some((x) => x.id === row.id) ? c : [{ id: row.id, nama: row.nama }, ...c]));
            const partId = quick.partId;
            setQuick(null);
            await fetch(`/api/parts/${partId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerId: row.id }) });
            setRows((r) => r.map((p) => (p.id === partId ? { ...p, customerId: row.id, customerNama: row.nama } : p)));
          }}
        />
      )}
      {quick?.type === "material" && (
        <QuickAddMaterial
          initialName={quick.nama}
          existing={materials}
          onClose={() => setQuick(null)}
          onCreated={async (row) => {
            setMaterials((m) => (m.some((x) => x.id === row.id) ? m : [...m, { id: row.id, nama: row.nama }]));
            const partId = quick.partId;
            setQuick(null);
            await fetch(`/api/parts/${partId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rawMaterialId: row.id }) });
            setRows((r) => r.map((p) => (p.id === partId ? { ...p, rawMaterialId: row.id, bahanBakuNama: row.nama } : p)));
          }}
        />
      )}
      {quick?.type === "kategori" && (
        <QuickAddKategori
          initialName={quick.nama}
          existing={categories.map((c) => ({ id: c.id ?? c.nama, nama: c.nama }))}
          onClose={() => setQuick(null)}
          onCreated={async (row) => {
            setCategories((c) => (c.some((x) => x.nama === row.nama) ? c : [...c, { ...(c[0] ?? {}), id: row.id, nama: row.nama } as Category].sort((a, b) => a.nama.localeCompare(b.nama))));
            const partId = quick.partId;
            setQuick(null);
            await update(partId, "kategori", row.nama);
          }}
        />
      )}
    </div>
  );
}
