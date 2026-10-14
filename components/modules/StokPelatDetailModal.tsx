"use client";

import { useEffect, useState } from "react";
import { EditableCell } from "../ui/EditableCell";
import { SearchableSelect } from "../ui/SearchableSelect";

type Usage = { id: string; batchId: string; partId: string | null; namaBarang: string | null; tanggal: string; qty: string };
type Part = { id: string; namaBarang: string };

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(n);
}
function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export function StokPelatDetailModal({
  batchId,
  namaBarang,
  qtyMasuk,
  onClose,
  onChanged,
}: {
  batchId: string;
  namaBarang: string;
  qtyMasuk: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [usages, setUsages] = useState<Usage[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUsage, setNewUsage] = useState({ tanggal: todayInputValue(), qty: "", partId: "" });

  async function load() {
    setLoading(true);
    const [uRes, pRes] = await Promise.all([
      fetch(`/api/raw-material-usages?batchId=${batchId}`),
      fetch("/api/parts"),
    ]);
    setUsages((await uRes.json()).reverse());
    setParts(await pRes.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId]);

  const totalTerpakai = usages.reduce((s, u) => s + Number(u.qty), 0);
  const sisa = qtyMasuk - totalTerpakai;

  async function addUsage() {
    if (!newUsage.qty) return;
    const res = await fetch("/api/raw-material-usages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batchId, ...newUsage, partId: newUsage.partId || null }),
    });
    if (res.ok) {
      const row = await res.json();
      const part = parts.find((p) => p.id === newUsage.partId);
      setUsages((u) => [{ ...row, namaBarang: part?.namaBarang ?? null }, ...u]);
      setNewUsage({ tanggal: todayInputValue(), qty: "", partId: "" });
      onChanged();
    }
  }

  async function patchUsage(id: string, field: string, value: string) {
    await fetch(`/api/raw-material-usages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    setUsages((u) => u.map((x) => (x.id === id ? { ...x, [field]: value } : x)));
    onChanged();
  }

  async function removeUsage(id: string) {
    if (!confirm("Hapus catatan pemakaian ini?")) return;
    await fetch(`/api/raw-material-usages/${id}`, { method: "DELETE" });
    setUsages((u) => u.filter((x) => x.id !== id));
    onChanged();
  }

  const inputStyle: React.CSSProperties = {
    background: "var(--surface)",
    color: "var(--text-primary)",
    border: "1px solid var(--border)",
  };

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
            <div className="text-[13.5px] font-semibold">{namaBarang}</div>
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
          <div className="grid grid-cols-[1fr_1fr_1.3fr_auto] gap-1.5 mb-3">
            <input type="date" value={newUsage.tanggal} onChange={(e) => setNewUsage((s) => ({ ...s, tanggal: e.target.value }))} className="h-7 px-1.5 rounded text-[11.5px]" style={inputStyle} />
            <input type="number" placeholder="Qty pakai" value={newUsage.qty} onChange={(e) => setNewUsage((s) => ({ ...s, qty: e.target.value }))} className="h-7 px-1.5 rounded text-[11.5px] font-mono-num" style={inputStyle} />
            <SearchableSelect
              options={parts.map((p) => ({ value: p.id, label: p.namaBarang }))}
              value={newUsage.partId}
              onChange={(v) => setNewUsage((s) => ({ ...s, partId: v }))}
              placeholder="Dipakai untuk part..."
              size="sm"
            />
            <button onClick={addUsage} className="h-7 px-2 rounded text-[11.5px] font-medium text-white cursor-pointer" style={{ background: "var(--accent)" }}>
              +
            </button>
          </div>

          <table className="w-full text-[12px] border-collapse">
            <thead>
              <tr style={{ background: "var(--surface-muted)" }}>
                <th className="px-2 py-1.5 text-left font-medium" style={{ color: "var(--text-secondary)" }}>Tanggal</th>
                <th className="px-2 py-1.5 text-right font-medium" style={{ color: "var(--text-secondary)" }}>Qty</th>
                <th className="px-2 py-1.5 text-left font-medium" style={{ color: "var(--text-secondary)" }}>Dipakai untuk</th>
                <th className="w-6"></th>
              </tr>
            </thead>
            <tbody>
              {!loading && usages.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-2 py-4 text-center" style={{ color: "var(--text-muted)" }}>
                    Belum ada catatan pemakaian.
                  </td>
                </tr>
              )}
              {usages.map((u) => (
                <tr key={u.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td className="px-2 py-1 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>{fmtDate(u.tanggal)}</td>
                  <td className="p-0"><EditableCell value={u.qty} align="right" type="number" mono onSave={(v) => patchUsage(u.id, "qty", v)} /></td>
                  <td className="px-2 py-1">{u.namaBarang ?? <span style={{ color: "var(--text-muted)" }}>—</span>}</td>
                  <td className="text-center">
                    <button onClick={() => removeUsage(u.id)} className="w-5 h-5 rounded cursor-pointer" style={{ color: "var(--text-muted)" }}>×</button>
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
