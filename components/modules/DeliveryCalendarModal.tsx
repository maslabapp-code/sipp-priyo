"use client";

import { useState } from "react";

type Delivery = { tanggal: number; qtyKirim: string; qtyRencana: string };

export function DeliveryCalendarModal({
  namaBarang,
  bulan,
  tahun,
  deliveries,
  onClose,
  onSave,
}: {
  namaBarang: string;
  bulan: number;
  tahun: number;
  deliveries: Delivery[];
  onClose: () => void;
  onSave: (tanggal: number, field: "qtyKirim" | "qtyRencana", qty: number) => Promise<void>;
}) {
  const daysInMonth = new Date(tahun, bulan, 0).getDate();
  const map = new Map(deliveries.map((d) => [d.tanggal, d]));
  const [saving, setSaving] = useState<string | null>(null);

  async function handleChange(tanggal: number, field: "qtyKirim" | "qtyRencana", value: string) {
    setSaving(`${tanggal}-${field}`);
    await onSave(tanggal, field, Number(value) || 0);
    setSaving(null);
  }

  const totalRencana = deliveries.reduce((s, d) => s + Number(d.qtyRencana || 0), 0);
  const totalAktual = deliveries.reduce((s, d) => s + Number(d.qtyKirim || 0), 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(15, 20, 28, 0.45)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[92vw] max-w-[1400px] rounded-xl overflow-hidden"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
          <div>
            <div className="text-[13.5px] font-semibold">{namaBarang}</div>
            <div className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
              Jadwal &amp; kirim harian — {String(bulan).padStart(2, "0")}/{tahun}
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

        <div className="px-4 pt-3 flex items-center gap-3 text-[11px]" style={{ color: "var(--text-muted)" }}>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ background: "var(--text-muted)" }} /> Rencana (Sch)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ background: "var(--accent)" }} /> Aktual (Act)
          </span>
        </div>

        <div className="p-4 grid grid-cols-7 gap-1.5 max-h-[420px] overflow-auto">
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((tanggal) => {
            const d = map.get(tanggal);
            return (
              <div
                key={tanggal}
                className="rounded-md px-1.5 py-1.5 flex flex-col items-center gap-1"
                style={{ border: "1px solid var(--border)", background: "var(--surface-muted)" }}
              >
                <span className="text-[10.5px]" style={{ color: "var(--text-muted)" }}>
                  {tanggal}
                </span>
                <input
                  type="number"
                  defaultValue={d?.qtyRencana && Number(d.qtyRencana) ? Number(d.qtyRencana) : ""}
                  placeholder="Sch"
                  onBlur={(e) => handleChange(tanggal, "qtyRencana", e.target.value)}
                  className="w-full text-center text-[11.5px] font-mono-num bg-transparent outline-none rounded"
                  style={{ color: saving === `${tanggal}-qtyRencana` ? "var(--text-secondary)" : "var(--text-muted)" }}
                />
                <input
                  type="number"
                  defaultValue={d?.qtyKirim && Number(d.qtyKirim) ? Number(d.qtyKirim) : ""}
                  placeholder="Act"
                  onBlur={(e) => handleChange(tanggal, "qtyKirim", e.target.value)}
                  className="w-full text-center text-[12.5px] font-mono-num bg-transparent outline-none rounded font-medium"
                  style={{ color: saving === `${tanggal}-qtyKirim` ? "var(--success)" : "var(--accent)" }}
                />
              </div>
            );
          })}
        </div>

        <div
          className="px-5 py-3 text-[12px] flex items-center justify-between"
          style={{ borderTop: "1px solid var(--border)", color: "var(--text-muted)" }}
        >
          <span>Isi lalu klik di luar kotak untuk tersimpan otomatis.</span>
          <span className="font-mono-num">
            Rencana: {totalRencana} · Aktual: {totalAktual}
          </span>
        </div>
      </div>
    </div>
  );
}
