import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { productionCuts, rawMaterialUsages, rawMaterialBatches } from "@/db/schema";
import { eq, or } from "drizzle-orm";
import { listBatchSisa, bagiKeKedatangan } from "@/lib/auto-batch";

// Semua pemakaian bahan baku milik satu potong (bisa lebih dari satu kalau dibagi ke beberapa kedatangan)
async function usagesOfCut(cutId: string, legacyUsageId: string | null) {
  return db
    .select()
    .from(rawMaterialUsages)
    .where(legacyUsageId ? or(eq(rawMaterialUsages.productionCutId, cutId), eq(rawMaterialUsages.id, legacyUsageId)) : eq(rawMaterialUsages.productionCutId, cutId));
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  const { id } = await params;
  const body = await req.json();

  const [existing] = await db.select().from(productionCuts).where(eq(productionCuts.id, id)).limit(1);
  if (!existing) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });

  const updates: Record<string, unknown> = {};
  if (body.tanggal !== undefined) updates.tanggal = new Date(body.tanggal);
  if (body.qty !== undefined) updates.qty = String(body.qty);
  if (body.konversi !== undefined) updates.konversi = String(body.konversi);
  if (body.konversi2 !== undefined) updates.konversi2 = String(body.konversi2);
  if (body.satuan !== undefined) updates.satuan = body.satuan;

  // Sinkronkan pemakaian bahan baku supaya Stok Bahan Baku tetap akurat tanpa diedit manual di 2 tempat.
  if (body.qty !== undefined || body.tanggal !== undefined) {
    const usages = await usagesOfCut(id, existing.rawMaterialUsageId);
    if (body.tanggal !== undefined) {
      for (const u of usages) await db.update(rawMaterialUsages).set({ tanggal: new Date(body.tanggal) }).where(eq(rawMaterialUsages.id, u.id));
    }
    if (body.qty !== undefined && usages.length === 1) {
      // Satu kedatangan: qty diubah di tempat (kedatangan tidak berpindah)
      await db.update(rawMaterialUsages).set({ qty: String(body.qty) }).where(eq(rawMaterialUsages.id, usages[0].id));
    } else if (body.qty !== undefined && usages.length > 1) {
      // Potong ini dibagi ke beberapa kedatangan: hitung ulang pembagiannya (terlama dulu)
      const [batch] = await db.select().from(rawMaterialBatches).where(eq(rawMaterialBatches.id, usages[0].batchId));
      if (batch) {
        const tanggal = body.tanggal !== undefined ? new Date(body.tanggal) : usages[0].tanggal;
        for (const u of usages) await db.delete(rawMaterialUsages).where(eq(rawMaterialUsages.id, u.id));
        const daftar = await listBatchSisa(batch.rawMaterialId);
        const { alokasi } = bagiKeKedatangan(Number(body.qty), daftar);
        let first: string | null = null;
        for (const al of alokasi) {
          const [nu] = await db
            .insert(rawMaterialUsages)
            .values({ batchId: al.batchId, partId: existing.partId, tanggal, qty: String(al.qty), productionCutId: id })
            .returning();
          if (!first) first = nu.id;
        }
        updates.rawMaterialUsageId = first;
      }
    }
  }

  const [row] = await db.update(productionCuts).set(updates).where(eq(productionCuts.id, id)).returning();
  return NextResponse.json(row);

  } catch (error) {
    console.error("Error di /api/production-cuts/[id] [PATCH]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  const { id } = await params;

  const [existing] = await db.select().from(productionCuts).where(eq(productionCuts.id, id)).limit(1);
  const usages = existing ? await usagesOfCut(id, existing.rawMaterialUsageId) : [];
  await db.delete(productionCuts).where(eq(productionCuts.id, id));

  // Ikut hapus semua pemakaian bahan baku terkait, supaya stoknya "dikembalikan"
  for (const u of usages) {
    await db.delete(rawMaterialUsages).where(eq(rawMaterialUsages.id, u.id));
  }

  return NextResponse.json({ ok: true });

  } catch (error) {
    console.error("Error di /api/production-cuts/[id] [DELETE]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}
