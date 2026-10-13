"use client";

import { useEffect, useState } from "react";
import { useAutoRefresh } from "@/components/layout/DataSync";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  ComposedChart,
  Legend,
} from "recharts";
import { ExportButton } from "../ui/ExportButton";

type Summary = {
  totalPart: number;
  totalCustomer: number;
  sisaPoBulanIni: number;
  kirimBulanIni: number;
  totalPoBulanIni: number;
  persenBulanIni: number | null;
  sisaStokProduksi: number;
  outstandingCount: number;
  outstandingTotal: number;
  returSisa: number;
  trend: { label: string; totalPo: number; kirim: number; persen: number | null }[];
  perCustomer: { nama: string; totalPo: number; kirim: number; persen: number | null }[];
  topOutstanding: { noPo: string | null; namaBarang: string; customerNama: string | null; sisaPo: number }[];
};

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n);
}
function fmtPersen(n: number | null) {
  return n == null ? "—" : new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(n) + "%";
}
function fmtCompact(n: number) {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + "jt";
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(0) + "rb";
  return String(n);
}

function KpiCard({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div className="rounded-lg p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="text-[11.5px] mb-1.5" style={{ color: "var(--text-muted)" }}>
        {label}
      </div>
      <div className="text-[20px] font-semibold font-mono-num" style={{ color: color ?? "var(--text-primary)" }}>
        {value}
      </div>
      {sub && (
        <div className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

export function Dashboard() {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const r = await fetch("/api/dashboard/summary");
    setData(await r.json());
    setLoading(false);
  }

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  useAutoRefresh(load);

  const now = new Date();
  const bulanLabel = now.toLocaleDateString("id-ID", { month: "long", year: "numeric" });

  return (
    <div className="p-5">
      <div className="mb-4 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[15px] font-semibold">Dashboard</h1>
          <p className="text-[12.5px]" style={{ color: "var(--text-secondary)" }}>
            Ringkasan kondisi bisnis — {bulanLabel}
          </p>
        </div>
        <ExportButton baseUrl="/api/export/dashboard" />
      </div>

      {loading || !data ? (
        <div className="text-[13px] py-10 text-center" style={{ color: "var(--text-muted)" }}>
          Memuat...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <KpiCard label="Total Part Aktif" value={fmt(data.totalPart)} sub={`${data.totalCustomer} customer`} />
            <KpiCard
              label="Sisa PO Bulan Ini"
              value={fmt(data.sisaPoBulanIni)}
              color={data.sisaPoBulanIni > 0 ? "var(--warn)" : "var(--success)"}
            />
            <KpiCard label="Kirim Bulan Ini" value={fmt(data.kirimBulanIni)} color="var(--accent)" />
            <KpiCard
              label="Delivery Bulan Ini"
              value={fmtPersen(data.persenBulanIni)}
              color="var(--accent)"
              sub={`${fmt(data.kirimBulanIni)} terkirim dari ${fmt(data.totalPoBulanIni)} pcs PO`}
            />
            <KpiCard
              label="Sisa Stok Produksi"
              value={fmt(data.sisaStokProduksi)}
              sub="hasil potong - kirim, semua part"
            />
            <KpiCard
              label="Outstanding PO"
              value={`${data.outstandingCount} PO`}
              color={data.outstandingCount > 0 ? "var(--warn)" : "var(--success)"}
              sub={`Total sisa ${fmt(data.outstandingTotal)} pcs`}
            />
            <KpiCard
              label="Retur Belum Selesai"
              value={fmt(data.returSisa)}
              color={data.returSisa > 0 ? "var(--danger)" : "var(--success)"}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
            <div
              className="lg:col-span-2 rounded-lg p-4"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div className="text-[12.5px] font-semibold">Delivery per Bulan (6 Bulan Terakhir)</div>
              <div className="text-[11px] mb-3" style={{ color: "var(--text-muted)" }}>
                Batang: total PO dan terkirim (pcs). Garis: persentase delivery. Kirim yang melebihi PO suatu part tidak dihitung lebih.
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={data.trend} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                  <YAxis yAxisId="pcs" tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickFormatter={fmtCompact} />
                  <YAxis yAxisId="persen" orientation="right" domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickFormatter={(v) => v + "%"} />
                  <Tooltip
                    formatter={(v, name) => (name === "Delivery (%)" ? fmtPersen(Number(v)) : fmt(Number(v)) + " pcs")}
                    contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar yAxisId="pcs" dataKey="totalPo" name="Total PO" fill="var(--border)" radius={[3, 3, 0, 0]} />
                  <Bar yAxisId="pcs" dataKey="kirim" name="Terkirim" fill="var(--accent)" radius={[3, 3, 0, 0]} />
                  <Line yAxisId="persen" type="monotone" dataKey="persen" name="Delivery (%)" stroke="var(--success)" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-lg p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="text-[12.5px] font-semibold">Delivery per Customer</div>
              <div className="text-[11px] mb-3" style={{ color: "var(--text-muted)" }}>Bulan ini, 5 customer dengan PO terbesar</div>
              {data.perCustomer.length === 0 ? (
                <div className="text-[12px] py-8 text-center" style={{ color: "var(--text-muted)" }}>
                  Belum ada PO bulan ini.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.perCustomer.map((c) => ({ ...c, persen: c.persen ?? 0 }))} layout="vertical" margin={{ left: 10, right: 10 }}>
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickFormatter={(v) => v + "%"} />
                    <YAxis dataKey="nama" type="category" width={70} tick={{ fontSize: 11, fill: "var(--text-secondary)" }} />
                    <Tooltip
                      formatter={(v) => fmtPersen(Number(v))}
                      contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", fontSize: 12 }}
                    />
                    <Bar dataKey="persen" name="Delivery" fill="var(--accent)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="rounded-lg overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="px-4 py-2.5 text-[12.5px] font-semibold" style={{ borderBottom: "1px solid var(--border)" }}>
              5 PO Outstanding Terbesar
            </div>
            {data.topOutstanding.length === 0 ? (
              <div className="text-[12px] py-6 text-center" style={{ color: "var(--text-muted)" }}>
                Tidak ada PO outstanding. Semua PO sudah lunas terkirim. 🎉
              </div>
            ) : (
              <table className="w-full text-[12.5px]">
                <tbody>
                  {data.topOutstanding.map((r, i) => (
                    <tr key={i} style={{ borderTop: i > 0 ? "1px solid var(--border)" : undefined }}>
                      <td className="px-4 py-2 font-mono-num" style={{ color: "var(--text-muted)" }}>{r.noPo || "—"}</td>
                      <td className="px-2 py-2">{r.namaBarang}</td>
                      <td className="px-2 py-2" style={{ color: "var(--text-secondary)" }}>{r.customerNama ?? "—"}</td>
                      <td className="px-4 py-2 text-right font-mono-num font-semibold" style={{ color: "var(--warn)" }}>
                        {fmt(r.sisaPo)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
