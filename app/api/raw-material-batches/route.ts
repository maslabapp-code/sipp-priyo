import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { rawMaterialBatches, rawMaterials } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export async function GET() {
  try {
  const rows = await db
    .select({
      id: rawMaterialBatches.id,
      rawMaterialId: rawMaterialBatches.rawMaterialId,
      namaBahanBaku: rawMaterials.nama,
      satuan: rawMaterials.satuan,
      tanggal: rawMaterialBatches.tanggal,
      qty: rawMaterialBatches.qty,
    })
    .from(rawMaterialBatches)
    .innerJoin(rawMaterials, eq(rawMaterialBatches.rawMaterialId, rawMaterials.id))
    .orderBy(desc(rawMaterialBatches.tanggal));
  return NextResponse.json(rows);

  } catch (error) {
    console.error("Error di /api/raw-material-batches [GET]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}

// Stok awal / koreksi. Kedatangan material yang sebenarnya hanya lewat Surat Jalan Masuk,
// jadi di sini keterangan WAJIB diisi supaya setiap stok yang masuk tanpa SJ bisa dilacak alasannya.
export async function POST(req: NextRequest) {
  try {
  const body = await req.json();
  const { tanggal, rawMaterialId, qty, qty2, satuan2, catatan } = body;
  if (!tanggal || !rawMaterialId) {
    return NextResponse.json({ error: "tanggal & rawMaterialId wajib diisi" }, { status: 400 });
  }
  if (typeof catatan !== "string" || !catatan.trim()) {
    return NextResponse.json({ error: "Keterangan wajib diisi (mis. stok awal pemakaian aplikasi atau koreksi hasil hitung fisik)" }, { status: 400 });
  }
  const [mat] = await db.select().from(rawMaterials).where(eq(rawMaterials.id, rawMaterialId));
  if (!mat) return NextResponse.json({ error: "Bahan baku tidak ditemukan" }, { status: 404 });
  const perluQty2 = mat.jenis === "lembaran" || mat.jenis === "sheet_pita";
  if (perluQty2 && !(Number(qty2) > 0)) {
    return NextResponse.json({ error: "Jumlah pita/lembar wajib diisi untuk bahan baku ini. Stok dihitung dari jumlah ini." }, { status: 400 });
  }
  if (!perluQty2 && !(Number(qty) > 0)) {
    return NextResponse.json({ error: "Qty harus lebih dari 0" }, { status: 400 });
  }
  const punyaQty2 = Number(qty2) > 0;
  const [row] = await db
    .insert(rawMaterialBatches)
    .values({
      tanggal: new Date(tanggal),
      rawMaterialId,
      qty: String(Number(qty) || 0),
      qty2: punyaQty2 ? String(qty2) : null,
      satuan2: punyaQty2 ? satuan2 || (mat.jenis === "lembaran" ? "Lembar" : "Pita") : null,
      sumber: "stok_awal",
      catatan: catatan.trim(),
    })
    .returning();
  return NextResponse.json(row, { status: 201 });

  } catch (error) {
    console.error("Error di /api/raw-material-batches [POST]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}
