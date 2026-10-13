import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { rawMaterials } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isJenisMaterial, satuanTagihan } from "@/lib/material-jenis";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  const { id } = await params;
  const body = await req.json();
  const updates: Record<string, unknown> = {};
  if (body.nama !== undefined) updates.nama = body.nama;
  if (body.satuan !== undefined) updates.satuan = body.satuan;
  if (body.grade !== undefined) updates.grade = typeof body.grade === "string" && body.grade.trim() ? body.grade.trim() : null;
  if (body.ukuran !== undefined) updates.ukuran = typeof body.ukuran === "string" && body.ukuran.trim() ? body.ukuran.trim() : null;
  if (body.jenis !== undefined) {
    if (!isJenisMaterial(body.jenis)) return NextResponse.json({ error: "Jenis material tidak dikenal" }, { status: 400 });
    updates.jenis = body.jenis;
    // Ganti jenis otomatis menyesuaikan satuan tagihan (Kg / pcs), kecuali satuan diisi manual di request yang sama
    if (body.satuan === undefined) updates.satuan = satuanTagihan(body.jenis);
  }

  const [row] = await db.update(rawMaterials).set(updates).where(eq(rawMaterials.id, id)).returning();
  if (!row) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
  return NextResponse.json(row);

  } catch (error) {
    console.error("Error di /api/raw-materials/[id] [PATCH]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  const { id } = await params;
  await db.delete(rawMaterials).where(eq(rawMaterials.id, id));
  return NextResponse.json({ ok: true });

  } catch (error) {
    console.error("Error di /api/raw-materials/[id] [DELETE]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}
