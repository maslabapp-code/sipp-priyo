import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { monthlyTransactions, parts, customers, dailyDeliveries } from "@/db/schema";
import { and, asc, eq, inArray } from "drizzle-orm";
import { computeDerived, toNumber } from "@/lib/calc";
import { buildExcelBuffer, excelResponse } from "@/lib/export-excel";
import { htmlToPdfBuffer, pdfResponse, reportHtml } from "@/lib/export-pdf";

const BULAN_LABEL = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(n);
}

export async function GET(req: NextRequest) {
  try {
  const { searchParams } = new URL(req.url);
  const bulan = Number(searchParams.get("bulan"));
  const tahun = Number(searchParams.get("tahun"));
  const format = searchParams.get("format") === "pdf" ? "pdf" : "xlsx";
  if (!bulan || !tahun) return NextResponse.json({ error: "bulan & tahun wajib diisi" }, { status: 400 });

  const rows = await db
    .select({
      id: monthlyTransactions.id,
      namaBarang: parts.namaBarang,
      customerNama: customers.nama,
      noPo: monthlyTransactions.noPo,
      stock: monthlyTransactions.stock,
      poAct: monthlyTransactions.poAct,
      poCpl1: monthlyTransactions.poCpl1,
      poCpl2: monthlyTransactions.poCpl2,
      poCpl3: monthlyTransactions.poCpl3,
      hargaJual: monthlyTransactions.hargaJual,
    })
    .from(monthlyTransactions)
    .innerJoin(parts, eq(monthlyTransactions.partId, parts.id))
    .leftJoin(customers, eq(parts.customerId, customers.id))
    .where(and(eq(monthlyTransactions.bulan, bulan), eq(monthlyTransactions.tahun, tahun)))
    .orderBy(asc(parts.namaBarang));

  const txIds = rows.map((r) => r.id);
  const allDaily = txIds.length
    ? await db.select().from(dailyDeliveries).where(inArray(dailyDeliveries.monthlyTransactionId, txIds))
    : [];
  const kirimByTx = new Map<string, number>();
  for (const d of allDaily) {
    kirimByTx.set(d.monthlyTransactionId, (kirimByTx.get(d.monthlyTransactionId) ?? 0) + toNumber(d.qtyKirim));
  }

  const data = rows.map((r, idx) => {
    const kirim = kirimByTx.get(r.id) ?? 0;
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
      no: idx + 1,
      namaBarang: r.namaBarang,
      customerNama: r.customerNama ?? "-",
      noPo: r.noPo ?? "-",
      stock: toNumber(r.stock),
      poAct: toNumber(r.poAct),
      poCpl1: toNumber(r.poCpl1),
      poCpl2: toNumber(r.poCpl2),
      poCpl3: toNumber(r.poCpl3),
      totalPo: derived.totalPo,
      kirim,
      sisaPo: derived.sisaPo,
      hargaJual: toNumber(r.hargaJual),
      actualPenjualan: derived.actualPenjualan,
      ppn10: derived.ppn10,
      totalPenjualan: derived.totalPenjualan,
    };
  });

  const totals = data.reduce(
    (acc, r) => ({
      totalPo: acc.totalPo + r.totalPo,
      kirim: acc.kirim + r.kirim,
      sisaPo: acc.sisaPo + r.sisaPo,
      totalPenjualan: acc.totalPenjualan + r.totalPenjualan,
    }),
    { totalPo: 0, kirim: 0, sisaPo: 0, totalPenjualan: 0 }
  );

  const title = "Transaksi Bulanan";
  const subtitle = `${BULAN_LABEL[bulan - 1]} ${tahun}`;
  const filename = `Transaksi-Bulanan-${BULAN_LABEL[bulan - 1]}-${tahun}`;

  if (format === "xlsx") {
    const columns = [
      { header: "No", key: "no", width: 6, align: "center" as const },
      { header: "Nama Barang", key: "namaBarang", width: 28 },
      { header: "Customer", key: "customerNama", width: 14 },
      { header: "No. PO", key: "noPo", width: 14 },
      { header: "Stock", key: "stock", width: 12, format: "#,##0", align: "right" as const },
      { header: "PO Act", key: "poAct", width: 12, format: "#,##0", align: "right" as const },
      { header: "CPL 1", key: "poCpl1", width: 10, format: "#,##0", align: "right" as const },
      { header: "CPL 2", key: "poCpl2", width: 10, format: "#,##0", align: "right" as const },
      { header: "CPL 3", key: "poCpl3", width: 10, format: "#,##0", align: "right" as const },
      { header: "Total PO", key: "totalPo", width: 13, format: "#,##0", align: "right" as const },
      { header: "Kirim", key: "kirim", width: 12, format: "#,##0", align: "right" as const },
      { header: "Sisa PO", key: "sisaPo", width: 12, format: "#,##0", align: "right" as const },
      { header: "Harga Jual", key: "hargaJual", width: 14, format: '"Rp"#,##0', align: "right" as const },
      { header: "Actual Penjualan", key: "actualPenjualan", width: 17, format: '"Rp"#,##0', align: "right" as const },
      { header: "PPN 10%", key: "ppn10", width: 14, format: '"Rp"#,##0', align: "right" as const },
      { header: "Total Penjualan", key: "totalPenjualan", width: 17, format: '"Rp"#,##0', align: "right" as const },
    ];
    const buffer = await buildExcelBuffer({
      title,
      subtitle,
      columns,
      rows: data,
      totalsRow: { no: "", namaBarang: `Total (${data.length} part)`, totalPo: totals.totalPo, kirim: totals.kirim, sisaPo: totals.sisaPo, totalPenjualan: totals.totalPenjualan },
    });
    return excelResponse(buffer, `${filename}.xlsx`);
  }

  const html = reportHtml({
    title,
    subtitle,
    columns: [
      { header: "No", key: "no", align: "center" },
      { header: "Nama Barang", key: "namaBarang" },
      { header: "Customer", key: "customerNama" },
      { header: "No. PO", key: "noPo" },
      { header: "Total PO", key: "totalPoFmt", align: "right" },
      { header: "Kirim", key: "kirimFmt", align: "right" },
      { header: "Sisa PO", key: "sisaPoFmt", align: "right" },
      { header: "Total Penjualan", key: "totalPenjualanFmt", align: "right" },
    ],
    rows: data.map((r) => ({ ...r, totalPoFmt: fmt(r.totalPo), kirimFmt: fmt(r.kirim), sisaPoFmt: fmt(r.sisaPo), totalPenjualanFmt: "Rp " + fmt(r.totalPenjualan) })),
    totalsRow: { namaBarang: `Total (${data.length} part)`, totalPoFmt: fmt(totals.totalPo), kirimFmt: fmt(totals.kirim), sisaPoFmt: fmt(totals.sisaPo), totalPenjualanFmt: "Rp " + fmt(totals.totalPenjualan) },
  });
  const buffer = await htmlToPdfBuffer(html);
  return pdfResponse(buffer, `${filename}.pdf`);

  } catch (error) {
    console.error("Error di /api/export/transaksi-bulanan [GET]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}
