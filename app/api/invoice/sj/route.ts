import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { suratJalan, suratJalanItems, parts, monthlyTransactions } from "@/db/schema";
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { toNumber } from "@/lib/calc";

// Daftar Surat Jalan Keluar milik satu customer dalam rentang tanggal, lengkap dengan item dan
// harga dari Master Part. Dipakai menu Invoice untuk menyusun tagihan.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customerId");
    const dari = searchParams.get("dari");
    const sampai = searchParams.get("sampai");
    if (!customerId || !dari || !sampai) {
      return NextResponse.json({ error: "Customer, tanggal awal, dan tanggal akhir wajib diisi" }, { status: 400 });
    }
    const dariDate = new Date(`${dari}T00:00:00`);
    const sampaiDate = new Date(`${sampai}T23:59:59.999`);
    if (Number.isNaN(dariDate.getTime()) || Number.isNaN(sampaiDate.getTime())) {
      return NextResponse.json({ error: "Format tanggal tidak valid" }, { status: 400 });
    }

    const sjs = await db
      .select()
      .from(suratJalan)
      .where(and(eq(suratJalan.customerId, customerId), gte(suratJalan.tanggal, dariDate), lte(suratJalan.tanggal, sampaiDate)))
      .orderBy(asc(suratJalan.tanggal), asc(suratJalan.noSj));

    if (sjs.length === 0) return NextResponse.json({ sjs: [], noPo: "" });

    const items = await db
      .select({
        suratJalanId: suratJalanItems.suratJalanId,
        partId: suratJalanItems.partId,
        namaBarang: suratJalanItems.namaBarang,
        qty: suratJalanItems.qty,
        kategori: parts.kategori,
        harga: parts.hargaJualDefault,
      })
      .from(suratJalanItems)
      .leftJoin(parts, eq(suratJalanItems.partId, parts.id))
      .where(inArray(suratJalanItems.suratJalanId, sjs.map((s) => s.id)));

    // Usulan No. PO: nomor PO yang tercatat di Transaksi Bulanan untuk part-part ini pada bulan akhir periode
    const partIds = [...new Set(items.map((i) => i.partId).filter((x): x is string => !!x))];
    let noPo = "";
    if (partIds.length > 0) {
      const tx = await db
        .select({ noPo: monthlyTransactions.noPo })
        .from(monthlyTransactions)
        .where(
          and(
            inArray(monthlyTransactions.partId, partIds),
            eq(monthlyTransactions.bulan, sampaiDate.getMonth() + 1),
            eq(monthlyTransactions.tahun, sampaiDate.getFullYear())
          )
        );
      noPo = [...new Set(tx.map((t) => (t.noPo ?? "").trim()).filter(Boolean))].join(" / ");
    }

    return NextResponse.json({
      noPo,
      sjs: sjs.map((s) => ({
        id: s.id,
        noSj: s.noSj,
        jenis: s.jenis,
        tanggal: s.tanggal,
        items: items
          .filter((i) => i.suratJalanId === s.id)
          .map((i) => ({
            partId: i.partId,
            namaBarang: i.namaBarang,
            qty: toNumber(i.qty),
            kategori: i.kategori,
            harga: toNumber(i.harga),
          })),
      })),
    });
  } catch (error) {
    console.error("Error di /api/invoice/sj [GET]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}
