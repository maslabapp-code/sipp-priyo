import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  suratJalanMasuk,
  suratJalanMasukItems,
  rawMaterialBatches,
  rawMaterials,
  customers,
} from "@/db/schema";
import { desc, eq, inArray } from "drizzle-orm";

export async function GET() {
  try {
    const rows = await db
      .select({
        id: suratJalanMasuk.id,
        noSj: suratJalanMasuk.noSj,
        tanggal: suratJalanMasuk.tanggal,
        noPo: suratJalanMasuk.noPo,
        customerNama: customers.nama,
      })
      .from(suratJalanMasuk)
      .leftJoin(customers, eq(suratJalanMasuk.customerId, customers.id))
      .orderBy(desc(suratJalanMasuk.tanggal), desc(suratJalanMasuk.createdAt));

    const items = rows.length
      ? await db
          .select({
            suratJalanMasukId: suratJalanMasukItems.suratJalanMasukId,
            nama: rawMaterials.nama,
            satuan: rawMaterials.satuan,
            qty: suratJalanMasukItems.qty,
            qty2: suratJalanMasukItems.qty2,
            satuan2: suratJalanMasukItems.satuan2,
          })
          .from(suratJalanMasukItems)
          .innerJoin(rawMaterials, eq(suratJalanMasukItems.rawMaterialId, rawMaterials.id))
          .where(inArray(suratJalanMasukItems.suratJalanMasukId, rows.map((r) => r.id)))
      : [];

    const byId = new Map<string, typeof items>();
    for (const it of items) {
      const list = byId.get(it.suratJalanMasukId) ?? [];
      list.push(it);
      byId.set(it.suratJalanMasukId, list);
    }
    return NextResponse.json(rows.map((r) => ({ ...r, items: byId.get(r.id) ?? [] })));
  } catch (error) {
    console.error("Error di /api/surat-jalan-masuk [GET]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}

type InItem = { rawMaterialId: string; qty: number; qty2?: number | null; satuan2?: string | null };

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { noSj, customerId, tanggal, noPo, catatan, items } = body as {
      noSj?: string;
      customerId?: string;
      tanggal?: string;
      noPo?: string;
      catatan?: string;
      items?: InItem[];
    };
    if (!noSj?.trim() || !tanggal || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "No. SJ, tanggal, dan minimal 1 baris material wajib diisi" }, { status: 400 });
    }
    if (items.some((it) => !it.rawMaterialId)) {
      return NextResponse.json({ error: "Setiap baris wajib memilih material" }, { status: 400 });
    }

    // Isian utama mengikuti jenis bahan baku: lembaran dan sheet/pita -> jumlah lembar/pita (stok dihitung dari angka ini,
    // Kg tagihan boleh kosong); selain itu -> qty (Kg atau pcs).
    const mats = await db
      .select({ id: rawMaterials.id, nama: rawMaterials.nama, jenis: rawMaterials.jenis })
      .from(rawMaterials)
      .where(inArray(rawMaterials.id, items.map((it) => it.rawMaterialId)));
    const matById = new Map(mats.map((m) => [m.id, m]));
    for (const it of items) {
      const m = matById.get(it.rawMaterialId);
      if (!m) return NextResponse.json({ error: "Bahan baku tidak ditemukan" }, { status: 404 });
      const pakaiQty2 = m.jenis === "lembaran" || m.jenis === "sheet_pita";
      const utama = pakaiQty2 ? Number(it.qty2) : Number(it.qty);
      if (!(utama > 0)) {
        return NextResponse.json(
          { error: `${pakaiQty2 ? "Jumlah lembar/pita" : "Qty"} wajib diisi untuk ${m.nama}.` },
          { status: 400 }
        );
      }
    }

    // Header + tiap baris SJ sekaligus jadi kedatangan (batch) di Stok Bahan Baku — satu transaksi supaya tidak setengah tersimpan
    const result = await db.transaction(async (tx) => {
      const [header] = await tx
        .insert(suratJalanMasuk)
        .values({
          noSj: noSj.trim(),
          customerId: customerId || null,
          tanggal: new Date(tanggal),
          noPo: noPo?.trim() || null,
          catatan: catatan?.trim() || null,
        })
        .onConflictDoNothing()
        .returning();
      if (!header) return null;

      for (const it of items) {
        const [batch] = await tx
          .insert(rawMaterialBatches)
          .values({
            rawMaterialId: it.rawMaterialId,
            tanggal: new Date(tanggal),
            qty: String(Number(it.qty) || 0),
            qty2: it.qty2 != null && Number(it.qty2) > 0 ? String(it.qty2) : null,
            satuan2: it.qty2 != null && Number(it.qty2) > 0 ? it.satuan2 || null : null,
            noSj: noSj.trim(),
            customerId: customerId || null,
            suratJalanMasukId: header.id,
            sumber: "sj",
          })
          .returning();
        await tx.insert(suratJalanMasukItems).values({
          suratJalanMasukId: header.id,
          rawMaterialId: it.rawMaterialId,
          batchId: batch.id,
          qty: String(Number(it.qty) || 0),
          qty2: it.qty2 != null && Number(it.qty2) > 0 ? String(it.qty2) : null,
          satuan2: it.qty2 != null && Number(it.qty2) > 0 ? it.satuan2 || null : null,
        });
      }
      return header;
    });

    if (!result) {
      return NextResponse.json({ error: "No. SJ ini sudah pernah dicatat" }, { status: 409 });
    }
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Error di /api/surat-jalan-masuk [POST]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}
