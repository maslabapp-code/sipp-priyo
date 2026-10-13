import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { suratJalanMasuk, rawMaterialBatches, rawMaterialUsages } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const batches = await db
      .select({ id: rawMaterialBatches.id })
      .from(rawMaterialBatches)
      .where(eq(rawMaterialBatches.suratJalanMasukId, id));
    const batchIds = batches.map((b) => b.id);

    // Jangan hapus kalau materialnya sudah dipakai produksi — kalau dihapus, catatan pemakaian ikut hilang
    if (batchIds.length > 0) {
      const used = await db
        .select({ id: rawMaterialUsages.id })
        .from(rawMaterialUsages)
        .where(inArray(rawMaterialUsages.batchId, batchIds))
        .limit(1);
      if (used.length > 0) {
        return NextResponse.json(
          { error: "Material dari SJ ini sudah dipakai produksi, tidak bisa dihapus." },
          { status: 409 }
        );
      }
      await db.delete(rawMaterialBatches).where(inArray(rawMaterialBatches.id, batchIds));
    }
    await db.delete(suratJalanMasuk).where(eq(suratJalanMasuk.id, id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error di /api/surat-jalan-masuk/[id] [DELETE]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}
