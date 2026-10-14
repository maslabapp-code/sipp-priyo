import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { monthlyTransactions, dailyDeliveries } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { computeDerived, toNumber } from "@/lib/calc";

// Body: { tanggal: number (1-31), qtyKirim?: number, qtyRencana?: number }
// Salah satu boleh diisi saja (mengedit yang lain tidak akan menghapus nilai satunya).
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  const { id } = await params;
  const body = await req.json();
  const tanggal = Number(body.tanggal);

  if (!tanggal || tanggal < 1 || tanggal > 31) {
    return NextResponse.json({ error: "Tanggal tidak valid" }, { status: 400 });
  }

  const existing = await db
    .select()
    .from(dailyDeliveries)
    .where(
      and(eq(dailyDeliveries.monthlyTransactionId, id), eq(dailyDeliveries.tanggal, tanggal))
    )
    .limit(1);

  const hasKirim = body.qtyKirim !== undefined;
  const hasRencana = body.qtyRencana !== undefined;

  if (existing.length) {
    const updates: Record<string, unknown> = {};
    if (hasKirim) updates.qtyKirim = String(toNumber(body.qtyKirim));
    if (hasRencana) updates.qtyRencana = String(toNumber(body.qtyRencana));
    if (Object.keys(updates).length) {
      await db.update(dailyDeliveries).set(updates).where(eq(dailyDeliveries.id, existing[0].id));
    }
  } else {
    await db.insert(dailyDeliveries).values({
      monthlyTransactionId: id,
      tanggal,
      qtyKirim: String(hasKirim ? toNumber(body.qtyKirim) : 0),
      qtyRencana: String(hasRencana ? toNumber(body.qtyRencana) : 0),
    });
  }

  // hitung ulang & kembalikan baris transaksi terbaru
  const [tx] = await db
    .select()
    .from(monthlyTransactions)
    .where(eq(monthlyTransactions.id, id))
    .limit(1);

  if (!tx) return NextResponse.json({ error: "Transaksi tidak ditemukan" }, { status: 404 });

  const daily = await db
    .select()
    .from(dailyDeliveries)
    .where(eq(dailyDeliveries.monthlyTransactionId, id));

  const kirim = daily.reduce((sum, d) => sum + toNumber(d.qtyKirim), 0);
  const derived = computeDerived({
    stock: toNumber(tx.stock),
    poAct: toNumber(tx.poAct),
    poCpl1: toNumber(tx.poCpl1),
    poCpl2: toNumber(tx.poCpl2),
    poCpl3: toNumber(tx.poCpl3),
    hargaJual: toNumber(tx.hargaJual),
    kirim,
  });

  return NextResponse.json({ ...tx, kirim, dailyDeliveries: daily, ...derived });

  } catch (error) {
    console.error("Error di /api/monthly-transactions/[id]/delivery [PUT]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}
