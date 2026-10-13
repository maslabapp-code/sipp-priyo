"use client";

import { useEffect, useMemo, useState } from "react";
import { useAutoRefresh } from "@/components/layout/DataSync";
import { SearchableSelect } from "../ui/SearchableSelect";
import { labelJenis } from "@/lib/material-jenis";
import { modeOf, MODE_LABEL, estimasiPcs, type PartPakai } from "@/lib/qty-mode";
import { QuickAddCustomer, QuickAddMaterial } from "../ui/QuickAddModal";

type Customer = { id: string; nama: string };
type Material = { id: string; nama: string; satuan: string | null; jenis: string; parts?: PartPakai[] };
type Line = { rawMaterialId: string; qty: string; qty2: string; satuan2: string };
type HistoryItem = { nama: string; satuan: string | null; qty: string; qty2: string | null; satuan2: string | null };
type HistoryRow = { id: string; noSj: string; tanggal: string; noPo: string | null; customerNama: string | null; items: HistoryItem[] };

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(n);
}
const emptyLine = (): Line => ({ rawMaterialId: "", qty: "", qty2: "", satuan2: "Pita" });

export function SuratJalanMasuk() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [tanggal, setTanggal] = useState(todayInputValue());
  const [noSj, setNoSj] = useState("");
  const [noPo, setNoPo] = useState("");
  const [catatan, setCatatan] = useState("");
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  // Popup tambah cepat: customer, atau bahan baku untuk baris ke-idx
  const [quick, setQuick] = useState<null | { type: "customer"; nama: string } | { type: "material"; idx: number; nama: string }>(null);

  const inputStyle: React.CSSProperties = {
    background: "var(--surface)",
    color: "var(--text-primary)",
    border: "1px solid var(--border)",
  };

  async function loadHistory(silent = false) {
    if (!silent) setLoadingHistory(true);
    const res = await fetch("/api/surat-jalan-masuk");
    const data = await res.json();
    setHistory(Array.isArray(data) ? data : []);
    if (!silent) setLoadingHistory(false);
  }

  async function loadMasters() {
    const [c, m] = await Promise.all([fetch("/api/customers"), fetch("/api/raw-materials")]);
    setCustomers(await c.json());
    setMaterials(await m.json());
  }

  useEffect(() => {
    loadMasters();
    loadHistory();
  }, []);

  // Muat ulang diam-diam: customer, bahan baku, dan riwayat. Isian form SJ Masuk yang sedang dikerjakan tidak disentuh.
  useAutoRefresh(async () => {
    await Promise.all([loadMasters(), loadHistory(true)]);
  });

  const materialById = useMemo(() => new Map(materials.map((m) => [m.id, m])), [materials]);

  function updateLine(idx: number, field: keyof Line, value: string) {
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  }
  function removeLine(idx: number) {
    setLines((ls) => (ls.length === 1 ? [emptyLine()] : ls.filter((_, i) => i !== idx)));
  }

  async function save() {
    setError("");
    const filled = lines.filter((l) => l.rawMaterialId || l.qty || l.qty2);
    if (!noSj.trim() || !tanggal || filled.length === 0) {
      setError("No. SJ, tanggal, dan minimal 1 baris material wajib diisi.");
      return;
    }
    // Isian utama tiap baris mengikuti jenis bahan baku: lembar/pita -> jumlah lembar/pita, selain itu -> Kg atau pcs
    const utama = (l: Line) => {
      const m = modeOf(materialById.get(l.rawMaterialId)?.jenis);
      return m === "lembar" || m === "pita" ? Number(l.qty2) : Number(l.qty);
    };
    if (filled.some((l) => !l.rawMaterialId)) {
      setError("Setiap baris harus memilih material.");
      return;
    }
    const kosong = filled.find((l) => !(utama(l) > 0));
    if (kosong) {
      const m = materialById.get(kosong.rawMaterialId);
      setError(`${MODE_LABEL[modeOf(m?.jenis)]} wajib diisi untuk ${m?.nama}.`);
      return;
    }
    setSaving(true);
    const res = await fetch("/api/surat-jalan-masuk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        noSj,
        customerId: customerId || null,
        tanggal,
        noPo,
        catatan,
        items: filled.map((l) => {
          const mode = modeOf(materialById.get(l.rawMaterialId)?.jenis);
          const pakaiQty2 = mode === "lembar" || mode === "pita";
          return {
            rawMaterialId: l.rawMaterialId,
            qty: Number(l.qty) || 0, // Kg tagihan (opsional untuk lembaran dan pita)
            qty2: pakaiQty2 ? Number(l.qty2) : null,
            satuan2: pakaiQty2 ? (mode === "lembar" ? "Lembar" : "Pita") : null,
          };
        }),
      }),
    });
    setSaving(false);
    if (res.ok) {
      setNoSj("");
      setNoPo("");
      setCatatan("");
      setLines([emptyLine()]);
      loadHistory();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Gagal menyimpan SJ Masuk.");
    }
  }

  async function removeHistory(id: string) {
    if (!confirm("Hapus SJ Masuk ini? Kedatangan material dari SJ ini di Stok Bahan Baku juga ikut terhapus.")) return;
    const res = await fetch(`/api/surat-jalan-masuk/${id}`, { method: "DELETE" });
    if (res.ok) setHistory((h) => h.filter((x) => x.id !== id));
    else {
      const d = await res.json().catch(() => ({}));
      alert(d.error || "Gagal menghapus.");
    }
  }

  return (
    <div className="h-full flex flex-col p-5">
      <div className="mb-4 shrink-0">
        <h1 className="text-[15px] font-semibold">Surat Jalan Masuk</h1>
        <p className="text-[12.5px]" style={{ color: "var(--text-secondary)" }}>
          Catat SJ material yang datang dari customer (mis. CPL). Setiap baris otomatis menjadi kedatangan di Stok Bahan Baku.
        </p>
      </div>

      <div className="rounded-lg p-4 mb-6 shrink-0" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-3">
          <div>
            <label className="text-[11.5px] mb-1 block" style={{ color: "var(--text-secondary)" }}>Customer (pengirim)</label>
            <SearchableSelect
              options={customers.map((c) => ({ value: c.id, label: c.nama }))}
              value={customerId}
              onChange={setCustomerId}
              placeholder="Pilih customer..."
              onCreate={(t) => setQuick({ type: "customer", nama: t })}
              createLabel="customer"
            />
          </div>
          <div>
            <label className="text-[11.5px] mb-1 block" style={{ color: "var(--text-secondary)" }}>Tanggal Datang</label>
            <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} className="w-full h-8 px-2 rounded-md text-[12.5px]" style={inputStyle} />
          </div>
          <div>
            <label className="text-[11.5px] mb-1 block" style={{ color: "var(--text-secondary)" }}>No. SJ dari Customer</label>
            <input value={noSj} onChange={(e) => setNoSj(e.target.value)} placeholder="CPL/SJ-11925/2026" className="w-full h-8 px-2 rounded-md text-[12.5px] font-mono-num" style={inputStyle} />
          </div>
          <div>
            <label className="text-[11.5px] mb-1 block" style={{ color: "var(--text-secondary)" }}>No. PO (boleh kosong)</label>
            <input value={noPo} onChange={(e) => setNoPo(e.target.value)} className="w-full h-8 px-2 rounded-md text-[12.5px] font-mono-num" style={inputStyle} />
          </div>
        </div>

        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[12px] font-medium">Material yang datang</span>
          <button onClick={() => setLines((ls) => [...ls, emptyLine()])} className="h-7 px-2 rounded text-[11.5px] cursor-pointer" style={{ border: "1px solid var(--border)", color: "var(--accent)" }}>
            + Tambah baris
          </button>
        </div>

        <div className="rounded-md overflow-hidden mb-3" style={{ border: "1px solid var(--border)" }}>
          <table className="w-full text-[12.5px] border-collapse">
            <thead>
              <tr style={{ background: "var(--surface-muted)" }}>
                <th className="text-left px-2 py-1.5" style={{ color: "var(--text-secondary)" }}>Material</th>
                <th className="text-right px-2 py-1.5 w-36" style={{ color: "var(--text-secondary)" }}>Qty</th>
                <th className="text-right px-2 py-1.5 w-32" style={{ color: "var(--text-secondary)" }}>Kg tagihan (opsional)</th>
                <th className="text-left px-2 py-1.5" style={{ color: "var(--text-secondary)" }}>Perkiraan total</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, idx) => {
                const mat = materialById.get(l.rawMaterialId);
                const mode = modeOf(mat?.jenis);
                const pakaiQty2 = mode === "lembar" || mode === "pita";
                const nilaiUtama = pakaiQty2 ? l.qty2 : l.qty;
                const est = mat && (mode === "kg" || pakaiQty2) ? estimasiPcs(Number(nilaiUtama), mat.parts ?? []) : [];
                const semuaSama = est.length > 0 && est.every((e) => Math.round(e.pcs) === Math.round(est[0].pcs));
                return (
                  <tr key={idx} style={{ borderTop: "1px solid var(--border)" }}>
                    <td className="p-1">
                      <SearchableSelect
                        options={materials.map((m) => ({ value: m.id, label: m.nama }))}
                        value={l.rawMaterialId}
                        onChange={(v) => updateLine(idx, "rawMaterialId", v)}
                        placeholder="Pilih material..."
                        size="sm"
                        onCreate={(t) => setQuick({ type: "material", idx, nama: t })}
                        createLabel="bahan baku"
                      />
                      {mat && (
                        <span className="text-[10.5px]" style={{ color: "var(--text-muted)" }}>
                          {labelJenis(mat.jenis)} · ketik {MODE_LABEL[mode].toLowerCase()}
                        </span>
                      )}
                    </td>
                    <td className="p-1 align-top">
                      <input
                        type="number"
                        value={nilaiUtama}
                        onChange={(e) => updateLine(idx, pakaiQty2 ? "qty2" : "qty", e.target.value)}
                        placeholder={mat ? MODE_LABEL[mode] : "Qty"}
                        className="w-full h-7 px-1.5 rounded text-[12px] text-right font-mono-num"
                        style={inputStyle}
                      />
                    </td>
                    <td className="p-1 align-top">
                      {pakaiQty2 ? (
                        <input type="number" value={l.qty} onChange={(e) => updateLine(idx, "qty", e.target.value)} placeholder="Kg" className="w-full h-7 px-1.5 rounded text-[12px] text-right font-mono-num" style={inputStyle} />
                      ) : (
                        <span className="block text-right text-[11px] pt-1.5" style={{ color: "var(--text-muted)" }}>—</span>
                      )}
                    </td>
                    <td className="px-2 py-1 align-top text-[11.5px]" style={{ color: "var(--text-secondary)" }}>
                      {!mat ? (
                        ""
                      ) : mode === "pcs" ? (
                        "Sudah dalam pcs"
                      ) : est.length === 0 ? (
                        <span style={{ color: "var(--text-muted)" }}>
                          {Number(nilaiUtama) > 0 ? "Belum ada part dengan konversi untuk bahan baku ini (atur di Master Part)." : ""}
                        </span>
                      ) : semuaSama ? (
                        <>
                          ≈ <b className="font-mono-num">{fmt(est[0].pcs)}</b> pcs
                          <div style={{ color: "var(--text-muted)" }}>{est.length > 1 ? `untuk ${est.length} part` : est[0].nama}</div>
                        </>
                      ) : (
                        <>
                          {est.slice(0, 3).map((e, i) => (
                            <div key={i}>
                              {e.nama}: ≈ <b className="font-mono-num">{fmt(e.pcs)}</b> pcs
                            </div>
                          ))}
                          {est.length > 3 && <div style={{ color: "var(--text-muted)" }}>+{est.length - 3} part lain</div>}
                        </>
                      )}
                    </td>
                    <td className="text-center align-top pt-1"><button onClick={() => removeLine(idx)} className="w-6 h-6 rounded cursor-pointer" style={{ color: "var(--text-muted)" }}>×</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <textarea value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Catatan (opsional)..." className="w-full h-14 px-2 py-1.5 rounded-md text-[12.5px] mb-3" style={inputStyle} />

        {error && (
          <div className="text-[12px] mb-3 px-3 py-2 rounded-md" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>{error}</div>
        )}

        <button onClick={save} disabled={saving} className="h-9 px-4 rounded-md text-[12.5px] font-medium text-white cursor-pointer disabled:opacity-50" style={{ background: "var(--accent)" }}>
          {saving ? "Menyimpan..." : "💾 Simpan SJ Masuk"}
        </button>
      </div>

      {quick?.type === "customer" && (
        <QuickAddCustomer
          initialName={quick.nama}
          existing={customers}
          onClose={() => setQuick(null)}
          onCreated={(row) => {
            setCustomers((c) => (c.some((x) => x.id === row.id) ? c : [{ id: row.id, nama: row.nama }, ...c]));
            setCustomerId(row.id);
            setQuick(null);
          }}
        />
      )}
      {quick?.type === "material" && (
        <QuickAddMaterial
          initialName={quick.nama}
          existing={materials}
          onClose={() => setQuick(null)}
          onCreated={(row) => {
            const m: Material = { id: row.id, nama: row.nama, satuan: (row.satuan as string | null) ?? null, jenis: (row.jenis as string) ?? "lembaran" };
            setMaterials((list) => (list.some((x) => x.id === m.id) ? list : [...list, m]));
            updateLine(quick.idx, "rawMaterialId", m.id);
            setQuick(null);
          }}
        />
      )}

      <div className="mb-2 shrink-0">
        <h2 className="text-[13.5px] font-semibold">Riwayat SJ Masuk</h2>
      </div>
      <div className="rounded-lg overflow-auto flex-1 min-h-0" style={{ border: "1px solid var(--border)" }}>
        <table className="text-[12.5px] border-collapse w-full">
          <thead className="sticky top-0 z-10">
            <tr style={{ background: "var(--surface-muted)" }}>
              <th className="px-2 py-2 text-left font-medium" style={{ color: "var(--text-secondary)" }}>Tanggal</th>
              <th className="px-2 py-2 text-left font-medium" style={{ color: "var(--text-secondary)" }}>No. SJ</th>
              <th className="px-2 py-2 text-left font-medium" style={{ color: "var(--text-secondary)" }}>Customer</th>
              <th className="px-2 py-2 text-left font-medium" style={{ color: "var(--text-secondary)" }}>No. PO</th>
              <th className="px-2 py-2 text-left font-medium" style={{ color: "var(--text-secondary)" }}>Material</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {loadingHistory && (
              <tr><td colSpan={6} className="px-3 py-6 text-center" style={{ color: "var(--text-muted)" }}>Memuat...</td></tr>
            )}
            {!loadingHistory && history.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center" style={{ color: "var(--text-muted)" }}>Belum ada SJ Masuk yang dicatat.</td></tr>
            )}
            {history.map((r) => (
              <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td className="px-2 py-1.5 align-top" style={{ color: "var(--text-secondary)" }}>{fmtDate(r.tanggal)}</td>
                <td className="px-2 py-1.5 align-top font-mono-num">{r.noSj}</td>
                <td className="px-2 py-1.5 align-top">{r.customerNama ?? "—"}</td>
                <td className="px-2 py-1.5 align-top font-mono-num">{r.noPo ?? "—"}</td>
                <td className="px-2 py-1.5">
                  {r.items.map((it, i) => (
                    <div key={i}>
                      {it.nama}: <span className="font-mono-num">{fmt(Number(it.qty))} {it.satuan ?? "Kg"}</span>
                      {it.qty2 && <span style={{ color: "var(--text-muted)" }}> ({fmt(Number(it.qty2))} {it.satuan2})</span>}
                    </div>
                  ))}
                </td>
                <td className="text-center align-top pt-1"><button onClick={() => removeHistory(r.id)} className="w-6 h-6 rounded cursor-pointer" style={{ color: "var(--text-muted)" }} title="Hapus">×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
