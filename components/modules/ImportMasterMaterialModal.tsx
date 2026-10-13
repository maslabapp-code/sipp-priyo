"use client";

import { useEffect, useMemo, useState } from "react";
import { SearchableSelect } from "../ui/SearchableSelect";

type Master = {
  id: string;
  customer: string | null;
  nama: string;
  jenis: string;
  material: string;
  grade: string;
  ukuran: string;
  satuanPotong: string | null;
  konversi: number | null;
  bruto: number | null;
  subPart: string | null;
  catatan: string | null;
};
type PartRow = {
  id: string;
  namaBarang: string;
  sudahTerhubung: boolean;
  bahanBakuNama: string | null;
  masterId: string | null;
  matchType: "cocok" | "disarankan" | "tidak";
};
type Filter = "semua" | "cek" | "tidak" | "terpilih";

const SKIP = "__skip__";

function fmt(n: number | null) {
  return n == null ? "—" : new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(n);
}

export function ImportMasterMaterialModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [masters, setMasters] = useState<Master[]>([]);
  const [rows, setRows] = useState<PartRow[]>([]);
  const [sel, setSel] = useState<Record<string, string>>({}); // partId -> masterId ("" = lewati)
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ updated: number; materialsCreated: number } | null>(null);
  const [filter, setFilter] = useState<Filter>("semua");
  const [query, setQuery] = useState("");

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/import/master-material");
      if (!res.ok) {
        setError("Gagal memuat data master. Coba lagi.");
        setLoading(false);
        return;
      }
      const data: { masters: Master[]; parts: PartRow[] } = await res.json();
      setMasters(data.masters);
      setRows(data.parts);
      // Usulan awal: yang sudah punya bahan baku dilewati (supaya tidak menimpa data yang sudah diperbaiki)
      const init: Record<string, string> = {};
      for (const p of data.parts) init[p.id] = !p.sudahTerhubung && p.masterId ? p.masterId : "";
      setSel(init);
      setLoading(false);
    })();
  }, []);

  const masterById = useMemo(() => new Map(masters.map((m) => [m.id, m])), [masters]);
  const options = useMemo(
    () => [
      { value: SKIP, label: "— Lewati (tidak dihubungkan) —" },
      ...masters.map((m) => ({
        value: m.id,
        label: m.nama,
        sublabel: `${m.material} · ${fmt(m.konversi)} pcs/${m.satuanPotong ?? "unit"}`,
      })),
    ],
    [masters]
  );

  const terpilih = rows.filter((r) => sel[r.id]).length;
  const shown = rows.filter((r) => {
    if (query && !r.namaBarang.toLowerCase().includes(query.toLowerCase())) return false;
    if (filter === "cek") return r.matchType === "disarankan";
    if (filter === "tidak") return r.matchType === "tidak";
    if (filter === "terpilih") return !!sel[r.id];
    return true;
  });
  const jumlah = {
    cocok: rows.filter((r) => r.matchType === "cocok").length,
    cek: rows.filter((r) => r.matchType === "disarankan").length,
    tidak: rows.filter((r) => r.matchType === "tidak").length,
  };

  async function apply() {
    setError("");
    const mappings = rows.filter((r) => sel[r.id]).map((r) => ({ partId: r.id, masterId: sel[r.id] }));
    if (mappings.length === 0) {
      setError("Belum ada part yang dipilih.");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/import/master-material", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mappings }),
    });
    setSaving(false);
    if (res.ok) {
      setResult(await res.json());
      onDone();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Gagal menyimpan, coba lagi.");
    }
  }

  const inputStyle: React.CSSProperties = {
    background: "var(--surface)",
    color: "var(--text-primary)",
    border: "1px solid var(--border)",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15, 20, 28, 0.5)" }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[94vw] max-w-[1200px] rounded-xl overflow-hidden flex flex-col"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", maxHeight: "90vh" }}
      >
        <div className="px-5 py-3.5 flex items-center justify-between shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div>
            <div className="text-[13.5px] font-semibold">Impor Master Material</div>
            <div className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
              Hubungkan tiap part dengan bahan baku (spesifikasi + ukuran) dan konversinya dari file DATA PART Bule Rita ({masters.length} baris). Cek dulu yang bertanda kuning.
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-md cursor-pointer" style={{ color: "var(--text-muted)" }}>×</button>
        </div>

        {result ? (
          <div className="p-6 text-[13px]">
            <div className="mb-2 font-medium" style={{ color: "var(--success)" }}>Selesai.</div>
            <div>{result.updated} part sudah dihubungkan ke bahan baku dan konversinya.</div>
            <div>{result.materialsCreated} bahan baku baru dibuat di Master Bahan Baku.</div>
            <button onClick={onClose} className="mt-4 h-8 px-4 rounded-md text-[12.5px] font-medium text-white cursor-pointer" style={{ background: "var(--accent)" }}>
              Tutup
            </button>
          </div>
        ) : (
          <>
            <div className="px-5 py-2.5 flex flex-wrap items-center gap-3 shrink-0 text-[12px]" style={{ borderBottom: "1px solid var(--border)" }}>
              <span><b>{jumlah.cocok}</b> cocok</span>
              <span style={{ color: "var(--warn)" }}><b>{jumlah.cek}</b> perlu dicek</span>
              <span style={{ color: "var(--text-muted)" }}><b>{jumlah.tidak}</b> belum ada pasangan</span>
              <span className="ml-auto"><b>{terpilih}</b> part akan dihubungkan</span>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari part..." className="h-7 px-2 rounded text-[12px]" style={inputStyle} />
              <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} className="h-7 px-2 rounded text-[12px]" style={inputStyle}>
                <option value="semua">Semua</option>
                <option value="cek">Perlu dicek</option>
                <option value="tidak">Belum ada pasangan</option>
                <option value="terpilih">Yang dipilih</option>
              </select>
            </div>

            <div className="flex-1 min-h-0 overflow-auto">
              <table className="w-full text-[12.5px] border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr style={{ background: "var(--surface-muted)" }}>
                    <th className="px-3 py-2 text-left font-medium" style={{ color: "var(--text-secondary)" }}>Part di aplikasi</th>
                    <th className="px-2 py-2 text-left font-medium w-24" style={{ color: "var(--text-secondary)" }}>Status</th>
                    <th className="px-2 py-2 text-left font-medium w-[380px]" style={{ color: "var(--text-secondary)" }}>Baris master yang dipakai</th>
                    <th className="px-2 py-2 text-left font-medium" style={{ color: "var(--text-secondary)" }}>Bahan baku dan konversi</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && <tr><td colSpan={4} className="px-3 py-6 text-center" style={{ color: "var(--text-muted)" }}>Memuat...</td></tr>}
                  {!loading && shown.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center" style={{ color: "var(--text-muted)" }}>Tidak ada part.</td></tr>}
                  {shown.map((r) => {
                    const m = sel[r.id] ? masterById.get(sel[r.id]) : undefined;
                    const badge =
                      r.sudahTerhubung && !sel[r.id]
                        ? { t: "Sudah ada", c: "var(--text-muted)" }
                        : r.matchType === "cocok"
                        ? { t: "Cocok", c: "var(--success)" }
                        : r.matchType === "disarankan"
                        ? { t: "Cek", c: "var(--warn)" }
                        : { t: "Belum ada", c: "var(--text-muted)" };
                    return (
                      <tr key={r.id} style={{ borderTop: "1px solid var(--border)", background: r.matchType === "disarankan" && sel[r.id] ? "var(--surface-muted)" : undefined }}>
                        <td className="px-3 py-1.5 align-top">
                          {r.namaBarang}
                          {r.sudahTerhubung && <div className="text-[10.5px]" style={{ color: "var(--text-muted)" }}>Sekarang: {r.bahanBakuNama}</div>}
                        </td>
                        <td className="px-2 py-1.5 align-top font-medium" style={{ color: badge.c }}>{badge.t}</td>
                        <td className="p-1 align-top">
                          <SearchableSelect
                            options={options}
                            value={sel[r.id] ?? ""}
                            onChange={(v) => setSel((s) => ({ ...s, [r.id]: v === SKIP ? "" : v }))}
                            placeholder="— Lewati —"
                            size="sm"
                          />
                        </td>
                        <td className="px-2 py-1.5 align-top text-[11.5px]" style={{ color: "var(--text-secondary)" }}>
                          {m ? (
                            <>
                              {m.material}
                              <div style={{ color: "var(--text-muted)" }}>
                                {fmt(m.konversi)} pcs/{m.satuanPotong ?? "unit"} · bruto {fmt(m.bruto)} pcs/kg{m.subPart ? ` · komponen: ${m.subPart}` : ""}
                              </div>
                              {m.catatan && <div style={{ color: "var(--warn)" }}>{m.catatan}</div>}
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="px-5 py-3 flex items-center gap-3 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
              {error && <span className="text-[12px]" style={{ color: "var(--danger)" }}>{error}</span>}
              <button onClick={onClose} className="ml-auto h-8 px-3 rounded-md text-[12.5px] cursor-pointer" style={{ border: "1px solid var(--border)" }}>Batal</button>
              <button onClick={apply} disabled={saving || loading} className="h-8 px-4 rounded-md text-[12.5px] font-medium text-white cursor-pointer disabled:opacity-50" style={{ background: "var(--accent)" }}>
                {saving ? "Menyimpan..." : `Hubungkan ${terpilih} part`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
