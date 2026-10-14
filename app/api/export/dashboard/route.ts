import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { excelResponse } from "@/lib/export-excel";
import { htmlToPdfBuffer, pdfResponse, BASE_STYLE } from "@/lib/export-pdf";
import { getDashboardData } from "@/lib/dashboard-data";

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n);
}
function pct(n: number | null) {
  return n == null ? "-" : new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(n) + "%";
}

const HEAD = { bold: true, color: { argb: "FFFFFFFF" } };
const HEAD_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF1E4D6B" } };

export async function GET(req: NextRequest) {
  try {
  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") === "pdf" ? "pdf" : "xlsx";
  const s = await getDashboardData();
  const filename = `Dashboard-${new Date().toISOString().slice(0, 10)}`;

  if (format === "xlsx") {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Dashboard");
    ws.getCell(1, 1).value = "Dashboard — Ringkasan Sistem MTP";
    ws.getCell(1, 1).font = { bold: true, size: 14, color: { argb: "FF1E4D6B" } };
    ws.getCell(2, 1).value = s.bulanLabel;
    ws.getCell(2, 1).font = { italic: true, color: { argb: "FF5B6472" } };

    const kpi: [string, string | number][] = [
      ["Total Part Aktif", s.totalPart], ["Total Customer", s.totalCustomer],
      ["Total PO Bulan Ini", s.totalPoBulanIni], ["Kirim Bulan Ini", s.kirimBulanIni],
      ["Delivery Bulan Ini", pct(s.persenBulanIni)], ["Sisa PO Bulan Ini", s.sisaPoBulanIni],
      ["Sisa Stok Produksi", s.sisaStokProduksi],
      ["Outstanding PO (jumlah)", s.outstandingCount], ["Outstanding PO (total sisa)", s.outstandingTotal],
      ["Retur Belum Selesai", s.returSisa],
    ];
    let r = 4;
    ws.getCell(r, 1).value = "Ringkasan KPI"; ws.getCell(r, 1).font = { bold: true, color: { argb: "FF1E4D6B" } }; r++;
    kpi.forEach(([label, val]) => {
      ws.getCell(r, 1).value = label;
      ws.getCell(r, 2).value = val;
      ws.getCell(r, 2).numFmt = "#,##0";
      r++;
    });
    r += 1;

    ws.getCell(r, 1).value = "Delivery 6 Bulan Terakhir"; ws.getCell(r, 1).font = { bold: true, color: { argb: "FF1E4D6B" } }; r++;
    ["Bulan", "Total PO", "Terkirim", "Delivery (%)"].forEach((h, i) => { const c = ws.getCell(r, i + 1); c.value = h; c.font = HEAD; c.fill = HEAD_FILL; });
    r++;
    s.trend.forEach((t) => {
      ws.getCell(r, 1).value = t.label;
      ws.getCell(r, 2).value = t.totalPo; ws.getCell(r, 2).numFmt = "#,##0";
      ws.getCell(r, 3).value = t.kirim; ws.getCell(r, 3).numFmt = "#,##0";
      ws.getCell(r, 4).value = t.persen == null ? "-" : t.persen / 100; if (t.persen != null) ws.getCell(r, 4).numFmt = "0.0%";
      r++;
    });
    r += 1;

    ws.getCell(r, 1).value = "Delivery per Customer (bulan ini)"; ws.getCell(r, 1).font = { bold: true, color: { argb: "FF1E4D6B" } }; r++;
    ["Customer", "Total PO", "Terkirim", "Delivery (%)"].forEach((h, i) => { const c = ws.getCell(r, i + 1); c.value = h; c.font = HEAD; c.fill = HEAD_FILL; });
    r++;
    s.perCustomer.forEach((t) => {
      ws.getCell(r, 1).value = t.nama;
      ws.getCell(r, 2).value = t.totalPo; ws.getCell(r, 2).numFmt = "#,##0";
      ws.getCell(r, 3).value = t.kirim; ws.getCell(r, 3).numFmt = "#,##0";
      ws.getCell(r, 4).value = t.persen == null ? "-" : t.persen / 100; if (t.persen != null) ws.getCell(r, 4).numFmt = "0.0%";
      r++;
    });
    r += 1;

    ws.getCell(r, 1).value = "5 PO Outstanding Terbesar"; ws.getCell(r, 1).font = { bold: true, color: { argb: "FF1E4D6B" } }; r++;
    ["No. PO", "Nama Barang", "Customer", "Sisa PO"].forEach((h, i) => { const c = ws.getCell(r, i + 1); c.value = h; c.font = HEAD; c.fill = HEAD_FILL; });
    r++;
    s.topOutstanding.forEach((t) => { ws.getCell(r, 1).value = t.noPo ?? "-"; ws.getCell(r, 2).value = t.namaBarang; ws.getCell(r, 3).value = t.customerNama ?? "-"; ws.getCell(r, 4).value = t.sisaPo; ws.getCell(r, 4).numFmt = "#,##0"; r++; });

    ws.columns.forEach((col) => { col.width = 22; });

    const buf = await wb.xlsx.writeBuffer();
    return excelResponse(Buffer.from(buf), `${filename}.xlsx`);
  }

  const html = `<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"><style>${BASE_STYLE}</style></head>
  <body>
    <div class="header"><h1>Dashboard — Ringkasan Sistem MTP</h1><p>${s.bulanLabel}</p></div>
    <div class="content">
      <div class="kpi-grid">
        ${[
          ["Total Part Aktif", fmt(s.totalPart)],
          ["Delivery Bulan Ini", pct(s.persenBulanIni)],
          ["Kirim Bulan Ini", fmt(s.kirimBulanIni)],
          ["Total PO Bulan Ini", fmt(s.totalPoBulanIni)],
          ["Sisa PO Bulan Ini", fmt(s.sisaPoBulanIni)],
          ["Sisa Stok Produksi", fmt(s.sisaStokProduksi)],
          ["Outstanding PO", s.outstandingCount + " PO"],
          ["Retur Belum Selesai", fmt(s.returSisa)],
        ].map(([label, val]) => `<div class="kpi-card"><div class="label">${label}</div><div class="value">${val}</div></div>`).join("")}
      </div>

      <div class="section-title">Delivery 6 Bulan Terakhir</div>
      <table class="data"><thead><tr><th>Bulan</th><th style="text-align:right">Total PO</th><th style="text-align:right">Terkirim</th><th style="text-align:right">Delivery</th></tr></thead>
      <tbody>${s.trend.map((t) => `<tr><td>${t.label}</td><td style="text-align:right">${fmt(t.totalPo)}</td><td style="text-align:right">${fmt(t.kirim)}</td><td style="text-align:right">${pct(t.persen)}</td></tr>`).join("")}</tbody></table>

      <div class="section-title">Delivery per Customer (bulan ini)</div>
      <table class="data"><thead><tr><th>Customer</th><th style="text-align:right">Total PO</th><th style="text-align:right">Terkirim</th><th style="text-align:right">Delivery</th></tr></thead>
      <tbody>${s.perCustomer.length ? s.perCustomer.map((t) => `<tr><td>${t.nama}</td><td style="text-align:right">${fmt(t.totalPo)}</td><td style="text-align:right">${fmt(t.kirim)}</td><td style="text-align:right">${pct(t.persen)}</td></tr>`).join("") : `<tr><td colspan="4" style="text-align:center;color:#8a919c">Belum ada PO bulan ini</td></tr>`}</tbody></table>

      <div class="section-title">5 PO Outstanding Terbesar</div>
      <table class="data"><thead><tr><th>No. PO</th><th>Nama Barang</th><th>Customer</th><th style="text-align:right">Sisa PO</th></tr></thead>
      <tbody>${s.topOutstanding.length ? s.topOutstanding.map((t) => `<tr><td>${t.noPo ?? "-"}</td><td>${t.namaBarang}</td><td>${t.customerNama ?? "-"}</td><td style="text-align:right">${fmt(t.sisaPo)}</td></tr>`).join("") : `<tr><td colspan="4" style="text-align:center;color:#8a919c">Tidak ada PO outstanding</td></tr>`}</tbody></table>

      <div class="footer">Sistem MTP — Dicetak otomatis ${new Date().toLocaleString("id-ID")}</div>
    </div>
  </body></html>`;

  const buffer = await htmlToPdfBuffer(html);
  return pdfResponse(buffer, `${filename}.pdf`);

  } catch (error) {
    console.error("Error di /api/export/dashboard [GET]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}
