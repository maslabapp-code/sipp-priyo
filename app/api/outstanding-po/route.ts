import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { monthlyTransactions, parts, customers, dailyDeliveries } from "@/db/schema";
import { desc, eq, inArray } from "drizzle-orm";
import { computeDerived, toNumber } from "@/lib/calc";

// Laporan Outstanding PO: PO CPL 1-3 yang belum lunas terkirim (Sisa PO > 0).
// Sesuai konfirmasi user: 1 No. PO = 1 bulan = 1 part, kalau tidak lunas di akhir bulan
// dianggap hangus (bukan carry-over), jadi laporan ini per bulan apa adanya.
export async function GET(req: NextRequest) {
  try {
  const { searchParams } = new URL(req.url);
  const bulan = searchParams.get("bulan") ? Number(searchParams.get("bulan")) : null;
  const tahun = searchParams.get("tahun") ? Number(searchParams.get("tahun")) : null;

  const rows = await db
    .select({
      id: monthlyTransactions.id,
      noPo: monthlyTransactions.noPo,
      namaBarang: parts.namaBarang,
      customerNama: customers.nama,
      bulan: monthlyTransactions.bulan,
      tahun: monthlyTransactions.tahun,
      poCpl1: monthlyTransactions.poCpl1,
      poCpl2: monthlyTransactions.poCpl2,
      poCpl3: monthlyTransactions.poCpl3,
      hargaJual: monthlyTransactions.hargaJual,
      stock: monthlyTransactions.stock,
      poAct: monthlyTransactions.poAct,
    })
    .from(monthlyTransactions)
    .innerJoin(parts, eq(monthlyTransactions.partId, parts.id))
    .leftJoin(customers, eq(parts.customerId, customers.id))
    .orderBy(desc(monthlyTransactions.tahun), desc(monthlyTransactions.bulan));

  const txIds = rows.map((r) => r.id);
  const allDaily = txIds.length
    ? await db.select().from(dailyDeliveries).where(inArray(dailyDeliveries.monthlyTransactionId, txIds))
    : [];
  const kirimByTx = new Map<string, number>();
  for (const d of allDaily) {
    kirimByTx.set(d.monthlyTransactionId, (kirimByTx.get(d.monthlyTransactionId) ?? 0) + toNumber(d.qtyKirim));
  }

  const result = rows
    .filter((r) => (bulan ? r.bulan === bulan : true) && (tahun ? r.tahun === tahun : true))
    .map((r) => {
      const kirim = kirimByTx.get(r.id) ?? 0;
      const derived = computeDerived({
        stock: toNumber(r.stock),
        poAct: toNumber(r.poAct),
        poCpl1: toNumber(r.poCpl1),
        poCpl2: toNumber(r.poCpl2),
        poCpl3: toNumber(r.poCpl3),
        hargaJual: toNumber(r.hargaJual),
        kirim,
      });
      return { ...r, kirim, ...derived };
    })
    .filter((r) => r.sisaPo > 0)
    .sort((a, b) => b.sisaPo - a.sisaPo);

  return NextResponse.json(result);

  } catch (error) {
    console.error("Error di /api/outstanding-po [GET]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}
