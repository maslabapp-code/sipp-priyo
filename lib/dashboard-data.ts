import { db } from "@/db";
import {
  parts,
  customers,
  monthlyTransactions,
  dailyDeliveries,
  productionCuts,
  returnIncoming,
  returnResolutions,
} from "@/db/schema";
import { inArray } from "drizzle-orm";
import { computeCutTotal, computeDerived, toNumber } from "./calc";

const BULAN_SINGKAT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const BULAN_PENUH = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

type Derived = {
  partId: string;
  bulan: number;
  tahun: number;
  noPo: string | null;
  kirim: number;
  totalPo: number;
  sisaPo: number;
  actualPenjualan: number;
  totalPenjualan: number;
  namaBarang: string;
  customerNama: string | null;
};

// Satu sumber data untuk semua tampilan Dashboard (layar dan export).
async function loadDerived() {
  const allParts = await db.select().from(parts);
  const allCustomers = await db.select().from(customers);
  const allTx = await db.select().from(monthlyTransactions);
  const allDaily = allTx.length
    ? await db.select().from(dailyDeliveries).where(inArray(dailyDeliveries.monthlyTransactionId, allTx.map((t) => t.id)))
    : [];
  const kirimByTx = new Map<string, number>();
  for (const d of allDaily) {
    kirimByTx.set(d.monthlyTransactionId, (kirimByTx.get(d.monthlyTransactionId) ?? 0) + toNumber(d.qtyKirim));
  }
  const partById = new Map(allParts.map((p) => [p.id, p]));
  const custById = new Map(allCustomers.map((c) => [c.id, c]));

  const derivedTx: Derived[] = allTx.map((tx) => {
    const kirim = kirimByTx.get(tx.id) ?? 0;
    const d = computeDerived({
      stock: toNumber(tx.stock),
      poAct: toNumber(tx.poAct),
      poCpl1: toNumber(tx.poCpl1),
      poCpl2: toNumber(tx.poCpl2),
      poCpl3: toNumber(tx.poCpl3),
      hargaJual: toNumber(tx.hargaJual),
      kirim,
    });
    const part = partById.get(tx.partId);
    return {
      partId: tx.partId,
      bulan: tx.bulan,
      tahun: tx.tahun,
      noPo: tx.noPo,
      kirim,
      totalPo: d.totalPo,
      sisaPo: d.sisaPo,
      actualPenjualan: d.actualPenjualan,
      totalPenjualan: d.totalPenjualan,
      namaBarang: part?.namaBarang ?? "-",
      customerNama: part?.customerId ? custById.get(part.customerId)?.nama ?? null : null,
    };
  });
  return { allParts, allCustomers, derivedTx };
}

// Persentase delivery = jumlah terkirim dibanding total PO.
// Kirim yang melebihi PO suatu part tidak dihitung lebih, supaya tidak menutupi part lain yang masih kurang.
function deliveryOf(rows: Derived[]) {
  const totalPo = rows.reduce((s, r) => s + r.totalPo, 0);
  const kirim = rows.reduce((s, r) => s + r.kirim, 0);
  const terhitung = rows.reduce((s, r) => s + Math.min(r.kirim, Math.max(r.totalPo, 0)), 0);
  const persen = totalPo > 0 ? (terhitung / totalPo) * 100 : null;
  return { totalPo, kirim, persen };
}

function recentMonths(n: number, bulanIni: number, tahunIni: number) {
  const out: { b: number; t: number; label: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(tahunIni, bulanIni - 1 - i, 1);
    const b = d.getMonth() + 1;
    const t = d.getFullYear();
    out.push({ b, t, label: `${BULAN_SINGKAT[b - 1]} ${String(t).slice(2)}` });
  }
  return out;
}

// ── Tampilan umum (aman untuk Staff): tanpa harga jual dan omzet ──
export async function getDashboardData() {
  const now = new Date();
  const bulanIni = now.getMonth() + 1;
  const tahunIni = now.getFullYear();
  const { allParts, allCustomers, derivedTx } = await loadDerived();

  const txBulanIni = derivedTx.filter((t) => t.bulan === bulanIni && t.tahun === tahunIni);
  const deliveryIni = deliveryOf(txBulanIni);
  const sisaPoBulanIni = txBulanIni.reduce((s, t) => s + t.sisaPo, 0);

  const outstanding = derivedTx.filter((t) => t.sisaPo > 0);
  const topOutstanding = [...outstanding]
    .sort((a, b) => b.sisaPo - a.sisaPo)
    .slice(0, 5)
    .map((t) => ({ noPo: t.noPo, namaBarang: t.namaBarang, customerNama: t.customerNama, sisaPo: t.sisaPo }));

  const allCuts = await db.select().from(productionCuts);
  const potongByPart = new Map<string, number>();
  for (const c of allCuts) {
    potongByPart.set(c.partId, (potongByPart.get(c.partId) ?? 0) + computeCutTotal(toNumber(c.qty), toNumber(c.konversi), toNumber(c.konversi2)));
  }
  const kirimByPart = new Map<string, number>();
  for (const t of derivedTx) kirimByPart.set(t.partId, (kirimByPart.get(t.partId) ?? 0) + t.kirim);
  let sisaStokProduksi = 0;
  for (const [partId, totalPotong] of potongByPart) sisaStokProduksi += totalPotong - (kirimByPart.get(partId) ?? 0);

  const incoming = await db.select().from(returnIncoming);
  const resolutions = await db.select().from(returnResolutions);
  const returSisa = incoming.reduce((s, i) => s + toNumber(i.qty), 0) - resolutions.reduce((s, r) => s + toNumber(r.qty), 0);

  // Grafik bulanan: total PO, terkirim, dan persentase delivery 6 bulan terakhir
  const trend = recentMonths(6, bulanIni, tahunIni).map(({ b, t, label }) => {
    const d = deliveryOf(derivedTx.filter((x) => x.bulan === b && x.tahun === t));
    return { label, totalPo: d.totalPo, kirim: d.kirim, persen: d.persen };
  });

  // Delivery per customer bulan ini (5 customer dengan PO terbesar)
  const byCust = new Map<string, Derived[]>();
  for (const t of txBulanIni) {
    if (!t.customerNama) continue;
    byCust.set(t.customerNama, [...(byCust.get(t.customerNama) ?? []), t]);
  }
  const perCustomer = Array.from(byCust.entries())
    .map(([nama, rows]) => ({ nama, ...deliveryOf(rows) }))
    .sort((a, b) => b.totalPo - a.totalPo)
    .slice(0, 5);

  return {
    bulanLabel: `${BULAN_PENUH[bulanIni - 1]} ${tahunIni}`,
    totalPart: allParts.length,
    totalCustomer: allCustomers.length,
    sisaPoBulanIni,
    kirimBulanIni: deliveryIni.kirim,
    totalPoBulanIni: deliveryIni.totalPo,
    persenBulanIni: deliveryIni.persen,
    sisaStokProduksi,
    outstandingCount: outstanding.length,
    outstandingTotal: outstanding.reduce((s, t) => s + t.sisaPo, 0),
    returSisa,
    trend,
    perCustomer,
    topOutstanding,
  };
}

// ── Khusus Admin: harga jual dan omzet. Dipisah supaya mudah dibatasi saat login dipasang. ──
export async function getOmzetData() {
  const now = new Date();
  const bulanIni = now.getMonth() + 1;
  const tahunIni = now.getFullYear();
  const { derivedTx } = await loadDerived();

  const totalPenjualanBulanIni = derivedTx
    .filter((t) => t.bulan === bulanIni && t.tahun === tahunIni)
    .reduce((s, t) => s + t.totalPenjualan, 0);

  const trend = recentMonths(6, bulanIni, tahunIni).map(({ b, t, label }) => {
    const rows = derivedTx.filter((x) => x.bulan === b && x.tahun === t);
    return {
      label,
      totalPenjualan: rows.reduce((s, x) => s + x.totalPenjualan, 0),
      actualPenjualan: rows.reduce((s, x) => s + x.actualPenjualan, 0),
    };
  });

  const byCust = new Map<string, number>();
  for (const t of derivedTx) {
    if (!t.customerNama) continue;
    byCust.set(t.customerNama, (byCust.get(t.customerNama) ?? 0) + t.actualPenjualan);
  }
  const topCustomer = Array.from(byCust.entries())
    .map(([nama, total]) => ({ nama, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  return { totalPenjualanBulanIni, trend, topCustomer };
}
