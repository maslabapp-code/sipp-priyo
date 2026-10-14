import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { monthlyTransactions, dailyDeliveries } from "@/db/schema";
import { eq } from "drizzle-orm";
import { computeDerived, toNumber } from "@/lib/calc";

const EDITABLE_FIELDS = ["stock", "poAct", "poCpl1", "poCpl2", "poCpl3", "hargaJual", "noPo"] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  const { id } = await params;
  const body = await req.json();

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const field of EDITABLE_FIELDS) {
    if (body[field] !== undefined) {
      updates[field] = String(body[field]);
    }
  }

  const [row] = await db
    .update(monthlyTransactions)
    .set(updates)
    .where(eq(monthlyTransactions.id, id))
    .returning();

  if (!row) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });

  const daily = await db
    .select()
    .from(dailyDeliveries)
    .where(eq(dailyDeliveries.monthlyTransactionId, id));

  const kirim = daily.reduce((sum, d) => sum + toNumber(d.qtyKirim), 0);
  const derived = computeDerived({
    stock: toNumber(row.stock),
    poAct: toNumber(row.poAct),
    poCpl1: toNumber(row.poCpl1),
    poCpl2: toNumber(row.poCpl2),
    poCpl3: toNumber(row.poCpl3),
    hargaJual: toNumber(row.hargaJual),
    kirim,
  });

  return NextResponse.json({ ...row, kirim, ...derived });

  } catch (error) {
    console.error("Error di /api/monthly-transactions/[id] [PATCH]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  const { id } = await params;
  await db.delete(monthlyTransactions).where(eq(monthlyTransactions.id, id));
  return NextResponse.json({ ok: true });

  } catch (error) {
    console.error("Error di /api/monthly-transactions/[id] [DELETE]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}
