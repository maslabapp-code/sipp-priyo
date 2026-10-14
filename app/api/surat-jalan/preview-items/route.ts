import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { monthlyTransactions, parts, dailyDeliveries } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { toNumber } from "@/lib/calc";

// Ambil semua part yang ada Kirim (aktual) > 0 untuk customer & tanggal tertentu
export async function GET(req: NextRequest) {
  try {
  const { searchParams } = new URL(req.url);
  const customerId = searchParams.get("customerId");
  const tanggalStr = searchParams.get("tanggal"); // YYYY-MM-DD
  if (!customerId || !tanggalStr) {
    return NextResponse.json({ error: "customerId & tanggal wajib diisi" }, { status: 400 });
  }

  const date = new Date(tanggalStr);
  const bulan = date.getMonth() + 1;
  const tahun = date.getFullYear();
  const hari = date.getDate();

  const rows = await db
    .select({
      partId: parts.id,
      namaBarang: parts.namaBarang,
      monthlyTransactionId: monthlyTransactions.id,
    })
    .from(monthlyTransactions)
    .innerJoin(parts, eq(monthlyTransactions.partId, parts.id))
    .where(
      and(
        eq(parts.customerId, customerId),
        eq(monthlyTransactions.bulan, bulan),
        eq(monthlyTransactions.tahun, tahun)
      )
    );

  if (!rows.length) return NextResponse.json([]);

  const txIds = rows.map((r) => r.monthlyTransactionId);
  const daily = await db.select().from(dailyDeliveries).where(eq(dailyDeliveries.tanggal, hari));
  const qtyByTx = new Map(daily.filter((d) => txIds.includes(d.monthlyTransactionId)).map((d) => [d.monthlyTransactionId, toNumber(d.qtyKirim)]));

  const items = rows
    .map((r) => ({ partId: r.partId, namaBarang: r.namaBarang, qty: qtyByTx.get(r.monthlyTransactionId) ?? 0 }))
    .filter((r) => r.qty > 0);

  return NextResponse.json(items);

  } catch (error) {
    console.error("Error di /api/preview-items [GET]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}
