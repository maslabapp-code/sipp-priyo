import { NextResponse } from "next/server";
import { db } from "@/db";
import { rawMaterialBatches, rawMaterialUsages, rawMaterials, customers } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { toNumber } from "@/lib/calc";
import { stockOf, sisaKgOf } from "@/lib/stock";

export async function GET() {
  try {
  const batches = await db
    .select({
      id: rawMaterialBatches.id,
      rawMaterialId: rawMaterialBatches.rawMaterialId,
      namaBahanBaku: rawMaterials.nama,
      satuan: rawMaterials.satuan,
      tanggal: rawMaterialBatches.tanggal,
      qty: rawMaterialBatches.qty,
      qty2: rawMaterialBatches.qty2,
      satuan2: rawMaterialBatches.satuan2,
      noSj: rawMaterialBatches.noSj,
      suratJalanMasukId: rawMaterialBatches.suratJalanMasukId,
      sumberTersimpan: rawMaterialBatches.sumber,
      catatan: rawMaterialBatches.catatan,
      customerNama: customers.nama,
    })
    .from(rawMaterialBatches)
    .innerJoin(rawMaterials, eq(rawMaterialBatches.rawMaterialId, rawMaterials.id))
    .leftJoin(customers, eq(rawMaterialBatches.customerId, customers.id))
    .orderBy(desc(rawMaterialBatches.tanggal));

  const allUsages = await db.select().from(rawMaterialUsages);

  const result = batches.map((b) => {
    const usages = allUsages.filter((u) => u.batchId === b.id);
    const totalTerpakai = usages.reduce((sum, u) => sum + toNumber(u.qty), 0);
    const st = stockOf(b);
    const sisa = st.qtyStok - totalTerpakai;
    return {
      ...b,
      sumber: b.suratJalanMasukId ? "sj" : b.sumberTersimpan, // batch dari SJ Masuk v25 yang belum bertanda tetap dikenali
      qtyStok: st.qtyStok,
      satuanStok: st.satuanStok,
      totalTerpakai,
      sisa,
      sisaKg: st.punyaUkuranKedua ? sisaKgOf(st.qtyKg, st.qtyStok, sisa) : null,
      jumlahCatatanPakai: usages.length,
    };
  });

  return NextResponse.json(result);

  } catch (error) {
    console.error("Error di /api/raw-material/summary [GET]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}
