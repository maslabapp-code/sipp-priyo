import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { rawMaterialBatches, rawMaterialUsages } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { listBatchSisa } from "@/lib/auto-batch";
import { toNumber } from "@/lib/calc";

// Kompensasi otomatis: kalau sebuah kedatangan sisanya MINUS, pindahkan sebagian pemakaiannya
// (yang terbaru dulu) ke kedatangan lain dari bahan baku yang sama yang masih punya sisa.
// Kalau satu pemakaian hanya muat sebagian di tujuan, pemakaian itu dipecah dua.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [batch] = await db.select().from(rawMaterialBatches).where(eq(rawMaterialBatches.id, id));
    if (!batch) return NextResponse.json({ error: "Kedatangan tidak ditemukan" }, { status: 404 });

    const daftar = await listBatchSisa(batch.rawMaterialId);
    const diri = daftar.find((b) => b.id === id);
    if (!diri || diri.sisa >= 0) {
      return NextResponse.json({ error: "Sisa kedatangan ini tidak minus, tidak perlu kompensasi." }, { status: 400 });
    }

    let kurang = -diri.sisa;
    // Tujuan: kedatangan lain yang masih punya sisa, terlama dulu
    const tujuan = daftar.filter((b) => b.id !== id && b.sisa > 0).map((b) => ({ ...b }));
    if (tujuan.length === 0) {
      return NextResponse.json({ error: "Tidak ada kedatangan lain yang masih punya sisa. Cek qty kedatangan ini atau tambah SJ Masuk." }, { status: 409 });
    }

    const usages = await db
      .select()
      .from(rawMaterialUsages)
      .where(eq(rawMaterialUsages.batchId, id))
      .orderBy(desc(rawMaterialUsages.tanggal), desc(rawMaterialUsages.createdAt));

    let dipindah = 0;
    for (const u of usages) {
      if (kurang <= 0) break;
      let sisaU = toNumber(u.qty); // sisa qty pemakaian ini yang masih di kedatangan asal
      for (const t of tujuan) {
        if (kurang <= 0 || sisaU <= 0) break;
        if (t.sisa <= 0) continue;
        const pindah = Math.min(sisaU, kurang, t.sisa);
        if (pindah <= 0) continue;
        if (pindah >= sisaU) {
          // seluruh pemakaian pindah ke kedatangan tujuan
          await db.update(rawMaterialUsages).set({ batchId: t.id }).where(eq(rawMaterialUsages.id, u.id));
        } else {
          // pecah: sebagian tetap di sini, sebagian pindah
          await db.update(rawMaterialUsages).set({ qty: String(sisaU - pindah) }).where(eq(rawMaterialUsages.id, u.id));
          await db.insert(rawMaterialUsages).values({
            batchId: t.id,
            partId: u.partId,
            tanggal: u.tanggal,
            qty: String(pindah),
            productionCutId: u.productionCutId,
          });
        }
        t.sisa -= pindah;
        kurang -= pindah;
        sisaU -= pindah;
        dipindah += pindah;
      }
    }

    return NextResponse.json({ dipindah, masihKurang: Math.max(kurang, 0), satuan: diri.satuanStok });
  } catch (error) {
    console.error("Error di /api/raw-material-batches/[id]/kompensasi [POST]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}
