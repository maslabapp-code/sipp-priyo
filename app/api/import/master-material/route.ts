import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { parts, rawMaterials, satuanPotong } from "@/db/schema";
import { eq } from "drizzle-orm";
import { MASTER_MATERIAL } from "@/lib/master-material-data";
import { suggestMaster } from "@/lib/part-match";

const numStr = (v: number | null) => (v == null ? null : String(v));

// Pratinjau: tiap part di aplikasi + usulan baris master yang cocok (belum menyimpan apa pun)
export async function GET() {
  try {
    const rows = await db
      .select({
        id: parts.id,
        namaBarang: parts.namaBarang,
        rawMaterialId: parts.rawMaterialId,
        bahanBakuNama: rawMaterials.nama,
      })
      .from(parts)
      .leftJoin(rawMaterials, eq(parts.rawMaterialId, rawMaterials.id))
      .orderBy(parts.namaBarang);

    const result = rows.map((p) => {
      const s = suggestMaster(p.namaBarang);
      return {
        id: p.id,
        namaBarang: p.namaBarang,
        sudahTerhubung: !!p.rawMaterialId,
        bahanBakuNama: p.bahanBakuNama,
        masterId: s.master?.id ?? null,
        matchType: s.type,
      };
    });
    return NextResponse.json({ masters: MASTER_MATERIAL, parts: result });
  } catch (error) {
    console.error("Error di /api/import/master-material [GET]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}

// Terapkan: body = { mappings: [{ partId, masterId }] }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const mappings = Array.isArray(body.mappings) ? (body.mappings as { partId: string; masterId: string }[]) : [];
    if (mappings.length === 0) {
      return NextResponse.json({ error: "Belum ada part yang dipilih untuk dihubungkan." }, { status: 400 });
    }
    const masterById = new Map(MASTER_MATERIAL.map((m) => [m.id, m]));

    // Satuan potong standar harus ada di daftar pilihan Produksi
    for (const nama of ["Kg", "Lembar", "Pita"]) {
      await db.insert(satuanPotong).values({ nama }).onConflictDoNothing();
    }

    // Bahan baku: pakai yang sudah ada (nama sama), buat kalau belum ada
    const existing = await db.select().from(rawMaterials);
    const idByNama = new Map(existing.map((r) => [r.nama.trim().toLowerCase(), r.id]));
    let materialsCreated = 0;
    let updated = 0;

    for (const mp of mappings) {
      const m = masterById.get(mp.masterId);
      if (!m || !mp.partId) continue;

      const k = m.material.trim().toLowerCase();
      let rawId = idByNama.get(k);
      if (!rawId) {
        const [created] = await db
          .insert(rawMaterials)
          .values({ nama: m.material, jenis: m.jenis, satuan: m.jenis === "wiremesh" ? "pcs" : "Kg", grade: m.grade, ukuran: m.ukuran })
          .returning();
        rawId = created.id;
        idByNama.set(k, rawId);
        materialsCreated++;
      } else {
        // Bahan baku sudah ada: lengkapi spesifikasi dan ukurannya kalau masih kosong
        await db.update(rawMaterials).set({ grade: m.grade, ukuran: m.ukuran }).where(eq(rawMaterials.id, rawId));
      }

      await db
        .update(parts)
        .set({
          rawMaterialId: rawId,
          satuanPotong: m.satuanPotong,
          konversiPcs: numStr(m.konversi),
          brutoPerKg: numStr(m.bruto),
          updatedAt: new Date(),
        })
        .where(eq(parts.id, mp.partId));
      updated++;
    }

    return NextResponse.json({ updated, materialsCreated });
  } catch (error) {
    console.error("Error di /api/import/master-material [POST]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}
