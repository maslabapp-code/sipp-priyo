import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { rawMaterials, parts } from "@/db/schema";
import { desc, sql, isNotNull } from "drizzle-orm";
import { isJenisMaterial, satuanTagihan } from "@/lib/material-jenis";

export async function GET() {
  try {
  const rows = await db.select().from(rawMaterials).orderBy(desc(rawMaterials.createdAt));
  // Part yang memakai tiap bahan baku (dengan konversinya). Dipakai untuk memperkirakan total pcs saat input SJ Masuk.
  const used = await db
    .select({ rawMaterialId: parts.rawMaterialId, namaBarang: parts.namaBarang, konversiPcs: parts.konversiPcs, satuanPotong: parts.satuanPotong })
    .from(parts)
    .where(isNotNull(parts.rawMaterialId));
  const byMat = new Map<string, { namaBarang: string; konversiPcs: string | null; satuanPotong: string | null }[]>();
  for (const u of used) {
    if (!u.rawMaterialId) continue;
    const list = byMat.get(u.rawMaterialId) ?? [];
    list.push({ namaBarang: u.namaBarang, konversiPcs: u.konversiPcs, satuanPotong: u.satuanPotong });
    byMat.set(u.rawMaterialId, list);
  }
  return NextResponse.json(rows.map((r) => ({ ...r, parts: byMat.get(r.id) ?? [] })));

  } catch (error) {
    console.error("Error di /api/raw-materials [GET]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
  const body = await req.json();
  if (!body.nama || typeof body.nama !== "string") {
    return NextResponse.json({ error: "Nama bahan baku wajib diisi" }, { status: 400 });
  }
  const dup = await db.select().from(rawMaterials).where(sql`lower(${rawMaterials.nama}) = ${body.nama.trim().toLowerCase()}`);
  if (dup.length > 0) {
    return NextResponse.json({ error: `Bahan baku "${dup[0].nama}" sudah ada`, existing: dup[0] }, { status: 409 });
  }
  const jenis = isJenisMaterial(body.jenis) ? body.jenis : "lembaran";
  const [row] = await db
    .insert(rawMaterials)
    .values({
      nama: body.nama.trim(),
      jenis,
      satuan: body.satuan ?? satuanTagihan(jenis),
      grade: typeof body.grade === "string" && body.grade.trim() ? body.grade.trim() : null,
      ukuran: typeof body.ukuran === "string" && body.ukuran.trim() ? body.ukuran.trim() : null,
    })
    .returning();
  return NextResponse.json(row, { status: 201 });

  } catch (error) {
    console.error("Error di /api/raw-materials [POST]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}
