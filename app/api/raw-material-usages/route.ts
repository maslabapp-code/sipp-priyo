import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { rawMaterialUsages, parts, productionCuts } from "@/db/schema";
import { asc, eq, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
  const { searchParams } = new URL(req.url);
  const batchId = searchParams.get("batchId");
  if (!batchId) return NextResponse.json({ error: "batchId wajib diisi" }, { status: 400 });

  const rows = await db
    .select({
      id: rawMaterialUsages.id,
      batchId: rawMaterialUsages.batchId,
      partId: rawMaterialUsages.partId,
      namaBarang: parts.namaBarang,
      tanggal: rawMaterialUsages.tanggal,
      qty: rawMaterialUsages.qty,
      cutId: sql<string | null>`coalesce(${rawMaterialUsages.productionCutId}, ${productionCuts.id})`, // terisi kalau pemakaian ini berasal dari catatan potong di Produksi
    })
    .from(rawMaterialUsages)
    .leftJoin(parts, eq(rawMaterialUsages.partId, parts.id))
    .leftJoin(productionCuts, eq(productionCuts.rawMaterialUsageId, rawMaterialUsages.id))
    .where(eq(rawMaterialUsages.batchId, batchId))
    .orderBy(asc(rawMaterialUsages.tanggal));
  return NextResponse.json(rows);

  } catch (error) {
    console.error("Error di /api/raw-material-usages [GET]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}

// Pemakaian bahan baku hanya tercatat otomatis dari catatan potong di menu Produksi.
// Pintu manual ditutup supaya stok bahan baku selalu sama dengan catatan Produksi.
export async function POST() {
  return NextResponse.json(
    { error: "Pemakaian bahan baku hanya bisa dicatat lewat menu Produksi (catatan potong)." },
    { status: 405 }
  );
}
