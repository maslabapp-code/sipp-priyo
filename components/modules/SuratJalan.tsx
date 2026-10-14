"use client";

import { useEffect, useMemo, useState } from "react";
import { useAutoRefresh } from "@/components/layout/DataSync";
import { SortableTh } from "../ui/SortableTh";
import { useTableControls } from "@/lib/hooks/useTableControls";
import { SearchableSelect } from "../ui/SearchableSelect";
import { uniqueOptions } from "@/lib/unique-options";
import { JENIS_SJ, MAX_ITEM_PER_SJ } from "@/lib/sj-const";
import { QuickAddCustomer } from "../ui/QuickAddModal";

type Customer = { id: string; nama: string };
type Part = { id: string; namaBarang: string; customerId: string | null };
type Item = { partId?: string; namaBarang: string; qty: string; satuan?: string };
type HistoryRow = { id: string; noSj: string; tanggal: string; customerNama: string | null; jumlahItem: number };

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function SuratJalan() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [allParts, setAllParts] = useState<Part[]>([]);
  const [addingPartId, setAddingPartId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [tanggal, setTanggal] = useState(todayInputValue());
  const [noSj, setNoSj] = useState("");
  const [jenis, setJenis] = useState("P");
  const [quickCustomer, setQuickCustomer] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; noSj: string }[]>([]);
  const [catatan, setCatatan] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const inputStyle: React.CSSProperties = {
    background: "var(--surface)",
    color: "var(--text-primary)",
    border: "1px solid var(--border)",
  };

  async function loadCustomers() {
    const res = await fetch("/api/customers");
    setCustomers(await res.json());
  }
  async function loadParts() {
    const res = await fetch("/api/parts");
    setAllParts(await res.json());
  }
  async function loadHistory(silent = false) {
    if (!silent) setLoadingHistory(true);
    const res = await fetch("/api/surat-jalan");
    setHistory(await res.json());
    if (!silent) setLoadingHistory(false);
  }

  // Muat ulang diam-diam: daftar customer, part, dan riwayat. Isian form SJ yang sedang dikerjakan tidak disentuh.
  useAutoRefresh(async () => {
    await Promise.all([loadCustomers(), loadParts(), loadHistory(true)]);
  });

  useEffect(() => {
    loadCustomers();
    loadParts();
    loadHistory();
  }, []);

  async function suggestNoSj(forTanggal: string, forJenis: string = jenis) {
    const res = await fetch(`/api/surat-jalan/next-number?tanggal=${forTanggal}&jenis=${forJenis}`);
    const d = await res.json();
    setNoSj(d.noSj);
  }

  async function pullFromKirim() {
    if (!customerId || !tanggal) return;
    setLoadingItems(true);
    const res = await fetch(`/api/surat-jalan/preview-items?customerId=${customerId}&tanggal=${tanggal}`);
    const data: { partId: string; namaBarang: string; qty: number }[] = await res.json();
    setItems(data.map((d) => ({ partId: d.partId, namaBarang: d.namaBarang, qty: String(d.qty), satuan: "" })));
    setLoadingItems(false);
  }

  useEffect(() => {
    if (customerId && tanggal) pullFromKirim();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, tanggal]);

  // Nomor SJ disarankan ulang saat tanggal atau jenis (P/J/W) berubah
  useEffect(() => {
    if (tanggal) suggestNoSj(tanggal, jenis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tanggal, jenis]);

  function addManualItem() {
    setItems((it) => [...it, { namaBarang: "", qty: "0", satuan: "" }]);
  }
  function addFromMasterPart() {
    if (!addingPartId) return;
    const part = allParts.find((p) => p.id === addingPartId);
    if (!part) return;
    setItems((it) => [...it, { partId: part.id, namaBarang: part.namaBarang, qty: "0", satuan: "" }]);
    setAddingPartId("");
  }
  function updateItem(idx: number, field: keyof Item, value: string) {
    setItems((it) => it.map((row, i) => (i === idx ? { ...row, [field]: value } : row)));
  }
  function removeItem(idx: number) {
    setItems((it) => it.filter((_, i) => i !== idx));
  }

  // Kalau customer sudah dipilih, hanya tampilkan part milik customer itu — supaya tidak salah pilih barang customer lain.
  const availablePartsForCustomer = useMemo(
    () => allParts.filter((p) => !customerId || p.customerId === customerId),
    [allParts, customerId]
  );

  async function saveAndPrint() {
    setError("");
    if (!noSj || !tanggal || items.length === 0) {
      setError("No. SJ, tanggal, dan minimal 1 item wajib diisi.");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/surat-jalan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        noSj,
        jenis,
        customerId: customerId || null,
        tanggal,
        catatan,
        items: items.map((it) => ({ partId: it.partId, namaBarang: it.namaBarang, qty: Number(it.qty) || 0, satuan: it.satuan })),
      }),
    });
    setSaving(false);
    if (res.ok) {
      const data: { id: string; noSj: string; all?: { id: string; noSj: string }[] } = await res.json();
      const list = data.all && data.all.length > 0 ? data.all : [{ id: data.id, noSj: data.noSj }];
      setCreated(list);
      window.open(`/api/surat-jalan/${list[0].id}/pdf`, "_blank");
      setItems([]);
      setCatatan("");
      loadHistory();
      suggestNoSj(tanggal, jenis);
    } else {
      const d = await res.json();
      setError(d.error || "Gagal menyimpan Surat Jalan.");
    }
  }

  async function removeHistory(id: string) {
    if (!confirm("Hapus riwayat Surat Jalan ini?")) return;
    await fetch(`/api/surat-jalan/${id}`, { method: "DELETE" });
    setHistory((h) => h.filter((x) => x.id !== id));
  }

  const { filteredSorted, filters, setFilter, sortKey, sortDir, toggleSort } = useTableControls<HistoryRow>(history, {
    noSj: (r) => r.noSj,
    customerNama: (r) => r.customerNama,
  });

  return (
    <div className="h-full flex flex-col p-5">
      {quickCustomer !== null && (
        <QuickAddCustomer
          initialName={quickCustomer}
          existing={customers}
          onClose={() => setQuickCustomer(null)}
          onCreated={(row) => {
            setCustomers((c) => (c.some((x) => x.id === row.id) ? c : [{ id: row.id, nama: row.nama }, ...c]));
            setCustomerId(row.id);
            setQuickCustomer(null);
          }}
        />
      )}

      <div className="mb-4 shrink-0">
        <h1 className="text-[15px] font-semibold">Cetak Surat Jalan Keluar</h1>
        <p className="text-[12.5px]" style={{ color: "var(--text-secondary)" }}>
          Pilih Customer &amp; Tanggal — item otomatis ditarik dari data Kirim, bisa ditambah/edit manual sebelum dicetak.
        </p>
      </div>

      <div className="rounded-lg p-4 mb-6 shrink-0" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-3">
          <div>
            <label className="text-[11.5px] mb-1 block" style={{ color: "var(--text-secondary)" }}>Jenis SJ</label>
            <select value={jenis} onChange={(e) => setJenis(e.target.value)} className="w-full h-8 px-2 rounded-md text-[12.5px]" style={inputStyle}>
              {JENIS_SJ.map((j) => (
                <option key={j.value} value={j.value}>{j.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11.5px] mb-1 block" style={{ color: "var(--text-secondary)" }}>Customer</label>
            <SearchableSelect
              options={customers.map((c) => ({ value: c.id, label: c.nama }))}
              value={customerId}
              onChange={setCustomerId}
              placeholder="Pilih customer..."
              onCreate={(t) => setQuickCustomer(t)}
              createLabel="customer"
            />
          </div>
          <div>
            <label className="text-[11.5px] mb-1 block" style={{ color: "var(--text-secondary)" }}>Tanggal Kirim</label>
            <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} className="w-full h-8 px-2 rounded-md text-[12.5px]" style={inputStyle} />
          </div>
          <div>
            <label className="text-[11.5px] mb-1 block" style={{ color: "var(--text-secondary)" }}>No. Surat Jalan</label>
            <input value={noSj} onChange={(e) => setNoSj(e.target.value)} className="w-full h-8 px-2 rounded-md text-[12.5px] font-mono-num" style={inputStyle} />
          </div>
        </div>

        <div className="flex items-center justify-between mb-1.5 gap-2 flex-wrap">
          <span className="text-[12px] font-medium">Daftar Item</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {loadingItems && <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Menarik data kirim...</span>}
            <button onClick={pullFromKirim} className="h-7 px-2 rounded text-[11.5px] cursor-pointer" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
              ↻ Tarik ulang dari Kirim
            </button>
            <SearchableSelect
              options={availablePartsForCustomer.map((p) => ({ value: p.id, label: p.namaBarang }))}
              value={addingPartId}
              onChange={setAddingPartId}
              placeholder="+ Pilih dari Master Part..."
              size="sm"
              className="max-w-[180px]"
            />
            <button onClick={addFromMasterPart} disabled={!addingPartId} className="h-7 px-2 rounded text-[11.5px] cursor-pointer disabled:opacity-40" style={{ border: "1px solid var(--border)", color: "var(--accent)" }}>
              + Tambah
            </button>
            <button onClick={addManualItem} className="h-7 px-2 rounded text-[11.5px] cursor-pointer" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
              + Item bebas (ketik manual)
            </button>
          </div>
        </div>

        <div className="rounded-md overflow-hidden mb-3" style={{ border: "1px solid var(--border)" }}>
          <table className="w-full text-[12.5px] border-collapse">
            <thead>
              <tr style={{ background: "var(--surface-muted)" }}>
                <th className="text-left px-2 py-1.5" style={{ color: "var(--text-secondary)" }}>Nama Barang</th>
                <th className="text-right px-2 py-1.5 w-24" style={{ color: "var(--text-secondary)" }}>Qty</th>
                <th className="text-left px-2 py-1.5 w-28" style={{ color: "var(--text-secondary)" }}>Satuan</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={4} className="px-2 py-4 text-center" style={{ color: "var(--text-muted)" }}>Belum ada item. Pilih Customer + Tanggal, atau tambah manual.</td></tr>
              )}
              {items.map((it, idx) => (
                <tr key={idx} style={{ borderTop: "1px solid var(--border)" }}>
                  <td className="p-1"><input value={it.namaBarang} onChange={(e) => updateItem(idx, "namaBarang", e.target.value)} className="w-full h-7 px-1.5 rounded text-[12px]" style={inputStyle} /></td>
                  <td className="p-1"><input type="number" value={it.qty} onChange={(e) => updateItem(idx, "qty", e.target.value)} className="w-full h-7 px-1.5 rounded text-[12px] text-right font-mono-num" style={inputStyle} /></td>
                  <td className="p-1"><input value={it.satuan ?? ""} onChange={(e) => updateItem(idx, "satuan", e.target.value)} placeholder="pcs" className="w-full h-7 px-1.5 rounded text-[12px]" style={inputStyle} /></td>
                  <td className="text-center"><button onClick={() => removeItem(idx)} className="w-6 h-6 rounded cursor-pointer" style={{ color: "var(--text-muted)" }}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <textarea
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
          placeholder="Catatan (opsional)..."
          className="w-full h-16 px-2 py-1.5 rounded-md text-[12.5px] mb-3"
          style={inputStyle}
        />

        {items.length > MAX_ITEM_PER_SJ && (
          <div className="text-[12px] mb-3 px-3 py-2 rounded-md" style={{ background: "var(--surface-muted)", color: "var(--text-secondary)" }}>
            Item lebih dari {MAX_ITEM_PER_SJ} baris, jadi otomatis dipecah menjadi {Math.ceil(items.length / MAX_ITEM_PER_SJ)} SJ dengan nomor berbeda.
          </div>
        )}

        {error && (
          <div className="text-[12px] mb-3 px-3 py-2 rounded-md" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>{error}</div>
        )}

        {created.length > 0 && (
          <div className="text-[12px] mb-3 px-3 py-2 rounded-md" style={{ background: "var(--surface-muted)", color: "var(--text-secondary)" }}>
            SJ tersimpan:{" "}
            {created.map((c) => (
              <a key={c.id} href={`/api/surat-jalan/${c.id}/pdf`} target="_blank" rel="noreferrer" className="font-mono-num mr-3" style={{ color: "var(--accent)" }}>
                {c.noSj} (cetak)
              </a>
            ))}
          </div>
        )}

        <button
          onClick={saveAndPrint}
          disabled={saving}
          className="h-9 px-4 rounded-md text-[12.5px] font-medium text-white cursor-pointer disabled:opacity-50"
          style={{ background: "var(--accent)" }}
        >
          {saving ? "Menyimpan..." : "💾 Simpan & Cetak PDF"}
        </button>
      </div>

      <div className="mb-2 shrink-0">
        <h2 className="text-[13.5px] font-semibold">Riwayat Surat Jalan</h2>
      </div>
      <div className="rounded-lg overflow-auto flex-1 min-h-0" style={{ border: "1px solid var(--border)" }}>
        <table className="text-[12.5px] border-collapse w-full">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="px-2 py-2 font-medium sticky top-0 text-left" style={{ color: "var(--text-secondary)", background: "var(--surface-muted)", minWidth: 44 }}>No</th>
              <SortableTh label="No. SJ" active={sortKey === "noSj"} dir={sortDir} onClick={() => toggleSort("noSj")} width={140} />
              <th className="px-2 py-2 font-medium sticky top-0 text-left" style={{ color: "var(--text-secondary)", background: "var(--surface-muted)", minWidth: 100 }}>Tanggal</th>
              <SortableTh label="Customer" active={sortKey === "customerNama"} dir={sortDir} onClick={() => toggleSort("customerNama")} width={140} />
              <th className="px-2 py-2 font-medium sticky top-0 text-center" style={{ color: "var(--text-secondary)", background: "var(--surface-muted)", minWidth: 80 }}>Jumlah Item</th>
              <th className="sticky top-0" style={{ background: "var(--surface-muted)", minWidth: 100 }}></th>
            </tr>
            <tr style={{ background: "var(--surface)" }}>
              <td className="px-1 py-1" style={{ borderBottom: "1px solid var(--border)" }}></td>
              <td className="px-1 py-1" style={{ borderBottom: "1px solid var(--border)" }}>
                <input value={filters.noSj ?? ""} onChange={(e) => setFilter("noSj", e.target.value)} placeholder="Cari..." className="w-full h-7 px-1.5 rounded text-[11.5px] outline-none" style={inputStyle} />
              </td>
              <td className="px-1 py-1" style={{ borderBottom: "1px solid var(--border)" }}></td>
              <td className="px-1 py-1" style={{ borderBottom: "1px solid var(--border)" }}>
                <SearchableSelect options={uniqueOptions(history, (r) => r.customerNama)} value={filters.customerNama ?? ""} onChange={(v) => setFilter("customerNama", v)} placeholder="Cari..." size="sm" />
              </td>
              <td className="px-1 py-1" style={{ borderBottom: "1px solid var(--border)" }}></td>
              <td className="px-1 py-1" style={{ borderBottom: "1px solid var(--border)" }}></td>
            </tr>
          </thead>
          <tbody>
            {loadingHistory && (
              <tr><td colSpan={6} className="px-3 py-6 text-center" style={{ color: "var(--text-muted)" }}>Memuat...</td></tr>
            )}
            {!loadingHistory && filteredSorted.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center" style={{ color: "var(--text-muted)" }}>Belum ada Surat Jalan yang dibuat.</td></tr>
            )}
            {filteredSorted.map((r, idx) => (
              <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td className="px-2 py-1.5 font-mono-num" style={{ color: "var(--text-muted)" }}>{idx + 1}</td>
                <td className="px-2 py-1.5 font-mono-num">{r.noSj}</td>
                <td className="px-2 py-1.5" style={{ color: "var(--text-secondary)" }}>{fmtDate(r.tanggal)}</td>
                <td className="px-2 py-1.5">{r.customerNama ?? "—"}</td>
                <td className="px-2 py-1.5 text-center font-mono-num">{r.jumlahItem}</td>
                <td className="text-center whitespace-nowrap">
                  <a href={`/api/surat-jalan/${r.id}/pdf`} target="_blank" rel="noreferrer" className="h-6 px-2 rounded text-[11px] font-medium cursor-pointer no-underline inline-block" style={{ border: "1px solid var(--border)", color: "var(--accent)" }}>
                    Cetak Ulang
                  </a>{" "}
                  <button onClick={() => removeHistory(r.id)} className="w-6 h-6 rounded cursor-pointer" style={{ color: "var(--text-muted)" }} title="Hapus">×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
