import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { parts, customers, productionCuts, monthlyTransactions, dailyDeliveries } from "@/db/schema";
import { desc, eq, inArray } from "drizzle-orm";
import { computeCutTotal, toNumber } from "@/lib/calc";

export async function GET(req: NextRequest) {
  try {
  const { searchParams } = new URL(req.url);
  const kategori = searchParams.get("kategori");

  const partRows = await db
    .select({
      id: parts.id,
      kodePart: parts.kodePart,
      namaBarang: parts.namaBarang,
      kategori: parts.kategori,
      customerNama: customers.nama,
      createdAt: parts.createdAt,
    })
    .from(parts)
    .leftJoin(customers, eq(parts.customerId, customers.id))
    .where(kategori ? eq(parts.kategori, kategori) : undefined)
    .orderBy(desc(parts.createdAt));

  const allCuts = await db.select().from(productionCuts);

  // Total Kirim sekarang satu sumber dengan Transaksi Bulanan: dari daily_deliveries,
  // bukan tabel terpisah lagi (supaya nggak ada input dobel).
  const allTx = await db.select().from(monthlyTransactions);
  const allDaily = allTx.length
    ? await db
        .select()
        .from(dailyDeliveries)
        .where(inArray(dailyDeliveries.monthlyTransactionId, allTx.map((t) => t.id)))
    : [];
  const txById = new Map(allTx.map((t) => [t.id, t]));

  const kirimByPart = new Map<string, number>();
  const kirimCountByPart = new Map<string, number>();
  for (const d of allDaily) {
    const tx = txById.get(d.monthlyTransactionId);
    if (!tx) continue;
    const qty = toNumber(d.qtyKirim);
    if (qty === 0) continue;
    kirimByPart.set(tx.partId, (kirimByPart.get(tx.partId) ?? 0) + qty);
    kirimCountByPart.set(tx.partId, (kirimCountByPart.get(tx.partId) ?? 0) + 1);
  }

  const result = partRows.map((p) => {
    const cuts = allCuts.filter((c) => c.partId === p.id);
    const totalPotong = cuts.reduce(
      (sum, c) => sum + computeCutTotal(toNumber(c.qty), toNumber(c.konversi), toNumber(c.konversi2)),
      0
    );
    const totalKirim = kirimByPart.get(p.id) ?? 0;

    return {
      ...p,
      totalPotong,
      totalKirim,
      sisaStok: totalPotong - totalKirim,
      jumlahCatatanPotong: cuts.length,
      jumlahCatatanKirim: kirimCountByPart.get(p.id) ?? 0,
    };
  });

  return NextResponse.json(result);

  } catch (error) {
    console.error("Error di /api/production/summary [GET]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}
