import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { parts, customers, productionCuts, monthlyTransactions, dailyDeliveries } from "@/db/schema";
import { desc, eq, inArray } from "drizzle-orm";
import { computeCutTotal, toNumber } from "@/lib/calc";
import { buildExcelBuffer, excelResponse } from "@/lib/export-excel";
import { htmlToPdfBuffer, pdfResponse, reportHtml } from "@/lib/export-pdf";

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(n);
}

export async function GET(req: NextRequest) {
  try {
  const { searchParams } = new URL(req.url);
  const kategori = searchParams.get("kategori");
  const format = searchParams.get("format") === "pdf" ? "pdf" : "xlsx";

  const partRows = await db
    .select({ id: parts.id, kodePart: parts.kodePart, namaBarang: parts.namaBarang, kategori: parts.kategori, customerNama: customers.nama })
    .from(parts)
    .leftJoin(customers, eq(parts.customerId, customers.id))
    .where(kategori ? eq(parts.kategori, kategori) : undefined)
    .orderBy(desc(parts.createdAt));

  const allCuts = await db.select().from(productionCuts);
  const allTx = await db.select().from(monthlyTransactions);
  const allDaily = allTx.length
    ? await db.select().from(dailyDeliveries).where(inArray(dailyDeliveries.monthlyTransactionId, allTx.map((t) => t.id)))
    : [];
  const txById = new Map(allTx.map((t) => [t.id, t]));
  const kirimByPart = new Map<string, number>();
  for (const d of allDaily) {
    const tx = txById.get(d.monthlyTransactionId);
    if (!tx) continue;
    kirimByPart.set(tx.partId, (kirimByPart.get(tx.partId) ?? 0) + toNumber(d.qtyKirim));
  }

  const data = partRows.map((p, idx) => {
    const cuts = allCuts.filter((c) => c.partId === p.id);
    const totalPotong = cuts.reduce((sum, c) => sum + computeCutTotal(toNumber(c.qty), toNumber(c.konversi), toNumber(c.konversi2)), 0);
    const totalKirim = kirimByPart.get(p.id) ?? 0;
    return {
      no: idx + 1,
      namaBarang: p.namaBarang,
      kodePart: p.kodePart ?? "-",
      kategori: p.kategori ?? "-",
      customerNama: p.customerNama ?? "-",
      totalPotong,
      totalKirim,
      sisaStok: totalPotong - totalKirim,
    };
  });

  const totals = data.reduce((acc, r) => ({ totalPotong: acc.totalPotong + r.totalPotong, totalKirim: acc.totalKirim + r.totalKirim, sisaStok: acc.sisaStok + r.sisaStok }), { totalPotong: 0, totalKirim: 0, sisaStok: 0 });

  const title = "Produksi / Potong Bahan Baku";
  const subtitle = kategori ? `Kategori: ${kategori}` : "Semua Kategori";
  const filename = `Produksi-${kategori ?? "Semua"}-${new Date().toISOString().slice(0, 10)}`;

  if (format === "xlsx") {
    const columns = [
      { header: "No", key: "no", width: 6, align: "center" as const },
      { header: "Nama Barang", key: "namaBarang", width: 26 },
      { header: "Kode Part", key: "kodePart", width: 14 },
      { header: "Kategori", key: "kategori", width: 14 },
      { header: "Customer", key: "customerNama", width: 14 },
      { header: "Total Potong", key: "totalPotong", width: 14, format: "#,##0", align: "right" as const },
      { header: "Total Kirim", key: "totalKirim", width: 14, format: "#,##0", align: "right" as const },
      { header: "Sisa Stok", key: "sisaStok", width: 13, format: "#,##0", align: "right" as const },
    ];
    const buffer = await buildExcelBuffer({ title, subtitle, columns, rows: data, totalsRow: { namaBarang: `Total (${data.length} part)`, totalPotong: totals.totalPotong, totalKirim: totals.totalKirim, sisaStok: totals.sisaStok } });
    return excelResponse(buffer, `${filename}.xlsx`);
  }

  const html = reportHtml({
    title, subtitle,
    columns: [
      { header: "No", key: "no", align: "center" },
      { header: "Nama Barang", key: "namaBarang" },
      { header: "Kategori", key: "kategori" },
      { header: "Customer", key: "customerNama" },
      { header: "Total Potong", key: "totalPotongFmt", align: "right" },
      { header: "Total Kirim", key: "totalKirimFmt", align: "right" },
      { header: "Sisa Stok", key: "sisaStokFmt", align: "right" },
    ],
    rows: data.map((r) => ({ ...r, totalPotongFmt: fmt(r.totalPotong), totalKirimFmt: fmt(r.totalKirim), sisaStokFmt: fmt(r.sisaStok) })),
    totalsRow: { namaBarang: `Total (${data.length} part)`, totalPotongFmt: fmt(totals.totalPotong), totalKirimFmt: fmt(totals.totalKirim), sisaStokFmt: fmt(totals.sisaStok) },
  });
  const buffer = await htmlToPdfBuffer(html);
  return pdfResponse(buffer, `${filename}.pdf`);

  } catch (error) {
    console.error("Error di /api/export/produksi [GET]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}
