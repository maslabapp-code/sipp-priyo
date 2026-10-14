import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { suratJalan, suratJalanItems, customers } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { nextSjNumber } from "@/lib/sj-number";
import { isJenisSj, MAX_ITEM_PER_SJ } from "@/lib/sj-const";

export async function GET() {
  try {
  const rows = await db
    .select({
      id: suratJalan.id,
      noSj: suratJalan.noSj,
      jenis: suratJalan.jenis,
      tanggal: suratJalan.tanggal,
      customerNama: customers.nama,
      createdAt: suratJalan.createdAt,
    })
    .from(suratJalan)
    .leftJoin(customers, eq(suratJalan.customerId, customers.id))
    .orderBy(desc(suratJalan.tanggal), desc(suratJalan.createdAt));

  const allItems = await db.select().from(suratJalanItems);
  const countByTx = new Map<string, number>();
  for (const it of allItems) countByTx.set(it.suratJalanId, (countByTx.get(it.suratJalanId) ?? 0) + 1);

  return NextResponse.json(rows.map((r) => ({ ...r, jumlahItem: countByTx.get(r.id) ?? 0 })));

  } catch (error) {
    console.error("Error di /api/. [GET]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}

// Kalau item lebih dari MAX_ITEM_PER_SJ, SJ dipecah otomatis menjadi beberapa SJ dengan nomor berbeda,
// karena customer tidak menerima SJ dengan nomor yang sama.
type InItem = { partId?: string; namaBarang: string; qty: number; satuan?: string };

export async function POST(req: NextRequest) {
  try {
  const body = await req.json();
  const { noSj, customerId, tanggal, catatan, items } = body;
  const jenis = isJenisSj(body.jenis) ? body.jenis : "P";
  if (!noSj || !tanggal || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "No. SJ, tanggal, dan minimal 1 item wajib diisi" }, { status: 400 });
  }

  const chunks: InItem[][] = [];
  for (let i = 0; i < items.length; i += MAX_ITEM_PER_SJ) chunks.push(items.slice(i, i + MAX_ITEM_PER_SJ));

  const created: (typeof suratJalan.$inferSelect)[] = [];
  for (let c = 0; c < chunks.length; c++) {
    const nomor = c === 0 ? String(noSj).trim() : await nextSjNumber(new Date(tanggal), jenis);
    const [row] = await db
      .insert(suratJalan)
      .values({ noSj: nomor, jenis, customerId: customerId || null, tanggal: new Date(tanggal), catatan: catatan || null })
      .onConflictDoNothing()
      .returning();

    if (!row) {
      return NextResponse.json({ error: `No. SJ ${nomor} sudah dipakai, pakai nomor lain` }, { status: 409 });
    }

    await db.insert(suratJalanItems).values(
      chunks[c].map((it) => ({
        suratJalanId: row.id,
        partId: it.partId || null,
        namaBarang: it.namaBarang,
        qty: String(it.qty ?? 0),
        satuan: it.satuan || null,
      }))
    );
    created.push(row);
  }

  // `all` berisi semua SJ yang terbentuk (lebih dari satu kalau item > 13 baris)
  return NextResponse.json({ ...created[0], all: created }, { status: 201 });

  } catch (error) {
    console.error("Error di /api/. [POST]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}
