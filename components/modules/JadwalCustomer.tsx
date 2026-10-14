"use client";

import { useEffect, useMemo, useState } from "react";
import { useAutoRefresh } from "@/components/layout/DataSync";
import { SearchableSelect } from "../ui/SearchableSelect";

type DailyEntry = { tanggal: number; qtyKirim: string; qtyRencana: string };
type Row = {
  id: string;
  namaBarang: string;
  customerNama: string | null;
  dailyDeliveries: DailyEntry[];
};
type Customer = { id: string; nama: string };

const BULAN_LABEL = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function DayCell({
  value,
  variant,
  onSave,
}: {
  value: string;
  variant: "rencana" | "aktual";
  onSave: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value && Number(value) ? value : "");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft(value && Number(value) ? value : "");
  }, [value]);

  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft === (value && Number(value) ? value : "")) return;
        onSave(draft || "0");
        setSaved(true);
        setTimeout(() => setSaved(false), 800);
      }}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      placeholder="-"
      className={`w-full h-full text-center text-[11px] font-mono-num bg-transparent outline-none ${saved ? "cell-saved" : ""}`}
      style={{ color: variant === "aktual" ? "var(--accent)" : "var(--text-muted)" }}
    />
  );
}

export function JadwalCustomer() {
  const now = new Date();
  const [bulan, setBulan] = useState(now.getMonth() + 1);
  const [tahun, setTahun] = useState(now.getFullYear());
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerNama, setCustomerNama] = useState("");
  const [allRows, setAllRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadCustomers() {
    const res = await fetch("/api/customers");
    const data: Customer[] = await res.json();
    setCustomers(data);
    if (!customerNama && data.length) setCustomerNama(data[0].nama);
  }

  async function load(silent = false) {
    if (!silent) setLoading(true);
    const res = await fetch(`/api/monthly-transactions?bulan=${bulan}&tahun=${tahun}`);
    setAllRows(await res.json());
    if (!silent) setLoading(false);
  }

  useAutoRefresh(async () => {
    await Promise.all([loadCustomers(), load(true)]);
  });

  useEffect(() => {
    loadCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bulan, tahun]);

  const rows = useMemo(
    () => allRows.filter((r) => r.customerNama === customerNama),
    [allRows, customerNama]
  );

  const daysInMonth = new Date(tahun, bulan, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  async function saveDay(txId: string, tanggal: number, field: "qtyKirim" | "qtyRencana", value: string) {
    const res = await fetch(`/api/monthly-transactions/${txId}/delivery`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tanggal, [field]: Number(value) || 0 }),
    });
    if (res.ok) {
      const updated = await res.json();
      setAllRows((rs) => rs.map((r) => (r.id === txId ? { ...r, dailyDeliveries: updated.dailyDeliveries } : r)));
    }
  }

  function dayValue(row: Row, tanggal: number, field: "qtyKirim" | "qtyRencana") {
    return row.dailyDeliveries.find((d) => d.tanggal === tanggal)?.[field] ?? "0";
  }

  const inputStyle: React.CSSProperties = {
    background: "var(--surface)",
    color: "var(--text-primary)",
    border: "1px solid var(--border)",
  };

  return (
    <div className="p-5">
      <div className="flex items-end justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h1 className="text-[15px] font-semibold">Jadwal Customer</h1>
          <p className="text-[12.5px]" style={{ color: "var(--text-secondary)" }}>
            Rencana (Sch) vs Aktual (Act) kirim harian per customer.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SearchableSelect
            options={customers.map((c) => ({ value: c.nama, label: c.nama }))}
            value={customerNama}
            onChange={setCustomerNama}
            placeholder="Pilih customer..."
          />
          <select value={bulan} onChange={(e) => setBulan(Number(e.target.value))} className="h-8 px-2 rounded-md text-[12.5px] cursor-pointer" style={inputStyle}>
            {BULAN_LABEL.map((b, i) => (
              <option key={b} value={i + 1}>{b}</option>
            ))}
          </select>
          <input type="number" value={tahun} onChange={(e) => setTahun(Number(e.target.value))} className="h-8 w-20 px-2 rounded-md text-[12.5px] font-mono-num" style={inputStyle} />
        </div>
      </div>

      <div className="flex items-center gap-3 mb-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: "var(--text-muted)" }} /> Rencana (Sch)</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: "var(--accent)" }} /> Aktual (Act)</span>
      </div>

      <div className="rounded-lg overflow-auto" style={{ border: "1px solid var(--border)", maxHeight: "70vh" }}>
        <table className="text-[11px] border-collapse">
          <thead>
            <tr>
              <th
                className="px-2 py-2 font-medium sticky top-0 left-0 z-20 text-left whitespace-nowrap"
                style={{ color: "var(--text-secondary)", background: "var(--surface-muted)", minWidth: 180 }}
              >
                Nama Barang
              </th>
              <th
                className="px-1 py-2 font-medium sticky top-0 z-10 text-center"
                style={{ color: "var(--text-secondary)", background: "var(--surface-muted)", minWidth: 34 }}
              >
                &nbsp;
              </th>
              {days.map((d) => (
                <th
                  key={d}
                  className="px-1 py-2 font-medium sticky top-0 z-10 text-center"
                  style={{ color: "var(--text-secondary)", background: "var(--surface-muted)", minWidth: 30 }}
                >
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={days.length + 2} className="px-3 py-6 text-center" style={{ color: "var(--text-muted)" }}>
                  Memuat...
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={days.length + 2} className="px-3 py-6 text-center" style={{ color: "var(--text-muted)" }}>
                  {customers.length === 0
                    ? "Belum ada customer. Tambahkan dulu di Master Customer."
                    : `Belum ada transaksi untuk ${customerNama} di ${BULAN_LABEL[bulan - 1]} ${tahun}.`}
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <>
                <tr key={`${r.id}-sch`} style={{ borderTop: "1px solid var(--border)" }}>
                  <td rowSpan={2} className="px-2 py-1 sticky left-0 z-10 align-top" style={{ background: "var(--surface)", borderRight: "1px solid var(--border)" }} title={r.namaBarang}>
                    <div className="truncate max-w-[170px] font-medium" style={{ color: "var(--text-primary)" }}>{r.namaBarang}</div>
                  </td>
                  <td className="text-center" style={{ color: "var(--text-muted)", borderRight: "1px solid var(--border)" }}>Sch</td>
                  {days.map((d) => (
                    <td key={d} className="p-0" style={{ borderRight: "1px solid var(--border)" }}>
                      <DayCell value={dayValue(r, d, "qtyRencana")} variant="rencana" onSave={(v) => saveDay(r.id, d, "qtyRencana", v)} />
                    </td>
                  ))}
                </tr>
                <tr key={`${r.id}-act`} style={{ borderBottom: "1px solid var(--border-strong)" }}>
                  <td className="text-center" style={{ color: "var(--accent)", borderRight: "1px solid var(--border)" }}>Act</td>
                  {days.map((d) => (
                    <td key={d} className="p-0" style={{ borderRight: "1px solid var(--border)" }}>
                      <DayCell value={dayValue(r, d, "qtyKirim")} variant="aktual" onSave={(v) => saveDay(r.id, d, "qtyKirim", v)} />
                    </td>
                  ))}
                </tr>
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
