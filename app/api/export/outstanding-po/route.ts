import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { monthlyTransactions, parts, customers, dailyDeliveries } from "@/db/schema";
import { desc, eq, inArray } from "drizzle-orm";
import { computeDerived, toNumber } from "@/lib/calc";
import { buildExcelBuffer, excelResponse } from "@/lib/export-excel";
import { htmlToPdfBuffer, pdfResponse, reportHtml } from "@/lib/export-pdf";

const BULAN_LABEL = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(n);
}

export async function GET(req: NextRequest) {
  try {
  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") === "pdf" ? "pdf" : "xlsx";

  const rows = await db
    .select({
      id: monthlyTransactions.id,
      noPo: monthlyTransactions.noPo,
      namaBarang: parts.namaBarang,
      customerNama: customers.nama,
      bulan: monthlyTransactions.bulan,
      tahun: monthlyTransactions.tahun,
      poCpl1: monthlyTransactions.poCpl1,
      poCpl2: monthlyTransactions.poCpl2,
      poCpl3: monthlyTransactions.poCpl3,
      hargaJual: monthlyTransactions.hargaJual,
      stock: monthlyTransactions.stock,
      poAct: monthlyTransactions.poAct,
    })
    .from(monthlyTransactions)
    .innerJoin(parts, eq(monthlyTransactions.partId, parts.id))
    .leftJoin(customers, eq(parts.customerId, customers.id))
    .orderBy(desc(monthlyTransactions.tahun), desc(monthlyTransactions.bulan));

  const txIds = rows.map((r) => r.id);
  const allDaily = txIds.length
    ? await db.select().from(dailyDeliveries).where(inArray(dailyDeliveries.monthlyTransactionId, txIds))
    : [];
  const kirimByTx = new Map<string, number>();
  for (const d of allDaily) kirimByTx.set(d.monthlyTransactionId, (kirimByTx.get(d.monthlyTransactionId) ?? 0) + toNumber(d.qtyKirim));

  const data = rows
    .map((r) => {
      const kirim = kirimByTx.get(r.id) ?? 0;
      const derived = computeDerived({
        stock: toNumber(r.stock), poAct: toNumber(r.poAct), poCpl1: toNumber(r.poCpl1), poCpl2: toNumber(r.poCpl2),
        poCpl3: toNumber(r.poCpl3), hargaJual: toNumber(r.hargaJual), kirim,
      });
      return { ...r, kirim, ...derived, bulanLabel: `${BULAN_LABEL[r.bulan - 1]} ${r.tahun}` };
    })
    .filter((r) => r.sisaPo > 0)
    .sort((a, b) => b.sisaPo - a.sisaPo)
    .map((r, idx) => ({ no: idx + 1, noPo: r.noPo ?? "-", namaBarang: r.namaBarang, customerNama: r.customerNama ?? "-", bulanLabel: r.bulanLabel, totalPo: r.totalPo, kirim: r.kirim, sisaPo: r.sisaPo }));

  const totalSisa = data.reduce((s, r) => s + r.sisaPo, 0);
  const title = "Outstanding PO";
  const subtitle = `${data.length} PO belum lunas terkirim — dicetak ${new Date().toLocaleDateString("id-ID")}`;
  const filename = `Outstanding-PO-${new Date().toISOString().slice(0, 10)}`;

  if (format === "xlsx") {
    const columns = [
      { header: "No", key: "no", width: 6, align: "center" as const },
      { header: "No. PO", key: "noPo", width: 15 },
      { header: "Nama Part", key: "namaBarang", width: 28 },
      { header: "Customer", key: "customerNama", width: 14 },
      { header: "Bulan", key: "bulanLabel", width: 12 },
      { header: "Total PO", key: "totalPo", width: 13, format: "#,##0", align: "right" as const },
      { header: "Kirim", key: "kirim", width: 12, format: "#,##0", align: "right" as const },
      { header: "Sisa PO", key: "sisaPo", width: 12, format: "#,##0", align: "right" as const },
    ];
    const buffer = await buildExcelBuffer({
      title, subtitle, columns, rows: data,
      totalsRow: { namaBarang: "Total Sisa Outstanding", sisaPo: totalSisa },
    });
    return excelResponse(buffer, `${filename}.xlsx`);
  }

  const html = reportHtml({
    title, subtitle,
    columns: [
      { header: "No", key: "no", align: "center" },
      { header: "No. PO", key: "noPo" },
      { header: "Nama Part", key: "namaBarang" },
      { header: "Customer", key: "customerNama" },
      { header: "Bulan", key: "bulanLabel" },
      { header: "Total PO", key: "totalPoFmt", align: "right" },
      { header: "Kirim", key: "kirimFmt", align: "right" },
      { header: "Sisa PO", key: "sisaPoFmt", align: "right" },
    ],
    rows: data.map((r) => ({ ...r, totalPoFmt: fmt(r.totalPo), kirimFmt: fmt(r.kirim), sisaPoFmt: fmt(r.sisaPo) })),
    totalsRow: { namaBarang: "Total Sisa Outstanding", sisaPoFmt: fmt(totalSisa) },
  });
  const buffer = await htmlToPdfBuffer(html);
  return pdfResponse(buffer, `${filename}.pdf`);

  } catch (error) {
    console.error("Error di /api/export/outstanding-po [GET]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}
