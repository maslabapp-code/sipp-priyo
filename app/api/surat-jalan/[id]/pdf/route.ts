import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { suratJalan, suratJalanItems, customers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { htmlToPdfBuffer, pdfResponse, BASE_STYLE } from "@/lib/export-pdf";

function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  const { id } = await params;
  const [row] = await db
    .select({
      id: suratJalan.id,
      noSj: suratJalan.noSj,
      tanggal: suratJalan.tanggal,
      catatan: suratJalan.catatan,
      customerNama: customers.nama,
    })
    .from(suratJalan)
    .leftJoin(customers, eq(suratJalan.customerId, customers.id))
    .where(eq(suratJalan.id, id))
    .limit(1);

  if (!row) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });

  const items = await db.select().from(suratJalanItems).where(eq(suratJalanItems.suratJalanId, id));

  const itemRows = items
    .map(
      (it, idx) =>
        `<tr><td style="text-align:center">${idx + 1}</td><td>${it.namaBarang}</td><td style="text-align:right">${Number(it.qty).toLocaleString("id-ID")}</td><td>${it.satuan ?? "-"}</td><td></td></tr>`
    )
    .join("");

  const html = `<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"><style>
    ${BASE_STYLE}
    .sj-info { display: table; width: 100%; margin-bottom: 16px; }
    .sj-info .row { display: table-row; }
    .sj-info .cell { display: table-cell; padding: 3px 0; font-size: 11px; }
    .sj-info .cell.label { width: 110px; color: #5b6472; }
    table.data td { vertical-align: top; }
    .ttd-grid { display: flex; justify-content: space-between; margin-top: 50px; text-align: center; }
    .ttd-box { width: 30%; font-size: 11px; }
    .ttd-line { margin-top: 55px; border-top: 1px solid #1f2937; padding-top: 4px; }
    .catatan { margin-top: 16px; font-size: 10.5px; color: #5b6472; }
  </style></head>
  <body>
    <div class="header"><h1>SURAT JALAN</h1><p>[Nama Perusahaan Anda]</p></div>
    <div class="content">
      <div class="sj-info">
        <div class="row"><div class="cell label">No. Surat Jalan</div><div class="cell"><b>${row.noSj}</b></div></div>
        <div class="row"><div class="cell label">Tanggal</div><div class="cell">${fmtDate(row.tanggal)}</div></div>
        <div class="row"><div class="cell label">Kepada</div><div class="cell"><b>${row.customerNama ?? "-"}</b></div></div>
      </div>

      <table class="data">
        <thead><tr><th style="width:30px;text-align:center">No</th><th>Nama Barang</th><th style="width:80px;text-align:right">Qty</th><th style="width:70px">Satuan</th><th style="width:100px">Ket.</th></tr></thead>
        <tbody>${itemRows || `<tr><td colspan="5" style="text-align:center;color:#8a919c">Tidak ada item</td></tr>`}</tbody>
      </table>

      ${row.catatan ? `<div class="catatan"><b>Catatan:</b> ${row.catatan}</div>` : ""}

      <div class="ttd-grid">
        <div class="ttd-box">Pengirim<div class="ttd-line">&nbsp;</div></div>
        <div class="ttd-box">Sopir / Kurir<div class="ttd-line">&nbsp;</div></div>
        <div class="ttd-box">Penerima<div class="ttd-line">&nbsp;</div></div>
      </div>

      <div class="footer">Sistem MTP — Dicetak otomatis ${new Date().toLocaleString("id-ID")}</div>
    </div>
  </body></html>`;

  const buffer = await htmlToPdfBuffer(html);
  return pdfResponse(buffer, `Surat-Jalan-${row.noSj.replace(/\//g, "-")}.pdf`);

  } catch (error) {
    console.error("Error di /api/[id]/pdf [GET]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}
