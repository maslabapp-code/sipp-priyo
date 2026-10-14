"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAutoRefresh } from "@/components/layout/DataSync";
import { EditableCell } from "../ui/EditableCell";
import { DeliveryCalendarModal } from "./DeliveryCalendarModal";
import { useTableControls } from "@/lib/hooks/useTableControls";
import { ExportButton } from "../ui/ExportButton";
import { fetchJson } from "@/lib/api-client";
import { SearchableSelect } from "../ui/SearchableSelect";
import { uniqueOptions } from "@/lib/unique-options";

type Row = {
  id: string | null; // null = part belum punya baris di bulan ini (belum tersimpan di database)
  partId: string;
  namaBarang: string;
  kodePart: string | null;
  customerNama: string | null;
  noPo: string | null;
  stock: string;
  poAct: string;
  poCpl1: string;
  poCpl2: string;
  poCpl3: string;
  hargaJual: string;
  kirim: number;
  dailyDeliveries: { tanggal: number; qtyKirim: string; qtyRencana: string }[];
  totalPo: number;
  sisaPo: number;
  actualPenjualan: number;
  ppn10: number;
  totalPenjualan: number;
};
const HARI_SINGKAT = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const DAY_W = 56; // lebar kolom tanggal (dulu 80) supaya lebih banyak tanggal terlihat sekaligus
const KEY_TAMPILAN = "mtp-tb-tampilan";
const KEY_KOLOM = "mtp-tb-kolom";

function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; text: string }[];
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11.5px]" style={{ color: "var(--text-muted)" }}>{label}</span>
      <div className="flex rounded-md overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        {options.map((o) => (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className="h-8 px-2.5 text-[12px] cursor-pointer"
            style={{ background: value === o.value ? "var(--accent)" : "var(--surface)", color: value === o.value ? "#fff" : "var(--text-primary)" }}
          >
            {o.text}
          </button>
        ))}
      </div>
    </div>
  );
}

const BULAN_LABEL = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Math.round(n));
}

/** Tampilkan angka dari DB (misal "0.00") sebagai bilangan bulat tanpa desimal, untuk ditampilkan di kolom yang bisa diedit. */
function wholeNum(v: string | number | null | undefined) {
  const n = Number(v);
  if (!v || isNaN(n)) return "0";
  return String(Math.round(n));
}

function DayCell({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const cleanValue = value && Number(value) ? value : "";
  const [draft, setDraft] = useState(cleanValue);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft(cleanValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft === cleanValue) return;
        onSave(draft || "0");
        setSaved(true);
        setTimeout(() => setSaved(false), 800);
      }}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      placeholder="-"
      className={`w-full h-full text-center text-[12px] font-mono-num bg-transparent outline-none ${saved ? "cell-saved" : ""}`}
      style={{ color: "var(--accent)" }}
    />
  );
}

export function TransaksiBulanan() {
  const now = new Date();
  const [bulan, setBulan] = useState(now.getMonth() + 1);
  const [tahun, setTahun] = useState(now.getFullYear());
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [calendarFor, setCalendarFor] = useState<Row | null>(null);
  const [tampilan, setTampilan] = useState<"semua" | "aktif">("semua");
  const [kolom, setKolom] = useState<"fokus" | "lengkap">("fokus");
  const creating = useRef(new Map<string, Promise<string>>());

  const full = kolom === "lengkap";

  // pilihan tampilan diingat di browser ini
  useEffect(() => {
    try {
      const t = localStorage.getItem(KEY_TAMPILAN);
      const k = localStorage.getItem(KEY_KOLOM);
      if (t === "semua" || t === "aktif") setTampilan(t);
      if (k === "fokus" || k === "lengkap") setKolom(k);
    } catch {
      // penyimpanan browser tidak tersedia, pakai bawaan
    }
  }, []);
  function pilihTampilan(v: "semua" | "aktif") {
    setTampilan(v);
    try { localStorage.setItem(KEY_TAMPILAN, v); } catch { /* abaikan */ }
  }
  function pilihKolom(v: "fokus" | "lengkap") {
    setKolom(v);
    try { localStorage.setItem(KEY_KOLOM, v); } catch { /* abaikan */ }
  }

  function tampilError(msg: string) {
    setSaveError(msg);
    setTimeout(() => setSaveError(""), 8000);
  }

  // silent = muat ulang diam-diam (tanpa tulisan "Memuat..." dan tanpa pesan error), dipakai pembaruan otomatis
  async function load(silent = false) {
    if (!silent) {
      setLoading(true);
      setLoadError("");
    }
    try {
      const txData = await fetchJson<Row[]>(`/api/monthly-transactions?bulan=${bulan}&tahun=${tahun}&semua=1`);
      setRows(txData);
    } catch (e) {
      if (!silent) setLoadError(e instanceof Error ? e.message : "Gagal memuat data.");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useAutoRefresh(() => load(true));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bulan, tahun]);

  // "aktif" = part yang sudah punya baris tersimpan di bulan ini
  const rowsTampil = useMemo(() => (tampilan === "aktif" ? rows.filter((r) => !!r.id) : rows), [rows, tampilan]);
  const jumlahAktif = useMemo(() => rows.filter((r) => !!r.id).length, [rows]);

  const { filteredSorted, filters, setFilter, sortKey, sortDir, toggleSort } = useTableControls<Row>(rowsTampil, {
    namaBarang: (r) => r.namaBarang,
    customerNama: (r) => r.customerNama,
    noPo: (r) => r.noPo,
    stock: (r) => Number(r.stock),
    poAct: (r) => Number(r.poAct),
    poCpl1: (r) => Number(r.poCpl1),
    poCpl2: (r) => Number(r.poCpl2),
    poCpl3: (r) => Number(r.poCpl3),
    totalPo: (r) => r.totalPo,
    kirim: (r) => r.kirim,
    sisaPo: (r) => r.sisaPo,
    hargaJual: (r) => Number(r.hargaJual),
    actualPenjualan: (r) => r.actualPenjualan,
    ppn10: (r) => r.ppn10,
    totalPenjualan: (r) => r.totalPenjualan,
  });

  // Baris untuk part yang belum punya data bulan ini baru dibuat di database saat pertama kali diisi.
  async function ensureTx(row: Row): Promise<string> {
    if (row.id) return row.id;
    const sedang = creating.current.get(row.partId);
    if (sedang) return sedang;
    const p = (async () => {
      const res = await fetch("/api/monthly-transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partId: row.partId, bulan, tahun }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error ?? `Gagal menyimpan baris baru (kode ${res.status}).`);
      }
      const tx = await res.json();
      setRows((rs) => rs.map((r) => (r.partId === row.partId ? { ...r, id: tx.id } : r)));
      return tx.id as string;
    })();
    creating.current.set(row.partId, p);
    try {
      return await p;
    } finally {
      creating.current.delete(row.partId);
    }
  }

  async function patchField(row: Row, field: string, value: string) {
    try {
      const id = await ensureTx(row);
      const res = await fetch(`/api/monthly-transactions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error ?? `Server merespons dengan error (kode ${res.status}).`);
      }
      const updated = await res.json();
      setRows((rs) => rs.map((r) => (r.partId === row.partId ? { ...r, ...updated } : r)));
    } catch (e) {
      tampilError(`Isian untuk "${row.namaBarang}" belum tersimpan: ${e instanceof Error ? e.message : "terjadi kesalahan"}`);
    }
  }

  async function saveDelivery(row: Row, tanggal: number, field: "qtyKirim" | "qtyRencana", qty: number) {
    try {
      const id = await ensureTx(row);
      const res = await fetch(`/api/monthly-transactions/${id}/delivery`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tanggal, [field]: qty }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error ?? `Server merespons dengan error (kode ${res.status}).`);
      }
      const updated = await res.json();
      setRows((rs) => rs.map((r) => (r.partId === row.partId ? { ...r, ...updated } : r)));
      setCalendarFor((c) => (c && c.partId === row.partId ? { ...c, ...updated } : c));
    } catch (e) {
      tampilError(`Kirim tanggal ${tanggal} untuk "${row.namaBarang}" belum tersimpan: ${e instanceof Error ? e.message : "terjadi kesalahan"}`);
    }
  }

  async function removeRow(row: Row) {
    if (!row.id) return;
    if (!confirm(`Kosongkan data "${row.namaBarang}" di ${BULAN_LABEL[bulan - 1]} ${tahun}? Stock, PO, dan kirim harian bulan ini akan dihapus. Part tetap ada di Master Part.`)) return;
    try {
      const res = await fetch(`/api/monthly-transactions/${row.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Server merespons dengan error (kode ${res.status}).`);
      await load();
    } catch (e) {
      tampilError(e instanceof Error ? e.message : "Gagal mengosongkan data.");
    }
  }

  const daysInMonth = new Date(tahun, bulan, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  function dayValue(row: Row, tanggal: number) {
    return row.dailyDeliveries.find((d) => d.tanggal === tanggal)?.qtyKirim ?? "0";
  }
  const dow = (d: number) => new Date(tahun, bulan - 1, d).getDay(); // 0 = Minggu
  const bulanIni = bulan === now.getMonth() + 1 && tahun === now.getFullYear();
  const hariIni = now.getDate();

  // Warna kolom tanggal: Minggu kemerahan, hari ini biru (selalu buram supaya tidak tembus saat scroll)
  const MINGGU = "#dc2626";
  const headBg = (d: number) =>
    bulanIni && d === hariIni
      ? "var(--accent)"
      : dow(d) === 0
        ? `color-mix(in srgb, ${MINGGU} 14%, var(--surface-muted))`
        : "var(--surface-muted)";
  const headColor = (d: number) => (bulanIni && d === hariIni ? "#fff" : dow(d) === 0 ? MINGGU : "var(--text-secondary)");
  const cellBg = (d: number) =>
    bulanIni && d === hariIni
      ? "color-mix(in srgb, var(--accent) 12%, var(--surface))"
      : dow(d) === 0
        ? `color-mix(in srgb, ${MINGGU} 7%, var(--surface))`
        : "var(--surface)";

  // Kolom yang dibekukan di kiri. Mode "Fokus tanggal": Customer disembunyikan.
  const FROZEN = full ? { namaBarang: 0, customer: 180, stock: 280 } : { namaBarang: 0, customer: 0, stock: 180 };
  // Kolom kanan yang dibekukan (nempel ke tepi kanan).
  // Lengkap : PO Act ... Total Penjualan, lalu tombol hapus.
  // Fokus   : hanya Total PO, Kirim, Sisa PO supaya kolom tanggal punya ruang.
  const RIGHT = full
    ? { poAct: 841, cpl1: 771, cpl2: 701, totalPo: 616, kirim: 531, sisaPo: 446, hargaJual: 351, actualPenjualan: 241, ppn: 151, totalPenjualan: 36, hapus: 0 }
    : { poAct: 0, cpl1: 0, cpl2: 0, totalPo: 206, kirim: 121, sisaPo: 36, hargaJual: 0, actualPenjualan: 0, ppn: 0, totalPenjualan: 0, hapus: 0 };
  const totalCols = (full ? 5 : 4) + days.length + (full ? 11 : 4);
  const borderKiriKanan = "1px solid var(--border-strong)";

  const visibleRows = filteredSorted;

  const totals = visibleRows.reduce(
    (acc, r) => ({
      totalPo: acc.totalPo + r.totalPo,
      kirim: acc.kirim + r.kirim,
      sisaPo: acc.sisaPo + r.sisaPo,
      totalPenjualan: acc.totalPenjualan + r.totalPenjualan,
    }),
    { totalPo: 0, kirim: 0, sisaPo: 0, totalPenjualan: 0 }
  );

  function sortArrow(key: string) {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  const th = (extra: React.CSSProperties): React.CSSProperties => ({ color: "var(--text-secondary)", background: "var(--surface-muted)", ...extra });
  const stickyR = (key: keyof typeof RIGHT, width: number, extra: React.CSSProperties = {}): React.CSSProperties => ({
    width,
    minWidth: width,
    right: RIGHT[key],
    position: "sticky",
    zIndex: 20,
    ...extra,
  });

  return (
    <div className="h-full flex flex-col p-5">
      <div className="flex items-end justify-between mb-4 gap-3 flex-wrap shrink-0">
        <div>
          <h1 className="text-[15px] font-semibold">Transaksi Bulanan</h1>
          <p className="text-[12.5px]" style={{ color: "var(--text-secondary)" }}>
            {visibleRows.length} / {rows.length} part ({jumlahAktif} sudah ada transaksi) — semua part dari Master Part tampil otomatis, baris tersimpan saat pertama kali diisi. Klik header untuk urutkan.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <ExportButton baseUrl="/api/export/transaksi-bulanan" params={{ bulan: String(bulan), tahun: String(tahun) }} />
          <select
            value={bulan}
            onChange={(e) => setBulan(Number(e.target.value))}
            className="h-8 px-2 rounded-md text-[12.5px] cursor-pointer"
            style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
          >
            {BULAN_LABEL.map((b, i) => (
              <option key={b} value={i + 1}>
                {b}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={tahun}
            onChange={(e) => setTahun(Number(e.target.value))}
            className="h-8 w-20 px-2 rounded-md text-[12.5px] font-mono-num"
            style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
          />

          <div className="w-px h-6 mx-1" style={{ background: "var(--border)" }} />

          <Segmented
            label="Part"
            value={tampilan}
            onChange={pilihTampilan}
            options={[
              { value: "semua", text: "Semua" },
              { value: "aktif", text: "Sudah ada transaksi" },
            ]}
          />
          <Segmented
            label="Kolom"
            value={kolom}
            onChange={pilihKolom}
            options={[
              { value: "fokus", text: "Fokus tanggal" },
              { value: "lengkap", text: "Lengkap" },
            ]}
          />
        </div>
      </div>

      {loadError && (
        <div
          className="mb-3 px-3 py-2 rounded-md text-[12.5px] flex items-center justify-between gap-3 shrink-0"
          style={{ background: "#fee2e2", color: "#991b1b", border: "1px solid #fca5a5" }}
        >
          <span>{loadError}</span>
          <button onClick={() => load()} className="px-2 py-0.5 rounded text-[11.5px] font-medium cursor-pointer shrink-0" style={{ background: "#991b1b", color: "white" }}>
            Coba Lagi
          </button>
        </div>
      )}

      {saveError && (
        <div
          className="mb-3 px-3 py-2 rounded-md text-[12.5px] flex items-center justify-between gap-3 shrink-0"
          style={{ background: "#fee2e2", color: "#991b1b", border: "1px solid #fca5a5" }}
        >
          <span>{saveError}</span>
          <button onClick={() => setSaveError("")} className="px-2 py-0.5 rounded text-[11.5px] font-medium cursor-pointer shrink-0" style={{ background: "#991b1b", color: "white" }}>
            Tutup
          </button>
        </div>
      )}

      <div className="rounded-lg overflow-auto flex-1 min-h-0" style={{ border: "1px solid var(--border)" }}>
        <table className="text-[12.5px] border-collapse">
          <thead className="sticky top-0 z-20">
            <tr>
              <th className="px-2 py-2 font-medium sticky top-0 text-left" style={th({ width: 40, minWidth: 40 })}>No</th>
              <th
                className="px-2 py-2 font-medium sticky top-0 text-left cursor-pointer select-none"
                onClick={() => toggleSort("namaBarang")}
                style={th({ width: 180, minWidth: 180, left: FROZEN.namaBarang, position: "sticky", zIndex: 20 })}
              >
                Nama Barang{sortArrow("namaBarang")}
              </th>
              {full && (
                <th
                  className="px-2 py-2 font-medium sticky top-0 text-left whitespace-nowrap cursor-pointer select-none"
                  onClick={() => toggleSort("customerNama")}
                  style={th({ width: 100, minWidth: 100, left: FROZEN.customer, position: "sticky", zIndex: 20 })}
                >
                  Customer{sortArrow("customerNama")}
                </th>
              )}
              <th
                className="px-2 py-2 font-medium sticky top-0 text-right cursor-pointer select-none"
                onClick={() => toggleSort("stock")}
                style={th({ width: 80, minWidth: 80, left: FROZEN.stock, position: "sticky", zIndex: 20, borderRight: borderKiriKanan })}
              >
                Stock{sortArrow("stock")}
              </th>
              <th
                className="px-2 py-2 font-medium sticky top-0 text-left whitespace-nowrap cursor-pointer select-none"
                onClick={() => toggleSort("noPo")}
                style={th({ width: 110, minWidth: 110 })}
              >
                No. PO{sortArrow("noPo")}
              </th>
              {days.map((d) => (
                <th
                  key={d}
                  className="px-0 py-1 sticky top-0 text-center"
                  title={`${HARI_SINGKAT[dow(d)]}, ${d} ${BULAN_LABEL[bulan - 1]} ${tahun}`}
                  style={{ color: headColor(d), background: headBg(d), width: DAY_W, minWidth: DAY_W, borderRight: "1px solid var(--border)" }}
                >
                  <div className="text-[14px] font-semibold leading-tight font-mono-num">{d}</div>
                  <div className="text-[10.5px] font-normal leading-tight">{HARI_SINGKAT[dow(d)]}</div>
                </th>
              ))}
              {full && (
                <>
                  <th className="px-2 py-2 font-medium sticky top-0 text-right whitespace-nowrap" style={th(stickyR("poAct", 80, { borderLeft: borderKiriKanan }))}>PO Act</th>
                  <th className="px-2 py-2 font-medium sticky top-0 text-right whitespace-nowrap" style={th(stickyR("cpl1", 70))}>CPL 1</th>
                  <th className="px-2 py-2 font-medium sticky top-0 text-right whitespace-nowrap" style={th(stickyR("cpl2", 70))}>CPL 2</th>
                </>
              )}
              <th className="px-2 py-2 font-medium sticky top-0 text-right whitespace-nowrap" style={th(stickyR("totalPo", 85, full ? {} : { borderLeft: borderKiriKanan }))}>Total PO</th>
              <th className="px-2 py-2 font-medium sticky top-0 text-right whitespace-nowrap cursor-pointer select-none" onClick={() => toggleSort("kirim")} style={th(stickyR("kirim", 85))}>Kirim{sortArrow("kirim")}</th>
              <th className="px-2 py-2 font-medium sticky top-0 text-right whitespace-nowrap cursor-pointer select-none" onClick={() => toggleSort("sisaPo")} style={th(stickyR("sisaPo", 85))}>Sisa PO{sortArrow("sisaPo")}</th>
              {full && (
                <>
                  <th className="px-2 py-2 font-medium sticky top-0 text-right whitespace-nowrap" style={th(stickyR("hargaJual", 95))}>Harga Jual</th>
                  <th className="px-2 py-2 font-medium sticky top-0 text-right whitespace-nowrap" style={th(stickyR("actualPenjualan", 110))}>Actual Penjualan</th>
                  <th className="px-2 py-2 font-medium sticky top-0 text-right whitespace-nowrap" style={th(stickyR("ppn", 90))}>PPN 10%</th>
                  <th className="px-2 py-2 font-medium sticky top-0 text-right whitespace-nowrap cursor-pointer select-none" onClick={() => toggleSort("totalPenjualan")} style={th(stickyR("totalPenjualan", 115))}>Total Penjualan{sortArrow("totalPenjualan")}</th>
                </>
              )}
              <th className="sticky top-0" style={th(stickyR("hapus", 36))}></th>
            </tr>
            <tr style={{ background: "var(--surface)" }}>
              <td style={{ width: 40, minWidth: 40, borderBottom: "1px solid var(--border)" }}></td>
              <td className="p-1 sticky" style={{ background: "var(--surface)", width: 180, minWidth: 180, left: FROZEN.namaBarang, zIndex: 20, borderBottom: "1px solid var(--border)" }}>
                <SearchableSelect
                  options={uniqueOptions(rows, (r) => r.namaBarang)}
                  value={filters.namaBarang ?? ""}
                  onChange={(v) => setFilter("namaBarang", v)}
                  placeholder="Cari..."
                  size="sm"
                />
              </td>
              {full && (
                <td className="p-1 sticky" style={{ background: "var(--surface)", width: 100, minWidth: 100, left: FROZEN.customer, zIndex: 20, borderBottom: "1px solid var(--border)" }}>
                  <SearchableSelect
                    options={uniqueOptions(rows, (r) => r.customerNama)}
                    value={filters.customerNama ?? ""}
                    onChange={(v) => setFilter("customerNama", v)}
                    placeholder="Cari..."
                    size="sm"
                  />
                </td>
              )}
              <td className="p-1 sticky" style={{ background: "var(--surface)", width: 80, minWidth: 80, left: FROZEN.stock, zIndex: 20, borderRight: borderKiriKanan, borderBottom: "1px solid var(--border)" }}>
                <input
                  value={filters.stock ?? ""}
                  onChange={(e) => setFilter("stock", e.target.value)}
                  placeholder="Cari..."
                  className="w-full h-7 px-1.5 rounded text-[11.5px] outline-none"
                  style={{ background: "var(--surface)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                />
              </td>
              <td className="p-1" style={{ width: 110, minWidth: 110, borderBottom: "1px solid var(--border)" }}>
                <input
                  value={filters.noPo ?? ""}
                  onChange={(e) => setFilter("noPo", e.target.value)}
                  placeholder="Cari..."
                  className="w-full h-7 px-1.5 rounded text-[11.5px] outline-none"
                  style={{ background: "var(--surface)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                />
              </td>
              <td colSpan={days.length + (full ? 11 : 4)} style={{ borderBottom: "1px solid var(--border)" }}></td>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={totalCols} className="px-3 py-6 text-center" style={{ color: "var(--text-muted)" }}>
                  Memuat...
                </td>
              </tr>
            )}
            {!loading && visibleRows.length === 0 && (
              <tr>
                <td colSpan={totalCols} className="px-3 py-6 text-center" style={{ color: "var(--text-muted)" }}>
                  {rows.length === 0
                    ? "Belum ada part di Master Part. Tambahkan dulu di menu Master Part."
                    : tampilan === "aktif" && rowsTampil.length === 0
                      ? `Belum ada transaksi di ${BULAN_LABEL[bulan - 1]} ${tahun}. Pilih "Semua" di pilihan Part untuk mulai mengisi.`
                      : "Tidak ada hasil pencarian."}
                </td>
              </tr>
            )}
            {visibleRows.map((r, idx) => (
              <tr key={r.partId} style={{ borderTop: "1px solid var(--border)" }}>
                <td className="px-2 py-1.5 font-mono-num" style={{ color: "var(--text-muted)", background: "var(--surface)", width: 40, minWidth: 40 }}>
                  {idx + 1}
                </td>
                <td
                  className="px-2 py-1.5 truncate sticky"
                  title={r.namaBarang}
                  style={{ background: "var(--surface)", width: 180, minWidth: 180, left: FROZEN.namaBarang, zIndex: 10, color: r.id ? undefined : "var(--text-secondary)" }}
                >
                  {r.namaBarang}
                </td>
                {full && (
                  <td className="px-2 py-1.5 truncate sticky" style={{ background: "var(--surface)", width: 100, minWidth: 100, left: FROZEN.customer, zIndex: 10, color: "var(--text-secondary)" }}>
                    {r.customerNama ?? "—"}
                  </td>
                )}
                <td className="p-0 sticky" style={{ background: "var(--surface)", width: 80, minWidth: 80, left: FROZEN.stock, zIndex: 10, borderRight: borderKiriKanan }}>
                  <EditableCell value={wholeNum(r.stock)} align="right" type="number" mono onSave={(v) => patchField(r, "stock", v)} />
                </td>
                <td className="p-0" style={{ width: 110, minWidth: 110 }}>
                  <EditableCell value={r.noPo ?? ""} onSave={(v) => patchField(r, "noPo", v)} placeholder="—" />
                </td>
                {days.map((d) => (
                  <td key={d} className="p-0" style={{ width: DAY_W, minWidth: DAY_W, background: cellBg(d), borderRight: "1px solid var(--border)" }}>
                    <DayCell value={wholeNum(dayValue(r, d))} onSave={(v) => saveDelivery(r, d, "qtyKirim", Number(v) || 0)} />
                  </td>
                ))}
                {full && (
                  <>
                    <td className="p-0 sticky" style={{ width: 80, minWidth: 80, right: RIGHT.poAct, zIndex: 10, background: "var(--surface)", borderLeft: borderKiriKanan }}>
                      <EditableCell value={wholeNum(r.poAct)} align="right" type="number" mono onSave={(v) => patchField(r, "poAct", v)} />
                    </td>
                    <td className="p-0 sticky" style={{ width: 70, minWidth: 70, right: RIGHT.cpl1, zIndex: 10, background: "var(--surface)" }}>
                      <EditableCell value={wholeNum(r.poCpl1)} align="right" type="number" mono onSave={(v) => patchField(r, "poCpl1", v)} />
                    </td>
                    <td className="p-0 sticky" style={{ width: 70, minWidth: 70, right: RIGHT.cpl2, zIndex: 10, background: "var(--surface)" }}>
                      <EditableCell value={wholeNum(r.poCpl2)} align="right" type="number" mono onSave={(v) => patchField(r, "poCpl2", v)} />
                    </td>
                  </>
                )}
                <td className="px-2 py-1.5 text-right font-mono-num font-medium sticky" style={{ width: 85, minWidth: 85, right: RIGHT.totalPo, zIndex: 10, background: "var(--surface)", borderLeft: full ? undefined : borderKiriKanan }}>{fmt(r.totalPo)}</td>
                <td className="px-2 py-1.5 text-right sticky" style={{ width: 85, minWidth: 85, right: RIGHT.kirim, zIndex: 10, background: "var(--surface)" }}>
                  <button
                    onClick={() => setCalendarFor(r)}
                    className="font-mono-num underline decoration-dotted cursor-pointer"
                    style={{ color: "var(--accent)" }}
                    title="Klik untuk atur kirim harian (& rencana)"
                  >
                    {fmt(r.kirim)}
                  </button>
                </td>
                <td
                  className="px-2 py-1.5 text-right font-mono-num font-medium sticky"
                  style={{ width: 85, minWidth: 85, right: RIGHT.sisaPo, zIndex: 10, background: "var(--surface)", color: r.sisaPo > 0 ? "var(--warn)" : "var(--success)" }}
                >
                  {fmt(r.sisaPo)}
                </td>
                {full && (
                  <>
                    <td className="p-0 sticky" style={{ width: 95, minWidth: 95, right: RIGHT.hargaJual, zIndex: 10, background: "var(--surface)" }}>
                      <EditableCell value={wholeNum(r.hargaJual)} align="right" type="number" mono onSave={(v) => patchField(r, "hargaJual", v)} />
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono-num sticky" style={{ width: 110, minWidth: 110, right: RIGHT.actualPenjualan, zIndex: 10, background: "var(--surface)" }}>{fmt(r.actualPenjualan)}</td>
                    <td className="px-2 py-1.5 text-right font-mono-num sticky" style={{ width: 90, minWidth: 90, right: RIGHT.ppn, zIndex: 10, background: "var(--surface)", color: "var(--text-secondary)" }}>
                      {fmt(r.ppn10)}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono-num font-medium sticky" style={{ width: 115, minWidth: 115, right: RIGHT.totalPenjualan, zIndex: 10, background: "var(--surface)" }}>{fmt(r.totalPenjualan)}</td>
                  </>
                )}
                <td className="text-center sticky" style={{ width: 36, minWidth: 36, right: RIGHT.hapus, zIndex: 10, background: "var(--surface)" }}>
                  {r.id && (
                    <button
                      onClick={() => removeRow(r)}
                      className="w-6 h-6 rounded cursor-pointer"
                      style={{ color: "var(--text-muted)" }}
                      title="Kosongkan data bulan ini (part tetap ada di Master Part)"
                    >
                      ×
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          {visibleRows.length > 0 && (
            <tfoot className="sticky bottom-0 z-20">
              <tr style={{ background: "var(--surface-muted)", borderTop: "1px solid var(--border-strong)" }}>
                <td style={{ width: 40, minWidth: 40 }}></td>
                <td
                  className="px-2 py-2 font-semibold sticky whitespace-nowrap"
                  colSpan={full ? 3 : 2}
                  style={{ background: "var(--surface-muted)", left: FROZEN.namaBarang, zIndex: 10, borderRight: borderKiriKanan }}
                >
                  Total ({visibleRows.length} part)
                </td>
                <td></td>
                <td colSpan={days.length}></td>
                {full && (
                  <>
                    <td className="px-2 py-2 sticky" style={{ right: RIGHT.poAct, zIndex: 10, background: "var(--surface-muted)", borderLeft: borderKiriKanan }}></td>
                    <td className="px-2 py-2 sticky" style={{ right: RIGHT.cpl1, zIndex: 10, background: "var(--surface-muted)" }}></td>
                    <td className="px-2 py-2 sticky" style={{ right: RIGHT.cpl2, zIndex: 10, background: "var(--surface-muted)" }}></td>
                  </>
                )}
                <td className="px-2 py-2 text-right font-mono-num font-semibold sticky" style={{ right: RIGHT.totalPo, zIndex: 10, background: "var(--surface-muted)", borderLeft: full ? undefined : borderKiriKanan }}>{fmt(totals.totalPo)}</td>
                <td className="px-2 py-2 text-right font-mono-num font-semibold sticky" style={{ right: RIGHT.kirim, zIndex: 10, background: "var(--surface-muted)" }}>{fmt(totals.kirim)}</td>
                <td className="px-2 py-2 text-right font-mono-num font-semibold sticky" style={{ right: RIGHT.sisaPo, zIndex: 10, background: "var(--surface-muted)" }}>{fmt(totals.sisaPo)}</td>
                {full && (
                  <>
                    <td className="px-2 py-2 sticky" style={{ right: RIGHT.hargaJual, zIndex: 10, background: "var(--surface-muted)" }}></td>
                    <td className="px-2 py-2 sticky" style={{ right: RIGHT.actualPenjualan, zIndex: 10, background: "var(--surface-muted)" }}></td>
                    <td className="px-2 py-2 sticky" style={{ right: RIGHT.ppn, zIndex: 10, background: "var(--surface-muted)" }}></td>
                    <td className="px-2 py-2 text-right font-mono-num font-semibold sticky" style={{ right: RIGHT.totalPenjualan, zIndex: 10, background: "var(--surface-muted)" }}>{fmt(totals.totalPenjualan)}</td>
                  </>
                )}
                <td className="sticky" style={{ right: RIGHT.hapus, zIndex: 10, background: "var(--surface-muted)" }}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {calendarFor && (
        <DeliveryCalendarModal
          namaBarang={calendarFor.namaBarang}
          bulan={bulan}
          tahun={tahun}
          deliveries={calendarFor.dailyDeliveries}
          onClose={() => setCalendarFor(null)}
          onSave={(tanggal, field, qty) => saveDelivery(calendarFor, tanggal, field, qty)}
        />
      )}
    </div>
  );
}
