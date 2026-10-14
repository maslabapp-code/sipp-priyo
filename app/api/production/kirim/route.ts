import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { monthlyTransactions, dailyDeliveries } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { toNumber } from "@/lib/calc";
import { findOrCreateMonthlyTransaction, upsertQtyKirim } from "@/lib/production";

// Riwayat kirim (aktual) satu part, digabung dari semua bulan — sumbernya daily_deliveries.
export async function GET(req: NextRequest) {
  try {
  const { searchParams } = new URL(req.url);
  const partId = searchParams.get("partId");
  if (!partId) return NextResponse.json({ error: "partId wajib diisi" }, { status: 400 });

  const txs = await db.select().from(monthlyTransactions).where(eq(monthlyTransactions.partId, partId));
  if (!txs.length) return NextResponse.json([]);

  const txById = new Map(txs.map((t) => [t.id, t]));
  const daily = await db
    .select()
    .from(dailyDeliveries)
    .where(inArray(dailyDeliveries.monthlyTransactionId, txs.map((t) => t.id)));

  const rows = daily
    .filter((d) => toNumber(d.qtyKirim) !== 0)
    .map((d) => {
      const tx = txById.get(d.monthlyTransactionId)!;
      return {
        tanggal: new Date(tx.tahun, tx.bulan - 1, d.tanggal).toISOString(),
        qty: d.qtyKirim,
      };
    })
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal));

  return NextResponse.json(rows);

  } catch (error) {
    console.error("Error di /api/production/kirim [GET]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}

// Body: { partId, tanggal: "YYYY-MM-DD", qty }. Upsert — mengedit tanggal yang sama akan
// menimpa nilai sebelumnya (bukan menjumlah), persis seperti mengedit cell Kirim di Transaksi Bulanan.
export async function POST(req: NextRequest) {
  try {
  const body = await req.json();
  const { partId, tanggal, qty } = body;
  if (!partId || !tanggal) {
    return NextResponse.json({ error: "partId & tanggal wajib diisi" }, { status: 400 });
  }

  const date = new Date(tanggal);
  const bulan = date.getMonth() + 1;
  const tahun = date.getFullYear();
  const hari = date.getDate();

  const tx = await findOrCreateMonthlyTransaction(partId, bulan, tahun);
  await upsertQtyKirim(tx.id, hari, toNumber(qty));

  return NextResponse.json({ ok: true, monthlyTransactionId: tx.id, bulan, tahun, hari });

  } catch (error) {
    console.error("Error di /api/production/kirim [POST]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}
