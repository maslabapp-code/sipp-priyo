import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { rawMaterialBatches, rawMaterialUsages, rawMaterials } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { toNumber } from "@/lib/calc";
import { stockOf } from "@/lib/stock";
import { buildExcelBuffer, excelResponse } from "@/lib/export-excel";
import { htmlToPdfBuffer, pdfResponse, reportHtml } from "@/lib/export-pdf";

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(n);
}
function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export async function GET(req: NextRequest) {
  try {
  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") === "pdf" ? "pdf" : "xlsx";

  const batches = await db
    .select({ id: rawMaterialBatches.id, namaBahanBaku: rawMaterials.nama, satuan: rawMaterials.satuan, tanggal: rawMaterialBatches.tanggal, qty: rawMaterialBatches.qty, qty2: rawMaterialBatches.qty2, satuan2: rawMaterialBatches.satuan2 })
    .from(rawMaterialBatches)
    .innerJoin(rawMaterials, eq(rawMaterialBatches.rawMaterialId, rawMaterials.id))
    .orderBy(desc(rawMaterialBatches.tanggal));

  const allUsages = await db.select().from(rawMaterialUsages);

  const data = batches.map((b, idx) => {
    const usages = allUsages.filter((u) => u.batchId === b.id);
    const totalTerpakai = usages.reduce((sum, u) => sum + toNumber(u.qty), 0);
    const st = stockOf(b);
    return {
      no: idx + 1,
      tanggal: fmtDate(b.tanggal),
      namaBahanBaku: b.namaBahanBaku + (st.satuanStok ? ` (${st.satuanStok})` : ""),
      qty: st.qtyStok,
      totalTerpakai,
      sisa: st.qtyStok - totalTerpakai,
    };
  });

  const totals = data.reduce((acc, r) => ({ qty: acc.qty + r.qty, totalTerpakai: acc.totalTerpakai + r.totalTerpakai, sisa: acc.sisa + r.sisa }), { qty: 0, totalTerpakai: 0, sisa: 0 });

  const title = "Stok Bahan Baku";
  const subtitle = `${data.length} batch — dicetak ${new Date().toLocaleDateString("id-ID")}`;
  const filename = `Stok-Bahan-Baku-${new Date().toISOString().slice(0, 10)}`;

  if (format === "xlsx") {
    const columns = [
      { header: "No", key: "no", width: 6, align: "center" as const },
      { header: "Tanggal", key: "tanggal", width: 14 },
      { header: "Nama Bahan Baku", key: "namaBahanBaku", width: 30 },
      { header: "Qty Masuk", key: "qty", width: 13, format: "#,##0", align: "right" as const },
      { header: "Terpakai", key: "totalTerpakai", width: 13, format: "#,##0", align: "right" as const },
      { header: "Sisa", key: "sisa", width: 13, format: "#,##0", align: "right" as const },
    ];
    const buffer = await buildExcelBuffer({ title, subtitle, columns, rows: data, totalsRow: { namaBahanBaku: `Total (${data.length} batch)`, qty: totals.qty, totalTerpakai: totals.totalTerpakai, sisa: totals.sisa } });
    return excelResponse(buffer, `${filename}.xlsx`);
  }

  const html = reportHtml({
    title, subtitle,
    columns: [
      { header: "No", key: "no", align: "center" },
      { header: "Tanggal", key: "tanggal" },
      { header: "Nama Bahan Baku", key: "namaBahanBaku" },
      { header: "Qty Masuk", key: "qtyFmt", align: "right" },
      { header: "Terpakai", key: "totalTerpakaiFmt", align: "right" },
      { header: "Sisa", key: "sisaFmt", align: "right" },
    ],
    rows: data.map((r) => ({ ...r, qtyFmt: fmt(r.qty), totalTerpakaiFmt: fmt(r.totalTerpakai), sisaFmt: fmt(r.sisa) })),
    totalsRow: { namaBahanBaku: `Total (${data.length} batch)`, qtyFmt: fmt(totals.qty), totalTerpakaiFmt: fmt(totals.totalTerpakai), sisaFmt: fmt(totals.sisa) },
  });
  const buffer = await htmlToPdfBuffer(html);
  return pdfResponse(buffer, `${filename}.pdf`);

  } catch (error) {
    console.error("Error di /api/export/stok-bahan-baku [GET]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}
