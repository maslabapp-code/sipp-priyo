import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { monthlyTransactions, parts, customers, dailyDeliveries } from "@/db/schema";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { computeDerived, toNumber } from "@/lib/calc";

export async function GET(req: NextRequest) {
  try {
  const { searchParams } = new URL(req.url);
  const bulan = Number(searchParams.get("bulan"));
  const tahun = Number(searchParams.get("tahun"));

  if (!bulan || !tahun) {
    return NextResponse.json({ error: "bulan & tahun wajib diisi" }, { status: 400 });
  }

  // semua=1 : tampilkan SEMUA part dari Master Part. Part yang belum punya baris di bulan ini
  // muncul sebagai baris kosong (id = null, belum tersimpan di database) dengan harga dari Master Part.
  // Tanpa semua=1 : hanya baris yang sudah tersimpan (dipakai menu lain, misalnya Jadwal Customer).
  const semua = searchParams.get("semua") === "1";

  type Base = {
    id: string | null;
    partId: string;
    namaBarang: string;
    kodePart: string | null;
    customerNama: string | null;
    bulan: number;
    tahun: number;
    stock: string;
    poAct: string;
    poCpl1: string;
    poCpl2: string;
    poCpl3: string;
    noPo: string | null;
    hargaJual: string;
  };

  let rows: Base[];
  if (semua) {
    const r = await db
      .select({
        txId: monthlyTransactions.id,
        partId: parts.id,
        namaBarang: parts.namaBarang,
        kodePart: parts.kodePart,
        customerNama: customers.nama,
        hargaDefault: parts.hargaJualDefault,
        stock: monthlyTransactions.stock,
        poAct: monthlyTransactions.poAct,
        poCpl1: monthlyTransactions.poCpl1,
        poCpl2: monthlyTransactions.poCpl2,
        poCpl3: monthlyTransactions.poCpl3,
        noPo: monthlyTransactions.noPo,
        hargaJual: monthlyTransactions.hargaJual,
      })
      .from(parts)
      .leftJoin(
        monthlyTransactions,
        and(
          eq(monthlyTransactions.partId, parts.id),
          eq(monthlyTransactions.bulan, bulan),
          eq(monthlyTransactions.tahun, tahun)
        )
      )
      .leftJoin(customers, eq(parts.customerId, customers.id))
      // yang sudah punya baris di atas (terbaru dulu), sisanya urut nama
      .orderBy(sql`${monthlyTransactions.id} is null`, desc(monthlyTransactions.createdAt), asc(parts.namaBarang));
    rows = r.map((x) => ({
      id: x.txId,
      partId: x.partId,
      namaBarang: x.namaBarang,
      kodePart: x.kodePart,
      customerNama: x.customerNama,
      bulan,
      tahun,
      stock: x.stock ?? "0",
      poAct: x.poAct ?? "0",
      poCpl1: x.poCpl1 ?? "0",
      poCpl2: x.poCpl2 ?? "0",
      poCpl3: x.poCpl3 ?? "0",
      noPo: x.noPo ?? null,
      hargaJual: x.hargaJual ?? x.hargaDefault,
    }));
  } else {
    rows = await db
      .select({
        id: monthlyTransactions.id,
        partId: monthlyTransactions.partId,
        namaBarang: parts.namaBarang,
        kodePart: parts.kodePart,
        customerNama: customers.nama,
        bulan: monthlyTransactions.bulan,
        tahun: monthlyTransactions.tahun,
        stock: monthlyTransactions.stock,
        poAct: monthlyTransactions.poAct,
        poCpl1: monthlyTransactions.poCpl1,
        poCpl2: monthlyTransactions.poCpl2,
        poCpl3: monthlyTransactions.poCpl3,
        noPo: monthlyTransactions.noPo,
        hargaJual: monthlyTransactions.hargaJual,
      })
      .from(monthlyTransactions)
      .innerJoin(parts, eq(monthlyTransactions.partId, parts.id))
      .leftJoin(customers, eq(parts.customerId, customers.id))
      .where(and(eq(monthlyTransactions.bulan, bulan), eq(monthlyTransactions.tahun, tahun)))
      .orderBy(desc(monthlyTransactions.createdAt));
  }

  // ambil semua daily deliveries untuk baris-baris ini sekaligus
  const txIds = rows.map((r) => r.id).filter((x): x is string => !!x);
  const allDeliveries = txIds.length
    ? await db
        .select()
        .from(dailyDeliveries)
        .where(inArray(dailyDeliveries.monthlyTransactionId, txIds))
    : [];

  const deliveriesByTx = new Map<string, { tanggal: number; qtyKirim: string; qtyRencana: string }[]>();
  for (const d of allDeliveries) {
    const arr = deliveriesByTx.get(d.monthlyTransactionId) ?? [];
    arr.push({ tanggal: d.tanggal, qtyKirim: d.qtyKirim, qtyRencana: d.qtyRencana });
    deliveriesByTx.set(d.monthlyTransactionId, arr);
  }

  const result = rows.map((r) => {
    const daily = (r.id ? deliveriesByTx.get(r.id) : undefined) ?? [];
    const kirim = daily.reduce((sum, d) => sum + toNumber(d.qtyKirim), 0);
    const derived = computeDerived({
      stock: toNumber(r.stock),
      poAct: toNumber(r.poAct),
      poCpl1: toNumber(r.poCpl1),
      poCpl2: toNumber(r.poCpl2),
      poCpl3: toNumber(r.poCpl3),
      hargaJual: toNumber(r.hargaJual),
      kirim,
    });
    return {
      ...r,
      kirim,
      dailyDeliveries: daily,
      ...derived,
    };
  });

  return NextResponse.json(result);

  } catch (error) {
    console.error("Error di /api/monthly-transactions [GET]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
  const body = await req.json();
  const { partId, bulan, tahun } = body;
  if (!partId || !bulan || !tahun) {
    return NextResponse.json({ error: "partId, bulan, tahun wajib diisi" }, { status: 400 });
  }

  const [part] = await db.select().from(parts).where(eq(parts.id, partId)).limit(1);
  if (!part) return NextResponse.json({ error: "Part tidak ditemukan" }, { status: 404 });

  const [row] = await db
    .insert(monthlyTransactions)
    .values({ partId, bulan, tahun, hargaJual: part.hargaJualDefault })
    .onConflictDoNothing()
    .returning();

  if (!row) {
    // Sudah ada (misalnya dibuat dari tab lain atau dua isian cepat berurutan): kembalikan yang ada.
    const [existing] = await db
      .select()
      .from(monthlyTransactions)
      .where(
        and(
          eq(monthlyTransactions.partId, partId),
          eq(monthlyTransactions.bulan, bulan),
          eq(monthlyTransactions.tahun, tahun)
        )
      )
      .limit(1);
    if (existing) return NextResponse.json(existing, { status: 200 });
    return NextResponse.json({ error: "Gagal membuat baris transaksi" }, { status: 409 });
  }
  return NextResponse.json(row, { status: 201 });

  } catch (error) {
    console.error("Error di /api/monthly-transactions [POST]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}
