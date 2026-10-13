import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { parts, customers, returnIncoming, returnResolutions } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { toNumber } from "@/lib/calc";
import { buildExcelBuffer, excelResponse } from "@/lib/export-excel";
import { htmlToPdfBuffer, pdfResponse, reportHtml } from "@/lib/export-pdf";

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(n);
}

export async function GET(req: NextRequest) {
  try {
  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") === "pdf" ? "pdf" : "xlsx";

  const partRows = await db
    .select({ id: parts.id, namaBarang: parts.namaBarang, customerNama: customers.nama })
    .from(parts)
    .leftJoin(customers, eq(parts.customerId, customers.id))
    .orderBy(desc(parts.createdAt));

  const allIncoming = await db.select().from(returnIncoming);
  const allResolutions = await db.select().from(returnResolutions);

  const data = partRows
    .map((p, idx) => {
      const incoming = allIncoming.filter((i) => i.partId === p.id);
      const resolutions = allResolutions.filter((r) => r.partId === p.id);
      const totalDatang = incoming.reduce((s, i) => s + toNumber(i.qty), 0);
      const totalKirimUlang = resolutions.filter((r) => r.jenis === "kirim_ulang").reduce((s, r) => s + toNumber(r.qty), 0);
      const totalSpoilage = resolutions.filter((r) => r.jenis === "spoilage").reduce((s, r) => s + toNumber(r.qty), 0);
      return { no: idx + 1, namaBarang: p.namaBarang, customerNama: p.customerNama ?? "-", totalDatang, totalKirimUlang, totalSpoilage, sisa: totalDatang - totalKirimUlang - totalSpoilage };
    })
    .filter((r) => r.totalDatang > 0)
    .map((r, idx) => ({ ...r, no: idx + 1 }));

  const totals = data.reduce((acc, r) => ({ totalDatang: acc.totalDatang + r.totalDatang, totalKirimUlang: acc.totalKirimUlang + r.totalKirimUlang, totalSpoilage: acc.totalSpoilage + r.totalSpoilage, sisa: acc.sisa + r.sisa }), { totalDatang: 0, totalKirimUlang: 0, totalSpoilage: 0, sisa: 0 });

  const title = "Return";
  const subtitle = `${data.length} part pernah ada retur — dicetak ${new Date().toLocaleDateString("id-ID")}`;
  const filename = `Return-${new Date().toISOString().slice(0, 10)}`;

  if (format === "xlsx") {
    const columns = [
      { header: "No", key: "no", width: 6, align: "center" as const },
      { header: "Nama Barang", key: "namaBarang", width: 26 },
      { header: "Customer", key: "customerNama", width: 14 },
      { header: "Datang", key: "totalDatang", width: 11, format: "#,##0", align: "right" as const },
      { header: "Kirim Ulang", key: "totalKirimUlang", width: 13, format: "#,##0", align: "right" as const },
      { header: "Spoilage", key: "totalSpoilage", width: 11, format: "#,##0", align: "right" as const },
      { header: "Sisa", key: "sisa", width: 11, format: "#,##0", align: "right" as const },
    ];
    const buffer = await buildExcelBuffer({ title, subtitle, columns, rows: data, totalsRow: { namaBarang: `Total (${data.length} part)`, totalDatang: totals.totalDatang, totalKirimUlang: totals.totalKirimUlang, totalSpoilage: totals.totalSpoilage, sisa: totals.sisa } });
    return excelResponse(buffer, `${filename}.xlsx`);
  }

  const html = reportHtml({
    title, subtitle,
    columns: [
      { header: "No", key: "no", align: "center" },
      { header: "Nama Barang", key: "namaBarang" },
      { header: "Customer", key: "customerNama" },
      { header: "Datang", key: "totalDatangFmt", align: "right" },
      { header: "Kirim Ulang", key: "totalKirimUlangFmt", align: "right" },
      { header: "Spoilage", key: "totalSpoilageFmt", align: "right" },
      { header: "Sisa", key: "sisaFmt", align: "right" },
    ],
    rows: data.map((r) => ({ ...r, totalDatangFmt: fmt(r.totalDatang), totalKirimUlangFmt: fmt(r.totalKirimUlang), totalSpoilageFmt: fmt(r.totalSpoilage), sisaFmt: fmt(r.sisa) })),
    totalsRow: { namaBarang: `Total (${data.length} part)`, totalDatangFmt: fmt(totals.totalDatang), totalKirimUlangFmt: fmt(totals.totalKirimUlang), totalSpoilageFmt: fmt(totals.totalSpoilage), sisaFmt: fmt(totals.sisa) },
  });
  const buffer = await htmlToPdfBuffer(html);
  return pdfResponse(buffer, `${filename}.pdf`);

  } catch (error) {
    console.error("Error di /api/export/return [GET]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}
