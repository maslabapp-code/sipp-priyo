import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { parts, customers, rawMaterials } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export async function GET() {
  try {
  const rows = await db
    .select({
      id: parts.id,
      kodePart: parts.kodePart,
      namaBarang: parts.namaBarang,
      kategori: parts.kategori,
      hargaJualDefault: parts.hargaJualDefault,
      customerId: parts.customerId,
      customerNama: customers.nama,
      rawMaterialId: parts.rawMaterialId,
      bahanBakuNama: rawMaterials.nama,
      satuanPotong: parts.satuanPotong,
      konversiPcs: parts.konversiPcs,
      lebarPotong: parts.lebarPotong,
      beratPerUnit: parts.beratPerUnit,
      brutoPerKg: parts.brutoPerKg,
      nettoPerKg: parts.nettoPerKg,
    })
    .from(parts)
    .leftJoin(customers, eq(parts.customerId, customers.id))
    .leftJoin(rawMaterials, eq(parts.rawMaterialId, rawMaterials.id))
    .orderBy(desc(parts.createdAt));
  return NextResponse.json(rows);

  } catch (error) {
    console.error("Error di /api/parts [GET]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
  const body = await req.json();
  if (!body.namaBarang || typeof body.namaBarang !== "string") {
    return NextResponse.json({ error: "Nama barang wajib diisi" }, { status: 400 });
  }
  const [row] = await db
    .insert(parts)
    .values({
      namaBarang: body.namaBarang.trim(),
      kodePart: body.kodePart ?? null,
      kategori: body.kategori ?? null,
      customerId: body.customerId ?? null,
    })
    .returning();
  return NextResponse.json(row, { status: 201 });

  } catch (error) {
    console.error("Error di /api/parts [POST]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}
