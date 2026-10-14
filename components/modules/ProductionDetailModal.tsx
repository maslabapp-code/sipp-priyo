"use client";

import { useEffect, useState } from "react";
import { EditableCell } from "../ui/EditableCell";
import { SearchableSelect } from "../ui/SearchableSelect";

type Cut = {
  id: string;
  tanggal: string;
  qty: string;
  konversi: string;
  konversi2: string;
  satuan: string | null;
  rawMaterialUsageId: string | null;
  bahanBakuNama: string | null;
};
type BahanBakuBatch = { id: string; rawMaterialId: string; namaBahanBaku: string; satuan: string | null; satuanStok: string; noSj: string | null; sisa: number };
type BahanInfo = {
  rawMaterialId: string | null;
  bahanBakuNama: string | null;
  satuanPotong: string | null;
  konversiPcs: string | null;
  terkunci: boolean; // konversi dikunci dari Master Part
  batchAktif: { id: string; noSj: string | null; tanggal: string; sisa: number; satuanStok: string } | null;
};
type SatuanOption = { id: string; nama: string };
type Delivery = { tanggal: string; qty: string };

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(n);
}
function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}
// Isi awal form potong: kalau part punya konversi/satuan tetap di Master Part, langsung terisi
function blankCut(inf: BahanInfo | null) {
  return {
    tanggal: todayInputValue(),
    qty: "",
    konversi: inf?.terkunci ? String(Number(inf.konversiPcs)) : "1",
    konversi2: "1",
    satuan: inf?.satuanPotong ?? "",
    rawMaterialBatchId: "",
  };
}

export function ProductionDetailModal({
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
  const [cuts, setCuts] = useState<Cut[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [batches, setBatches] = useState<BahanBakuBatch[]>([]);
  const [satuanOptions, setSatuanOptions] = useState<SatuanOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [info, setInfo] = useState<BahanInfo | null>(null);
  const [gantiBatch, setGantiBatch] = useState(false);
  const [newCut, setNewCut] = useState(blankCut(null));
  const [cutError, setCutError] = useState("");
  const [cutNotice, setCutNotice] = useState("");
  const [newDelivery, setNewDelivery] = useState({ tanggal: todayInputValue(), qty: "" });

  async function load() {
    setLoading(true);
    const [cutsRes, delRes, batchRes, satuanRes, infoRes] = await Promise.all([
      fetch(`/api/production-cuts?partId=${partId}`),
      fetch(`/api/production/kirim?partId=${partId}`),
      fetch(`/api/raw-material/summary`),
      fetch(`/api/satuan-potong`),
      fetch(`/api/production/bahan-baku?partId=${partId}`),
    ]);
    setCuts((await cutsRes.json()).reverse());
    setDeliveries((await delRes.json()).reverse());
    setBatches(await batchRes.json());
    setSatuanOptions(await satuanRes.json());
    const inf: BahanInfo | null = infoRes.ok ? await infoRes.json() : null;
    setInfo(inf);
    setNewCut((s) => ({
      ...s,
      konversi: inf?.terkunci ? String(Number(inf.konversiPcs)) : s.konversi,
      satuan: inf?.satuanPotong ?? s.satuan,
    }));
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partId]);

  const totalPotong = cuts.reduce(
    (s, c) => s + Number(c.qty) * Number(c.konversi) * Number(c.konversi2),
    0
  );
  const totalKirim = deliveries.reduce((s, d) => s + Number(d.qty), 0);

  async function addCut() {
    if (!newCut.qty || Number(newCut.qty) <= 0) {
      setCutError("Isi Qty terlebih dahulu (harus lebih dari 0).");
      return;
    }
    setCutError("");
    setCutNotice("");
    const res = await fetch("/api/production-cuts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partId, ...newCut, rawMaterialBatchId: newCut.rawMaterialBatchId || null }),
    });
    if (res.ok) {
      const saved = await res.json().catch(() => null);
      await load();
      setNewCut(blankCut(info));
      setGantiBatch(false);
      setCutNotice(
        saved?.peringatan ??
          (Array.isArray(saved?.alokasi) && saved.alokasi.length > 0
            ? "Stok dikurangi dari: " +
              (saved.alokasi as { noSj: string | null; qty: number; satuanStok: string }[])
                .map((a) => `${a.noSj ?? "kedatangan tanpa No. SJ"} (${fmt(a.qty)} ${a.satuanStok})`)
                .join(", ") +
              "."
            : "")
      );
      onChanged();
    } else {
      const body = await res.json().catch(() => ({}));
      setCutError(body.error || "Gagal menyimpan catatan potong, coba lagi.");
    }
  }

  async function patchCut(id: string, field: string, value: string) {
    await fetch(`/api/production-cuts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    setCuts((c) => c.map((x) => (x.id === id ? { ...x, [field]: value } : x)));
    onChanged();
  }

  async function removeCut(id: string) {
    const cut = cuts.find((c) => c.id === id);
    const msg = cut?.rawMaterialUsageId
      ? "Hapus catatan potong ini? Pemakaian bahan baku yang terhubung juga akan dihapus (stok dikembalikan)."
      : "Hapus catatan potong ini?";
    if (!confirm(msg)) return;
    await fetch(`/api/production-cuts/${id}`, { method: "DELETE" });
    setCuts((c) => c.filter((x) => x.id !== id));
    onChanged();
  }

  async function addDelivery() {
    if (!newDelivery.qty) return;
    const res = await fetch("/api/production/kirim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partId, tanggal: newDelivery.tanggal, qty: newDelivery.qty }),
    });
    if (res.ok) {
      await load();
      setNewDelivery({ tanggal: todayInputValue(), qty: "" });
      onChanged();
    }
  }

  async function patchDelivery(tanggal: string, value: string) {
    await fetch("/api/production/kirim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partId, tanggal, qty: value }),
    });
    setDeliveries((d) => d.map((x) => (x.tanggal === tanggal ? { ...x, qty: value } : x)));
    onChanged();
  }

  async function removeDelivery(tanggal: string) {
    if (!confirm("Hapus catatan kirim ini? (Angka Kirim di Transaksi Bulanan tanggal ini juga akan jadi 0)")) return;
    await fetch("/api/production/kirim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partId, tanggal, qty: 0 }),
    });
    setDeliveries((d) => d.filter((x) => x.tanggal !== tanggal));
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
        <div
          className="px-5 py-3.5 flex items-center justify-between shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div>
            <div className="text-[13.5px] font-semibold">{namaBarang}</div>
            <div className="text-[12px] font-mono-num" style={{ color: "var(--text-secondary)" }}>
              Total Potong {fmt(totalPotong)} · Total Kirim {fmt(totalKirim)} · Sisa Stok{" "}
              <span style={{ color: totalPotong - totalKirim > 0 ? "var(--warn)" : "var(--success)" }}>
                {fmt(totalPotong - totalKirim)}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md cursor-pointer flex items-center justify-center"
            style={{ color: "var(--text-muted)" }}
          >
            ×
          </button>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 gap-0">
          {/* ── POTONG ── */}
          <div className="flex flex-col min-h-0" style={{ borderRight: "1px solid var(--border)" }}>
            <div className="px-4 py-2.5 text-[12.5px] font-semibold shrink-0" style={{ background: "var(--surface-muted)" }}>
              Riwayat Potong
            </div>
            <div className="p-3 flex flex-col gap-2 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-0.5">
                  <span className="text-[10.5px]" style={{ color: "var(--text-muted)" }}>Tanggal</span>
                  <input type="date" value={newCut.tanggal} onChange={(e) => setNewCut((s) => ({ ...s, tanggal: e.target.value }))} className="h-7 px-1.5 rounded text-[11.5px]" style={inputStyle} />
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-[10.5px]" style={{ color: "var(--text-muted)" }}>Qty Potong</span>
                  <input type="number" placeholder="0" value={newCut.qty} onChange={(e) => setNewCut((s) => ({ ...s, qty: e.target.value }))} className="h-7 px-1.5 rounded text-[11.5px] font-mono-num" style={inputStyle} />
                </label>
              </div>
              <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                <label className="flex flex-col gap-0.5">
                  <span className="text-[10.5px]" style={{ color: "var(--text-muted)" }}>Konversi (pcs/unit)</span>
                  <input type="number" placeholder="1" value={newCut.konversi} onChange={(e) => setNewCut((s) => ({ ...s, konversi: e.target.value }))} disabled={!!info?.terkunci} className="h-7 px-1.5 rounded text-[11.5px] font-mono-num disabled:opacity-60" style={inputStyle} title={info?.terkunci ? "Dikunci dari Master Part" : "Pcs per unit (lembar/pita)"} />
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-[10.5px]" style={{ color: "var(--text-muted)" }}>Satuan</span>
                  <SearchableSelect
                    options={[
                      ...satuanOptions.map((s) => ({ value: s.nama, label: s.nama })),
                      { value: "__new__", label: "+ Tambah baru..." },
                    ]}
                    value={newCut.satuan}
                    onChange={async (v) => {
                      if (v === "__new__") {
                        const nama = window.prompt("Nama satuan baru (misal: Lembar, Pita, Kg):");
                        if (!nama || !nama.trim()) return;
                        const res = await fetch("/api/satuan-potong", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ nama: nama.trim() }),
                        });
                        const newSat = await res.json();
                        setSatuanOptions((s) => (s.some((x) => x.nama === newSat.nama) ? s : [...s, newSat]));
                        setNewCut((s) => ({ ...s, satuan: nama.trim() }));
                        return;
                      }
                      setNewCut((s) => ({ ...s, satuan: v }));
                    }}
                    placeholder="Pilih..."
                    size="sm"
                    disabled={!!info?.terkunci}
                  />
                </label>
                <button onClick={addCut} className="h-7 px-3 rounded text-[11.5px] font-medium text-white cursor-pointer shrink-0" style={{ background: "var(--accent)" }}>
                  + Tambah
                </button>
              </div>
              <label className="flex flex-col gap-0.5">
                <span className="text-[10.5px]" style={{ color: "var(--text-muted)" }}>Konversi 2 (opsional — misal MESH: Pita × Lembar)</span>
                <input
                  type="number"
                  placeholder="1"
                  value={newCut.konversi2}
                  onChange={(e) => setNewCut((s) => ({ ...s, konversi2: e.target.value }))}
                  className="h-7 px-1.5 rounded text-[11.5px] font-mono-num w-full"
                  style={inputStyle}
                />
              </label>
              {cutError && (
                <div className="text-[11px] px-2 py-1 rounded" style={{ background: "#fee2e2", color: "#991b1b" }}>
                  {cutError}
                </div>
              )}
              {cutNotice && (
                <div className="text-[11px] px-2 py-1 rounded" style={{ background: "var(--surface-muted)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                  {cutNotice}
                </div>
              )}
              {info?.rawMaterialId ? (
                <div className="rounded px-2.5 py-2 text-[11px]" style={{ background: "var(--surface-muted)", border: "1px solid var(--border)" }}>
                  <div className="font-medium" style={{ color: "var(--text-primary)" }}>Bahan baku: {info.bahanBakuNama}</div>
                  <div style={{ color: "var(--text-secondary)" }}>
                    {info.batchAktif ? (
                      <>Otomatis diambil dari kedatangan {info.batchAktif.noSj ?? fmtDate(info.batchAktif.tanggal)} · sisa {fmt(info.batchAktif.sisa)} {info.batchAktif.satuanStok}</>
                    ) : (
                      <>Belum ada kedatangan (SJ Masuk) untuk bahan baku ini, jadi potong tidak mengurangi stok.</>
                    )}
                  </div>
                  {info.terkunci && (
                    <div style={{ color: "var(--text-muted)" }}>
                      Konversi {fmt(Number(info.konversiPcs))} pcs per {info.satuanPotong ?? "unit"} dikunci dari Master Part.
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setGantiBatch((v) => !v);
                      setNewCut((s) => ({ ...s, rawMaterialBatchId: "" }));
                    }}
                    className="mt-1 cursor-pointer underline"
                    style={{ color: "var(--accent)" }}
                  >
                    {gantiBatch ? "Pakai otomatis" : "Ganti kedatangan"}
                  </button>
                  {gantiBatch && (
                    <div className="mt-1">
                      <SearchableSelect
                        options={batches
                          .filter((b) => b.rawMaterialId === info.rawMaterialId)
                          .map((b) => ({ value: b.id, label: b.noSj ?? b.namaBahanBaku, sublabel: `sisa ${fmt(b.sisa)} ${b.satuanStok ?? ""}` }))}
                        value={newCut.rawMaterialBatchId}
                        onChange={(v) => setNewCut((s) => ({ ...s, rawMaterialBatchId: v }))}
                        placeholder="Pilih kedatangan..."
                        size="sm"
                        className="w-full"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <label className="flex flex-col gap-0.5">
                  <span className="text-[10.5px]" style={{ color: "var(--text-muted)" }}>
                    Part ini belum punya bahan baku di Master Part. Boleh pilih kedatangan manual (opsional, otomatis kurangi stok)
                  </span>
                  <SearchableSelect
                    options={batches.map((b) => ({ value: b.id, label: b.namaBahanBaku, sublabel: `sisa ${fmt(b.sisa)} ${b.satuanStok ?? b.satuan ?? ""}` }))}
                    value={newCut.rawMaterialBatchId}
                    onChange={(v) => setNewCut((s) => ({ ...s, rawMaterialBatchId: v }))}
                    placeholder="Pilih batch..."
                    size="sm"
                    className="w-full"
                  />
                </label>
              )}
            </div>
            <div className="flex-1 min-h-0 overflow-auto">
              <table className="w-full text-[11.5px] border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr style={{ background: "var(--surface-muted)" }}>
                    <th className="px-2 py-1.5 text-left font-medium" style={{ color: "var(--text-secondary)", background: "var(--surface-muted)" }}>Tgl</th>
                    <th className="px-2 py-1.5 text-right font-medium" style={{ color: "var(--text-secondary)", background: "var(--surface-muted)" }}>Qty</th>
                    <th className="px-2 py-1.5 text-right font-medium" style={{ color: "var(--text-secondary)", background: "var(--surface-muted)" }}>Konv.</th>
                    <th className="px-2 py-1.5 text-right font-medium" style={{ color: "var(--text-secondary)", background: "var(--surface-muted)" }}>Total</th>
                    <th className="w-6" style={{ background: "var(--surface-muted)" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {!loading && cuts.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-2 py-4 text-center" style={{ color: "var(--text-muted)" }}>
                        Belum ada catatan potong.
                      </td>
                    </tr>
                  )}
                  {cuts.map((c) => (
                    <tr key={c.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td className="px-2 py-1 whitespace-nowrap align-top" style={{ color: "var(--text-secondary)" }}>
                        {fmtDate(c.tanggal)}
                        {c.bahanBakuNama && (
                          <div className="text-[10px] mt-0.5" style={{ color: "var(--accent)" }} title="Otomatis kurangi Stok Bahan Baku">
                            🔗 {c.bahanBakuNama}
                          </div>
                        )}
                      </td>
                      <td className="p-0"><EditableCell value={c.qty} align="right" type="number" mono onSave={(v) => patchCut(c.id, "qty", v)} /></td>
                      <td className="p-0">
                        {info?.terkunci ? (
                          <span className="block px-2 py-1 text-right font-mono-num" title="Dikunci dari Master Part">{fmt(Number(c.konversi))}</span>
                        ) : (
                          <EditableCell value={c.konversi} align="right" type="number" mono onSave={(v) => patchCut(c.id, "konversi", v)} />
                        )}
                      </td>
                      <td className="px-2 py-1 text-right font-mono-num font-medium">
                        {fmt(Number(c.qty) * Number(c.konversi) * Number(c.konversi2))}
                      </td>
                      <td className="text-center">
                        <button onClick={() => removeCut(c.id)} className="w-5 h-5 rounded cursor-pointer" style={{ color: "var(--text-muted)" }}>×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── KIRIM ── */}
          <div className="flex flex-col min-h-0">
            <div className="px-4 py-2.5 text-[12.5px] font-semibold shrink-0" style={{ background: "var(--surface-muted)" }}>
              Riwayat Kirim <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(nyambung ke Transaksi Bulanan)</span>
            </div>
            <div className="p-3 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                <label className="flex flex-col gap-0.5">
                  <span className="text-[10.5px]" style={{ color: "var(--text-muted)" }}>Tanggal</span>
                  <input type="date" value={newDelivery.tanggal} onChange={(e) => setNewDelivery((s) => ({ ...s, tanggal: e.target.value }))} className="h-7 px-1.5 rounded text-[11.5px]" style={inputStyle} />
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-[10.5px]" style={{ color: "var(--text-muted)" }}>Qty Kirim</span>
                  <input type="number" placeholder="0" value={newDelivery.qty} onChange={(e) => setNewDelivery((s) => ({ ...s, qty: e.target.value }))} className="h-7 px-1.5 rounded text-[11.5px] font-mono-num" style={inputStyle} />
                </label>
                <button onClick={addDelivery} className="h-7 px-3 rounded text-[11.5px] font-medium text-white cursor-pointer shrink-0" style={{ background: "var(--accent)" }}>
                  + Tambah
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-auto">
              <table className="w-full text-[11.5px] border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr style={{ background: "var(--surface-muted)" }}>
                    <th className="px-2 py-1.5 text-left font-medium" style={{ color: "var(--text-secondary)", background: "var(--surface-muted)" }}>Tgl</th>
                    <th className="px-2 py-1.5 text-right font-medium" style={{ color: "var(--text-secondary)", background: "var(--surface-muted)" }}>Qty</th>
                    <th className="w-6" style={{ background: "var(--surface-muted)" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {!loading && deliveries.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-2 py-4 text-center" style={{ color: "var(--text-muted)" }}>
                        Belum ada catatan kirim.
                      </td>
                    </tr>
                  )}
                  {deliveries.map((d) => (
                    <tr key={d.tanggal} style={{ borderTop: "1px solid var(--border)" }}>
                      <td className="px-2 py-1 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>{fmtDate(d.tanggal)}</td>
                      <td className="p-0"><EditableCell value={d.qty} align="right" type="number" mono onSave={(v) => patchDelivery(d.tanggal, v)} /></td>
                      <td className="text-center">
                        <button onClick={() => removeDelivery(d.tanggal)} className="w-5 h-5 rounded cursor-pointer" style={{ color: "var(--text-muted)" }}>×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
