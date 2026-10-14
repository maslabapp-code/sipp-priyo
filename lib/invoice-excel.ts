import ExcelJS from "exceljs";
import { INVOICE_GRUP, INVOICE_PERUSAHAAN, hitungInvoice, type InvoiceLine, type InvoiceMeta } from "./invoice-const";
import { terbilangRupiah } from "./terbilang";

const RP = '_([$Rp-421]* #,##0_);_([$Rp-421]* \\(#,##0\\);_([$Rp-421]* \\-_);_(@_)';
const thin = { style: "thin" as const };
const box = { top: thin, bottom: thin, left: thin, right: thin };

function tanggalIndo(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const bulan = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  return `${d} ${bulan[(m || 1) - 1]} ${y}`;
}

// Membuat file Excel invoice dengan susunan yang sama dengan invoice lama:
// kelompok Part Jadi / WIP / DNP / Jasa, qty per baris berupa penjumlahan per SJ (=400+400),
// Total = Qty x Harga, lalu Jumlah, PPN, Jumlah Total, terbilang, dan info rekening.
export async function buildInvoiceBuffer(meta: InvoiceMeta, lines: InvoiceLine[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sistem MTP";
  const ws = wb.addWorksheet("Invoice", { pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  ws.columns = [{ width: 5 }, { width: 44 }, { width: 13 }, { width: 16 }, { width: 28 }];
  const font = (o: Partial<ExcelJS.Font> = {}): Partial<ExcelJS.Font> => ({ name: "Arial", size: 10, ...o });

  const P = INVOICE_PERUSAHAAN;
  ws.mergeCells("A1:E2");
  ws.getCell("A1").value = P.nama;
  ws.getCell("A1").font = font({ size: 16, bold: true });
  ws.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  P.baris.forEach((t, i) => {
    const r = 3 + i;
    ws.mergeCells(`A${r}:E${r}`);
    ws.getCell(`A${r}`).value = t;
    ws.getCell(`A${r}`).font = font({ size: i === 0 ? 11 : 9, bold: i === 0 });
    ws.getCell(`A${r}`).alignment = { horizontal: "center" };
  });
  ws.mergeCells("A6:E6");
  ws.getCell("A6").value = "INVOICE";
  ws.getCell("A6").font = font({ size: 16, bold: true });
  ws.getCell("A6").alignment = { horizontal: "center" };
  for (let c = 1; c <= 5; c++) ws.getCell(6, c).border = { top: thin, bottom: thin };

  // Blok penerima (kiri) dan data invoice (kanan)
  ws.getCell("A8").value = "Kepada Yth, ";
  ws.getCell("A8").font = font();
  const alamat = meta.alamat.split("\n").map((s) => s.trimEnd()).filter((s) => s.trim() !== "");
  alamat.forEach((t, i) => {
    const r = 9 + i;
    ws.mergeCells(`A${r}:C${r}`);
    ws.getCell(`A${r}`).value = t;
    ws.getCell(`A${r}`).font = font({ bold: i === 0 });
  });
  const info: [string, string][] = [
    ["Tanggal", `: ${tanggalIndo(meta.tanggal)}`],
    ["Invoice  No", `: ${meta.noInvoice}`],
    ["No Surat Jalan", `: ${meta.noSuratJalan || "-"}`],
    ["No PO", `: ${meta.noPo || "-"}`],
  ];
  info.forEach(([a, b], i) => {
    const r = 8 + i;
    ws.getCell(`D${r}`).value = a;
    ws.getCell(`E${r}`).value = b;
    ws.getCell(`D${r}`).font = font();
    ws.getCell(`E${r}`).font = font();
  });

  // Tabel barang
  const HEAD = 16;
  ["No", "Nama Barang", "Qty / Kg", "Harga/Pcs", "Total"].forEach((t, i) => {
    const c = ws.getCell(HEAD, i + 1);
    c.value = t;
    c.font = font({ bold: true });
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.border = box;
  });

  let row = HEAD + 1;
  let no = 1;
  const first = row;
  for (const grup of INVOICE_GRUP) {
    const isi = lines
      .filter((l) => l.grup === grup && l.qtys.length > 0)
      .sort((a, b) => a.nama.localeCompare(b.nama, "id", { sensitivity: "base" }));
    if (isi.length === 0) continue;
    ws.getCell(row, 2).value = grup;
    ws.getCell(row, 2).font = font({ bold: true });
    row++;
    for (const l of isi) {
      const total = l.qtys.reduce((a, b) => a + b, 0);
      ws.getCell(row, 1).value = no++;
      ws.getCell(row, 2).value = l.nama;
      ws.getCell(row, 3).value = { formula: l.qtys.join("+"), result: total };
      ws.getCell(row, 4).value = l.harga;
      ws.getCell(row, 5).value = { formula: `C${row}*D${row}`, result: total * l.harga };
      ws.getCell(row, 3).numFmt = "#,##0";
      ws.getCell(row, 4).numFmt = RP;
      ws.getCell(row, 5).numFmt = RP;
      for (let c = 1; c <= 5; c++) ws.getCell(row, c).font = font();
      ws.getCell(row, 1).alignment = { horizontal: "center" };
      ws.getCell(row, 3).alignment = { horizontal: "center" };
      row++;
    }
  }
  const last = row - 1;

  const hasil = hitungInvoice(lines, meta.ppnPersen);
  const lblRow = row;
  for (let r = lblRow; r <= lblRow + 4; r++) for (let c = 1; c <= 5; c++) ws.getCell(r, c).font = font();
  ws.mergeCells(`A${lblRow}:B${lblRow}`);
  ws.getCell(`A${lblRow}`).value = "Terbilang :";
  ws.getCell(`C${lblRow}`).value = { formula: `SUM(C${first}:C${last})`, result: hasil.jumlahQty };
  ws.getCell(`C${lblRow}`).numFmt = "#,##0";
  ws.getCell(`C${lblRow}`).alignment = { horizontal: "center" };
  ws.getCell(`D${lblRow}`).value = "Jumlah";
  ws.getCell(`E${lblRow}`).value = { formula: `SUM(E${first}:E${last})`, result: hasil.jumlah };
  ws.getCell(`E${lblRow}`).numFmt = RP;

  ws.mergeCells(`A${lblRow + 1}:C${lblRow + 4}`);
  ws.getCell(`A${lblRow + 1}`).value = `# ${terbilangRupiah(hasil.total)} #`;
  ws.getCell(`A${lblRow + 1}`).alignment = { wrapText: true, vertical: "top", horizontal: "left" };
  ws.getCell(`A${lblRow + 1}`).font = font({ italic: true, bold: true });

  ws.mergeCells(`D${lblRow + 1}:D${lblRow + 2}`);
  ws.getCell(`D${lblRow + 1}`).value = `PPN ${meta.ppnPersen}%`;
  ws.mergeCells(`E${lblRow + 1}:E${lblRow + 2}`);
  ws.getCell(`E${lblRow + 1}`).value = { formula: `ROUND(E${lblRow}*${meta.ppnPersen}/100,0)`, result: hasil.ppn };
  ws.getCell(`E${lblRow + 1}`).numFmt = RP;
  ws.mergeCells(`D${lblRow + 3}:D${lblRow + 4}`);
  ws.getCell(`D${lblRow + 3}`).value = "Jumlah Total";
  ws.mergeCells(`E${lblRow + 3}:E${lblRow + 4}`);
  ws.getCell(`E${lblRow + 3}`).value = { formula: `E${lblRow}+E${lblRow + 1}`, result: hasil.total };
  ws.getCell(`E${lblRow + 3}`).numFmt = RP;
  ws.getCell(`E${lblRow + 3}`).font = font({ bold: true });

  for (let r = lblRow; r <= lblRow + 4; r++) {
    for (let c = 1; c <= 5; c++) {
      const cell = ws.getCell(r, c);
      cell.border = box;
    }
    ws.getCell(r, 5).alignment = { horizontal: "left", vertical: "middle" };
    ws.getCell(r, 4).alignment = { vertical: "middle" };
  }

  // Tanda tangan, syarat bayar, rekening
  let f = lblRow + 6;
  ws.getCell(`A${f}`).value = P.nama;
  ws.getCell(`A${f}`).font = font();
  ws.getCell(`D${f}`).value = P.syaratBayar;
  ws.getCell(`D${f}`).font = font({ size: 9 });
  P.bank.forEach((t, i) => {
    ws.getCell(`D${f + 1 + i}`).value = t;
    ws.getCell(`D${f + 1 + i}`).font = font({ size: 9, bold: i === 1 });
  });
  ws.getCell(`A${f + 6}`).value = meta.penandatangan;
  ws.getCell(`A${f + 6}`).font = font({ bold: true, underline: true });

  ws.pageSetup.margins = { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 };

  return Buffer.from(await wb.xlsx.writeBuffer());
}
