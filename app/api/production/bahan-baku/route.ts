import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { parts, rawMaterials } from "@/db/schema";
import { eq } from "drizzle-orm";
import { pickBatch } from "@/lib/auto-batch";

// Info bahan baku untuk satu part: dipakai detail Produksi supaya admin tidak perlu memilih manual
export async function GET(req: NextRequest) {
  try {
    const partId = new URL(req.url).searchParams.get("partId");
    if (!partId) return NextResponse.json({ error: "partId wajib diisi" }, { status: 400 });

    const [row] = await db
      .select({
        rawMaterialId: parts.rawMaterialId,
        bahanBakuNama: rawMaterials.nama,
        jenis: rawMaterials.jenis,
        satuanPotong: parts.satuanPotong,
        konversiPcs: parts.konversiPcs,
        brutoPerKg: parts.brutoPerKg,
        nettoPerKg: parts.nettoPerKg,
      })
      .from(parts)
      .leftJoin(rawMaterials, eq(parts.rawMaterialId, rawMaterials.id))
      .where(eq(parts.id, partId));
    if (!row) return NextResponse.json({ error: "Part tidak ditemukan" }, { status: 404 });

    const batch = row.rawMaterialId ? await pickBatch(row.rawMaterialId) : null;
    return NextResponse.json({
      ...row,
      terkunci: !!(row.konversiPcs && Number(row.konversiPcs) > 0), // konversi dikunci dari Master Part
      batchAktif: batch,
    });
  } catch (error) {
    console.error("Error di /api/production/bahan-baku [GET]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}
