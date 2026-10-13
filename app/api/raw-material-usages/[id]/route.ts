import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { rawMaterialUsages, rawMaterialBatches, productionCuts } from "@/db/schema";
import { eq } from "drizzle-orm";

// Qty pemakaian tidak diubah di sini (ubah lewat catatan potong di Produksi).
// Yang boleh: MEMINDAHKAN pemakaian ke kedatangan lain dari bahan baku yang sama.
// Berguna kalau kedatangan lama sudah minus dan ada kedatangan lain yang masih punya sisa.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    if (!body.batchId || Object.keys(body).some((k) => k !== "batchId")) {
      return NextResponse.json({ error: "Qty diubah lewat catatan potong di menu Produksi. Di sini hanya bisa memindahkan kedatangan." }, { status: 405 });
    }

    const [usage] = await db.select().from(rawMaterialUsages).where(eq(rawMaterialUsages.id, id));
    if (!usage) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
    const [asal] = await db.select().from(rawMaterialBatches).where(eq(rawMaterialBatches.id, usage.batchId));
    const [tujuan] = await db.select().from(rawMaterialBatches).where(eq(rawMaterialBatches.id, body.batchId));
    if (!asal || !tujuan) return NextResponse.json({ error: "Kedatangan tidak ditemukan" }, { status: 404 });
    if (asal.rawMaterialId !== tujuan.rawMaterialId) {
      return NextResponse.json({ error: "Hanya bisa dipindah ke kedatangan dari bahan baku yang sama." }, { status: 400 });
    }

    const [row] = await db.update(rawMaterialUsages).set({ batchId: body.batchId }).where(eq(rawMaterialUsages.id, id)).returning();
    return NextResponse.json(row);
  } catch (error) {
    console.error("Error di /api/raw-material-usages/[id] [PATCH]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Pemakaian yang berasal dari potong tidak dihapus di sini (hapus catatan potongnya di Produksi).
    // Hanya sisa catatan manual lama yang boleh dibersihkan.
    const [usage] = await db.select().from(rawMaterialUsages).where(eq(rawMaterialUsages.id, id));
    if (!usage) return NextResponse.json({ ok: true });
    const [cut] = await db.select({ id: productionCuts.id }).from(productionCuts).where(eq(productionCuts.rawMaterialUsageId, id)).limit(1);
    if (cut || usage.productionCutId) {
      return NextResponse.json({ error: "Pemakaian ini berasal dari catatan potong. Hapus lewat menu Produksi." }, { status: 409 });
    }
    await db.delete(rawMaterialUsages).where(eq(rawMaterialUsages.id, id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error di /api/raw-material-usages/[id] [DELETE]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}
