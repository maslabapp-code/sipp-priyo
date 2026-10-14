import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { rawMaterialBatches, rawMaterialUsages } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  const { id } = await params;
  const body = await req.json();
  const [cur] = await db.select().from(rawMaterialBatches).where(eq(rawMaterialBatches.id, id));
  if (!cur) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
  if (cur.suratJalanMasukId) {
    return NextResponse.json({ error: "Kedatangan ini berasal dari Surat Jalan Masuk. Koreksi lewat menu Surat Jalan Masuk." }, { status: 409 });
  }
  const updates: Record<string, unknown> = {};
  if (body.tanggal !== undefined) updates.tanggal = new Date(body.tanggal);
  if (body.rawMaterialId !== undefined) updates.rawMaterialId = body.rawMaterialId;
  if (body.qty !== undefined) updates.qty = String(body.qty);

  const [row] = await db.update(rawMaterialBatches).set(updates).where(eq(rawMaterialBatches.id, id)).returning();
  if (!row) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
  return NextResponse.json(row);

  } catch (error) {
    console.error("Error di /api/raw-material-batches/[id] [PATCH]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  const { id } = await params;
  const [cur] = await db.select().from(rawMaterialBatches).where(eq(rawMaterialBatches.id, id));
  if (!cur) return NextResponse.json({ ok: true });
  if (cur.suratJalanMasukId) {
    return NextResponse.json({ error: "Kedatangan ini berasal dari Surat Jalan Masuk. Hapus lewat menu Surat Jalan Masuk." }, { status: 409 });
  }
  const [used] = await db.select({ id: rawMaterialUsages.id }).from(rawMaterialUsages).where(eq(rawMaterialUsages.batchId, id)).limit(1);
  if (used) {
    return NextResponse.json({ error: "Stok ini sudah dipakai produksi, tidak bisa dihapus." }, { status: 409 });
  }
  await db.delete(rawMaterialBatches).where(eq(rawMaterialBatches.id, id));
  return NextResponse.json({ ok: true });

  } catch (error) {
    console.error("Error di /api/raw-material-batches/[id] [DELETE]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}
