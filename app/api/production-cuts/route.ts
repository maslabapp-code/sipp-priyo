import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { productionCuts, rawMaterialUsages, rawMaterialBatches, rawMaterials, parts } from "@/db/schema";
import { listBatchSisa, bagiKeKedatangan, type Alokasi } from "@/lib/auto-batch";
import { asc, eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
  const { searchParams } = new URL(req.url);
  const partId = searchParams.get("partId");
  if (!partId) return NextResponse.json({ error: "partId wajib diisi" }, { status: 400 });

  const rows = await db
    .select({
      id: productionCuts.id,
      partId: productionCuts.partId,
      tanggal: productionCuts.tanggal,
      satuan: productionCuts.satuan,
      qty: productionCuts.qty,
      konversi: productionCuts.konversi,
      konversi2: productionCuts.konversi2,
      rawMaterialUsageId: productionCuts.rawMaterialUsageId,
      bahanBakuNama: rawMaterials.nama,
    })
    .from(productionCuts)
    .leftJoin(rawMaterialUsages, eq(productionCuts.rawMaterialUsageId, rawMaterialUsages.id))
    .leftJoin(rawMaterialBatches, eq(rawMaterialUsages.batchId, rawMaterialBatches.id))
    .leftJoin(rawMaterials, eq(rawMaterialBatches.rawMaterialId, rawMaterials.id))
    .where(eq(productionCuts.partId, partId))
    .orderBy(asc(productionCuts.tanggal));
  return NextResponse.json(rows);

  } catch (error) {
    console.error("Error di /api/production-cuts [GET]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
  const body = await req.json();
  const { partId, tanggal, qty, konversi2, rawMaterialBatchId } = body;
  let { konversi, satuan } = body;
  if (!partId || !tanggal) {
    return NextResponse.json({ error: "partId & tanggal wajib diisi" }, { status: 400 });
  }

  // Master Part menentukan bahan baku dan konversi. Kalau part sudah punya konversi tetap,
  // angka dari layar diabaikan supaya tidak bisa salah ketik. Konversi 2 (MESH) tetap manual.
  const [part] = await db.select().from(parts).where(eq(parts.id, partId));
  if (!part) return NextResponse.json({ error: "Part tidak ditemukan" }, { status: 404 });
  if (part.konversiPcs && Number(part.konversiPcs) > 0) {
    konversi = Number(part.konversiPcs);
    if (part.satuanPotong) satuan = part.satuanPotong;
  }

  const qtyNum = Number(qty ?? 0);

  // Catatan potong disimpan dulu; pemakaian bahan baku menyusul dan menunjuk ke potong ini
  const [row] = await db
    .insert(productionCuts)
    .values({
      partId,
      tanggal: new Date(tanggal),
      qty: String(qtyNum),
      konversi: String(konversi ?? 1),
      konversi2: String(konversi2 ?? 1),
      satuan: satuan ?? null,
      rawMaterialUsageId: null,
    })
    .returning();

  // Tentukan dari kedatangan mana stok diambil:
  //  - admin memilih sendiri -> semua dari kedatangan itu
  //  - otomatis dari Master Part -> terlama dulu; kalau tidak cukup, dibagi ke kedatangan berikutnya
  let alokasi: Alokasi[] = [];
  let kurang = 0;
  let peringatan: string | null = null;
  if (qtyNum > 0) {
    if (rawMaterialBatchId) {
      alokasi = [{ batchId: rawMaterialBatchId, noSj: null, qty: qtyNum, satuanStok: "" }];
    } else if (part.rawMaterialId) {
      const daftar = await listBatchSisa(part.rawMaterialId);
      if (daftar.length === 0) {
        peringatan = "Bahan baku part ini belum ada kedatangan (SJ Masuk), jadi potong ini tidak mengurangi stok.";
      } else {
        const hasil = bagiKeKedatangan(qtyNum, daftar);
        alokasi = hasil.alokasi;
        kurang = hasil.kurang;
      }
    }
  }

  let firstUsageId: string | null = null;
  for (const a of alokasi) {
    const [usage] = await db
      .insert(rawMaterialUsages)
      .values({ batchId: a.batchId, partId, tanggal: new Date(tanggal), qty: String(a.qty), productionCutId: row.id })
      .returning();
    if (!firstUsageId) firstUsageId = usage.id;
  }
  if (firstUsageId) {
    await db.update(productionCuts).set({ rawMaterialUsageId: firstUsageId }).where(eq(productionCuts.id, row.id));
  }

  if (kurang > 0) {
    const akhir = alokasi[alokasi.length - 1];
    peringatan = `Stok bahan baku tidak cukup, kurang ${kurang} ${akhir?.satuanStok ?? ""}. Kekurangan dibebankan ke kedatangan ${akhir?.noSj ?? "terakhir"} sehingga sisanya minus. Cek qty kedatangan atau gunakan Kompensasi di Stok Bahan Baku.`;
  }

  return NextResponse.json({ ...row, rawMaterialUsageId: firstUsageId, alokasi, peringatan }, { status: 201 });

  } catch (error) {
    console.error("Error di /api/production-cuts [POST]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}
