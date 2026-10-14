import { db } from "@/db";
import { monthlyTransactions, parts, dailyDeliveries } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { toNumber } from "./calc";

// Cari baris Transaksi Bulanan untuk part di bulan/tahun tertentu; kalau belum ada, buatkan
// (harga jual diambil dari Harga Jual Default di Master Part).
export async function findOrCreateMonthlyTransaction(partId: string, bulan: number, tahun: number) {
  const [existing] = await db
    .select()
    .from(monthlyTransactions)
    .where(
      and(
        eq(monthlyTransactions.partId, partId),
        eq(monthlyTransactions.bulan, bulan),
        eq(monthlyTransactions.tahun, tahun)
      )
    )
    .limit(1);
  if (existing) return existing;

  const [part] = await db.select().from(parts).where(eq(parts.id, partId)).limit(1);
  const [created] = await db
    .insert(monthlyTransactions)
    .values({ partId, bulan, tahun, hargaJual: part?.hargaJualDefault ?? "0" })
    .returning();
  return created;
}

// Upsert qty kirim aktual untuk satu tanggal (dipakai bersama oleh Transaksi Bulanan, Jadwal
// Customer/mode Harian, dan Produksi — supaya "Kirim" selalu satu sumber data, bukan dobel-input).
export async function upsertQtyKirim(monthlyTransactionId: string, tanggal: number, qty: number) {
  const [existing] = await db
    .select()
    .from(dailyDeliveries)
    .where(
      and(eq(dailyDeliveries.monthlyTransactionId, monthlyTransactionId), eq(dailyDeliveries.tanggal, tanggal))
    )
    .limit(1);

  if (existing) {
    await db
      .update(dailyDeliveries)
      .set({ qtyKirim: String(qty) })
      .where(eq(dailyDeliveries.id, existing.id));
  } else {
    await db.insert(dailyDeliveries).values({
      monthlyTransactionId,
      tanggal,
      qtyKirim: String(qty),
      qtyRencana: "0",
    });
  }
}

// Total kirim (aktual) sepanjang waktu untuk satu part, dijumlah dari semua bulan.
export async function getTotalKirimForPart(partId: string): Promise<number> {
  const txs = await db.select().from(monthlyTransactions).where(eq(monthlyTransactions.partId, partId));
  if (!txs.length) return 0;
  const txIds = txs.map((t) => t.id);
  const allDaily = await db.select().from(dailyDeliveries);
  return allDaily
    .filter((d) => txIds.includes(d.monthlyTransactionId))
    .reduce((sum, d) => sum + toNumber(d.qtyKirim), 0);
}
