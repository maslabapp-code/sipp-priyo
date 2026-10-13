import ExcelJS from "exceljs";

export type ExcelColumn = {
  header: string;
  key: string;
  width?: number;
  format?: string; // numFmt, misal '#,##0' atau '"Rp"#,##0'
  align?: "left" | "right" | "center";
};

const TEAL = "FF1E4D6B";
const LIGHT = "FFEEF1F3";

export async function buildExcelBuffer(opts: {
  title: string;
  subtitle?: string;
  columns: ExcelColumn[];
  rows: Record<string, unknown>[];
  totalsRow?: Record<string, unknown>;
  sheetName?: string;
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sistem MTP";
  wb.created = new Date();
  const ws = wb.addWorksheet(opts.sheetName ?? "Data");

  const colCount = opts.columns.length;

  ws.mergeCells(1, 1, 1, colCount);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = opts.title;
  titleCell.font = { bold: true, size: 14, color: { argb: TEAL } };

  let headerRowIdx = 3;
  if (opts.subtitle) {
    ws.mergeCells(2, 1, 2, colCount);
    const subCell = ws.getCell(2, 1);
    subCell.value = opts.subtitle;
    subCell.font = { italic: true, size: 10, color: { argb: "FF5B6472" } };
    headerRowIdx = 4;
  }

  ws.columns = opts.columns.map((c) => ({ key: c.key, width: c.width ?? 18 }));

  const headerRow = ws.getRow(headerRowIdx);
  opts.columns.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
  });
  headerRow.height = 20;

  opts.rows.forEach((row, idx) => {
    const r = ws.getRow(headerRowIdx + 1 + idx);
    opts.columns.forEach((c, i) => {
      const cell = r.getCell(i + 1);
      cell.value = (row[c.key] as ExcelJS.CellValue) ?? "";
      if (c.format) cell.numFmt = c.format;
      if (c.align) cell.alignment = { horizontal: c.align };
      cell.border = { top: { style: "thin", color: { argb: "FFDDE1E6" } }, bottom: { style: "thin", color: { argb: "FFDDE1E6" } }, left: { style: "thin", color: { argb: "FFDDE1E6" } }, right: { style: "thin", color: { argb: "FFDDE1E6" } } };
      if (idx % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7F8F9" } };
    });
  });

  if (opts.totalsRow) {
    const r = ws.getRow(headerRowIdx + 1 + opts.rows.length);
    opts.columns.forEach((c, i) => {
      const cell = r.getCell(i + 1);
      cell.value = (opts.totalsRow![c.key] as ExcelJS.CellValue) ?? "";
      cell.font = { bold: true };
      if (c.format) cell.numFmt = c.format;
      if (c.align) cell.alignment = { horizontal: c.align };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT } };
      cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
    });
  }

  ws.autoFilter = { from: { row: headerRowIdx, column: 1 }, to: { row: headerRowIdx, column: colCount } };
  ws.views = [{ state: "frozen", ySplit: headerRowIdx }];

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export function excelResponse(buffer: Buffer, filename: string) {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
