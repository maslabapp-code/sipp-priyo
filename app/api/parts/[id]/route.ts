import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { parts } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  const { id } = await params;
  const body = await req.json();
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.namaBarang !== undefined) updates.namaBarang = body.namaBarang;
  if (body.kodePart !== undefined) updates.kodePart = body.kodePart;
  if (body.kategori !== undefined) updates.kategori = body.kategori;
  if (body.customerId !== undefined) updates.customerId = body.customerId;
  if (body.hargaJualDefault !== undefined) updates.hargaJualDefault = body.hargaJualDefault || "0";
  // Hubungan ke bahan baku dan konversi tetap (master)
  if (body.rawMaterialId !== undefined) updates.rawMaterialId = body.rawMaterialId || null;
  if (body.satuanPotong !== undefined) updates.satuanPotong = body.satuanPotong || null;
  for (const f of ["konversiPcs", "lebarPotong", "beratPerUnit", "brutoPerKg", "nettoPerKg"] as const) {
    if (body[f] !== undefined) {
      const n = body[f] === "" || body[f] === null ? null : Number(body[f]);
      updates[f] = n == null || isNaN(n) ? null : String(n);
    }
  }

  const [row] = await db.update(parts).set(updates).where(eq(parts.id, id)).returning();
  if (!row) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
  return NextResponse.json(row);

  } catch (error) {
    console.error("Error di /api/parts/[id] [PATCH]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  const { id } = await params;
  await db.delete(parts).where(eq(parts.id, id));
  return NextResponse.json({ ok: true });

  } catch (error) {
    console.error("Error di /api/parts/[id] [DELETE]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}
