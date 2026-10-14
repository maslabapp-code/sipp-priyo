import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { returnIncoming } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  const { id } = await params;
  const body = await req.json();
  const updates: Record<string, unknown> = {};
  if (body.tanggal !== undefined) updates.tanggal = new Date(body.tanggal);
  if (body.noSj !== undefined) updates.noSj = body.noSj;
  if (body.qty !== undefined) updates.qty = String(body.qty);
  if (body.alasan !== undefined) updates.alasan = body.alasan;

  const [row] = await db.update(returnIncoming).set(updates).where(eq(returnIncoming.id, id)).returning();
  if (!row) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
  return NextResponse.json(row);

  } catch (error) {
    console.error("Error di /api/return-incoming/[id] [PATCH]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  const { id } = await params;
  await db.delete(returnIncoming).where(eq(returnIncoming.id, id));
  return NextResponse.json({ ok: true });

  } catch (error) {
    console.error("Error di /api/return-incoming/[id] [DELETE]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}
