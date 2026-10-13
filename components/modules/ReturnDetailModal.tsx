"use client";

import { useEffect, useState } from "react";
import { EditableCell } from "../ui/EditableCell";

type Incoming = { id: string; tanggal: string; noSj: string; qty: string; alasan: string | null };
type Resolution = { id: string; tanggal: string; jenis: string; qty: string };

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(n);
}
function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export function ReturnDetailModal({
  partId,
  namaBarang,
  onClose,
  onChanged,
}: {
  partId: string;
  namaBarang: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [incoming, setIncoming] = useState<Incoming[]>([]);
  const [resolutions, setResolutions] = useState<Resolution[]>([]);
  const [loading, setLoading] = useState(true);

  const [newIncoming, setNewIncoming] = useState({ tanggal: todayInputValue(), noSj: "", qty: "", alasan: "" });
  const [newResolution, setNewResolution] = useState({ tanggal: todayInputValue(), jenis: "kirim_ulang", qty: "" });

  async function load() {
    setLoading(true);
    const [inRes, resRes] = await Promise.all([
      fetch(`/api/return-incoming?partId=${partId}`),
      fetch(`/api/return-resolutions?partId=${partId}`),
    ]);
    setIncoming((await inRes.json()).reverse());
    setResolutions((await resRes.json()).reverse());
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partId]);

  const totalDatang = incoming.reduce((s, i) => s + Number(i.qty), 0);
  const totalKirimUlang = resolutions.filter((r) => r.jenis === "kirim_ulang").reduce((s, r) => s + Number(r.qty), 0);
  const totalSpoilage = resolutions.filter((r) => r.jenis === "spoilage").reduce((s, r) => s + Number(r.qty), 0);
  const sisa = totalDatang - totalKirimUlang - totalSpoilage;

  async function addIncoming() {
    if (!newIncoming.noSj || !newIncoming.qty) return;
    const res = await fetch("/api/return-incoming", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partId, ...newIncoming }),
    });
    if (res.ok) {
      const row = await res.json();
      setIncoming((c) => [row, ...c]);
      setNewIncoming({ tanggal: todayInputValue(), noSj: "", qty: "", alasan: "" });
      onChanged();
    }
  }

  async function patchIncoming(id: string, field: string, value: string) {
    await fetch(`/api/return-incoming/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    setIncoming((c) => c.map((x) => (x.id === id ? { ...x, [field]: value } : x)));
    onChanged();
  }

  async function removeIncoming(id: string) {
    if (!confirm("Hapus catatan barang datang ini?")) return;
    await fetch(`/api/return-incoming/${id}`, { method: "DELETE" });
    setIncoming((c) => c.filter((x) => x.id !== id));
    onChanged();
  }

  async function addResolution() {
    if (!newResolution.qty) return;
    const res = await fetch("/api/return-resolutions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partId, ...newResolution }),
    });
    if (res.ok) {
      const row = await res.json();
      setResolutions((r) => [row, ...r]);
      setNewResolution({ tanggal: todayInputValue(), jenis: "kirim_ulang", qty: "" });
      onChanged();
    }
  }

  async function patchResolution(id: string, field: string, value: string) {
    await fetch(`/api/return-resolutions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    setResolutions((r) => r.map((x) => (x.id === id ? { ...x, [field]: value } : x)));
    onChanged();
  }

  async function removeResolution(id: string) {
    if (!confirm("Hapus catatan ini?")) return;
    await fetch(`/api/return-resolutions/${id}`, { method: "DELETE" });
    setResolutions((r) => r.filter((x) => x.id !== id));
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
        style={{ background: "var(--surface)", border: "1px solid var(--border)", maxHeight: "88vh" }}
      >
        <div className="px-5 py-3.5 flex items-center justify-between shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div>
            <div className="text-[13.5px] font-semibold">{namaBarang}</div>
            <div className="text-[12px] font-mono-num" style={{ color: "var(--text-secondary)" }}>
              Datang {fmt(totalDatang)} · Kirim Ulang {fmt(totalKirimUlang)} · Spoilage {fmt(totalSpoilage)} · Sisa{" "}
              <span style={{ color: sisa > 0 ? "var(--warn)" : "var(--success)" }}>{fmt(sisa)}</span>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-md cursor-pointer flex items-center justify-center" style={{ color: "var(--text-muted)" }}>
            ×
          </button>
        </div>

        <div className="flex-1 overflow-auto grid grid-cols-1 md:grid-cols-2 gap-0">
          {/* ── DATANG ── */}
          <div style={{ borderRight: "1px solid var(--border)" }}>
            <div className="px-4 py-2.5 text-[12.5px] font-semibold sticky top-0" style={{ background: "var(--surface-muted)" }}>
              Barang Datang (Retur)
            </div>
            <div className="p-3 flex flex-col gap-1.5" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="grid grid-cols-3 gap-1.5">
                <input type="date" value={newIncoming.tanggal} onChange={(e) => setNewIncoming((s) => ({ ...s, tanggal: e.target.value }))} className="h-7 px-1.5 rounded text-[11.5px]" style={inputStyle} />
                <input type="text" placeholder="No. SJ *" value={newIncoming.noSj} onChange={(e) => setNewIncoming((s) => ({ ...s, noSj: e.target.value }))} className="h-7 px-1.5 rounded text-[11.5px]" style={inputStyle} />
                <input type="number" placeholder="Qty" value={newIncoming.qty} onChange={(e) => setNewIncoming((s) => ({ ...s, qty: e.target.value }))} className="h-7 px-1.5 rounded text-[11.5px] font-mono-num" style={inputStyle} />
              </div>
              <div className="flex gap-1.5">
                <input type="text" placeholder="Alasan retur (misal: Reject - minta diganti)" value={newIncoming.alasan} onChange={(e) => setNewIncoming((s) => ({ ...s, alasan: e.target.value }))} className="h-7 px-1.5 rounded text-[11.5px] flex-1" style={inputStyle} />
                <button onClick={addIncoming} className="h-7 px-3 rounded text-[11.5px] font-medium text-white cursor-pointer shrink-0" style={{ background: "var(--accent)" }}>
                  + Tambah
                </button>
              </div>
            </div>
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr style={{ background: "var(--surface-muted)" }}>
                  <th className="px-2 py-1.5 text-left font-medium" style={{ color: "var(--text-secondary)" }}>Tgl</th>
                  <th className="px-2 py-1.5 text-left font-medium" style={{ color: "var(--text-secondary)" }}>No. SJ</th>
                  <th className="px-2 py-1.5 text-right font-medium" style={{ color: "var(--text-secondary)" }}>Qty</th>
                  <th className="px-2 py-1.5 text-left font-medium" style={{ color: "var(--text-secondary)" }}>Alasan</th>
                  <th className="w-6"></th>
                </tr>
              </thead>
              <tbody>
                {!loading && incoming.length === 0 && (
                  <tr><td colSpan={5} className="px-2 py-4 text-center" style={{ color: "var(--text-muted)" }}>Belum ada catatan.</td></tr>
                )}
                {incoming.map((i) => (
                  <tr key={i.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td className="px-2 py-1 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>{fmtDate(i.tanggal)}</td>
                    <td className="p-0"><EditableCell value={i.noSj} onSave={(v) => patchIncoming(i.id, "noSj", v)} /></td>
                    <td className="p-0"><EditableCell value={i.qty} align="right" type="number" mono onSave={(v) => patchIncoming(i.id, "qty", v)} /></td>
                    <td className="p-0"><EditableCell value={i.alasan ?? ""} onSave={(v) => patchIncoming(i.id, "alasan", v)} /></td>
                    <td className="text-center">
                      <button onClick={() => removeIncoming(i.id)} className="w-5 h-5 rounded cursor-pointer" style={{ color: "var(--text-muted)" }}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── RESOLUSI ── */}
          <div>
            <div className="px-4 py-2.5 text-[12.5px] font-semibold sticky top-0" style={{ background: "var(--surface-muted)" }}>
              Kirim Ulang / Spoilage
            </div>
            <div className="p-3" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="grid grid-cols-[1fr_1.2fr_1fr_auto] gap-1.5">
                <input type="date" value={newResolution.tanggal} onChange={(e) => setNewResolution((s) => ({ ...s, tanggal: e.target.value }))} className="h-7 px-1.5 rounded text-[11.5px]" style={inputStyle} />
                <select value={newResolution.jenis} onChange={(e) => setNewResolution((s) => ({ ...s, jenis: e.target.value }))} className="h-7 px-1.5 rounded text-[11.5px] cursor-pointer" style={inputStyle}>
                  <option value="kirim_ulang" style={{ background: "var(--surface)", color: "var(--text-primary)" }}>Kirim Ulang (repair)</option>
                  <option value="spoilage" style={{ background: "var(--surface)", color: "var(--text-primary)" }}>Spoilage (hangus)</option>
                </select>
                <input type="number" placeholder="Qty" value={newResolution.qty} onChange={(e) => setNewResolution((s) => ({ ...s, qty: e.target.value }))} className="h-7 px-1.5 rounded text-[11.5px] font-mono-num" style={inputStyle} />
                <button onClick={addResolution} className="h-7 px-2 rounded text-[11.5px] font-medium text-white cursor-pointer" style={{ background: "var(--accent)" }}>
                  +
                </button>
              </div>
            </div>
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr style={{ background: "var(--surface-muted)" }}>
                  <th className="px-2 py-1.5 text-left font-medium" style={{ color: "var(--text-secondary)" }}>Tgl</th>
                  <th className="px-2 py-1.5 text-left font-medium" style={{ color: "var(--text-secondary)" }}>Jenis</th>
                  <th className="px-2 py-1.5 text-right font-medium" style={{ color: "var(--text-secondary)" }}>Qty</th>
                  <th className="w-6"></th>
                </tr>
              </thead>
              <tbody>
                {!loading && resolutions.length === 0 && (
                  <tr><td colSpan={4} className="px-2 py-4 text-center" style={{ color: "var(--text-muted)" }}>Belum ada catatan.</td></tr>
                )}
                {resolutions.map((r) => (
                  <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td className="px-2 py-1 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>{fmtDate(r.tanggal)}</td>
                    <td className="px-2 py-1">
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px]"
                        style={{
                          background: r.jenis === "spoilage" ? "var(--danger-soft)" : "var(--success-soft)",
                          color: r.jenis === "spoilage" ? "var(--danger)" : "var(--success)",
                        }}
                      >
                        {r.jenis === "spoilage" ? "Spoilage" : "Kirim Ulang"}
                      </span>
                    </td>
                    <td className="p-0"><EditableCell value={r.qty} align="right" type="number" mono onSave={(v) => patchResolution(r.id, "qty", v)} /></td>
                    <td className="text-center">
                      <button onClick={() => removeResolution(r.id)} className="w-5 h-5 rounded cursor-pointer" style={{ color: "var(--text-muted)" }}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
