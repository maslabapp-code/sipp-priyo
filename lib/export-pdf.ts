import puppeteer from "puppeteer";

export async function htmlToPdfBuffer(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "10mm", bottom: "12mm", left: "0mm", right: "0mm" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

export function pdfResponse(buffer: Buffer, filename: string) {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

type PdfColumn = { header: string; key: string; align?: "left" | "right" | "center" };

const BASE_STYLE = `
  @page { margin: 0; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; margin: 0; color: #1f2937; font-size: 11px; }
  .header { background: linear-gradient(135deg, #1e4d6b, #163a52); color: white; padding: 18px 32px 14px 32px; }
  .header h1 { margin: 0 0 4px 0; font-size: 18px; }
  .header p { margin: 0; font-size: 10.5px; opacity: 0.85; }
  .content { padding: 16px 32px; }
  table.data { width: 100%; border-collapse: collapse; }
  table.data th { background: #1e4d6b; color: white; text-align: left; padding: 6px 8px; font-size: 10px; }
  table.data td { border: 1px solid #dde1e6; padding: 5px 8px; font-size: 9.8px; }
  table.data tr:nth-child(even) td { background: #f7f8f9; }
  table.data tfoot td { background: #e4edf2; font-weight: bold; }
  .footer { text-align: center; font-size: 8.5px; color: #9aa1ab; margin-top: 14px; padding-top: 6px; border-top: 1px solid #dde1e6; }
  .kpi-grid { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 16px; }
  .kpi-card { border: 1px solid #dde1e6; border-radius: 6px; padding: 10px 14px; width: 22%; }
  .kpi-card .label { font-size: 9px; color: #8a919c; margin-bottom: 4px; }
  .kpi-card .value { font-size: 15px; font-weight: bold; color: #1e4d6b; }
  .section-title { font-size: 13px; font-weight: bold; color: #1e4d6b; border-left: 3px solid #1e4d6b; padding-left: 8px; margin: 16px 0 8px 0; }
`;

export function reportHtml(opts: {
  title: string;
  subtitle?: string;
  columns: PdfColumn[];
  rows: Record<string, unknown>[];
  totalsRow?: Record<string, unknown>;
  generatedAt?: string;
}) {
  const thead = opts.columns
    .map((c) => `<th style="text-align:${c.align ?? "left"}">${c.header}</th>`)
    .join("");
  const tbody = opts.rows
    .map(
      (row) =>
        "<tr>" +
        opts.columns.map((c) => `<td style="text-align:${c.align ?? "left"}">${row[c.key] ?? "-"}</td>`).join("") +
        "</tr>"
    )
    .join("");
  const tfoot = opts.totalsRow
    ? `<tfoot><tr>${opts.columns
        .map((c) => `<td style="text-align:${c.align ?? "left"}">${opts.totalsRow![c.key] ?? ""}</td>`)
        .join("")}</tr></tfoot>`
    : "";

  return `<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"><style>${BASE_STYLE}</style></head>
  <body>
    <div class="header">
      <h1>${opts.title}</h1>
      ${opts.subtitle ? `<p>${opts.subtitle}</p>` : ""}
    </div>
    <div class="content">
      <table class="data">
        <thead><tr>${thead}</tr></thead>
        <tbody>${tbody || `<tr><td colspan="${opts.columns.length}" style="text-align:center;color:#8a919c">Tidak ada data</td></tr>`}</tbody>
        ${tfoot}
      </table>
      <div class="footer">Sistem MTP — Dicetak otomatis ${opts.generatedAt ?? new Date().toLocaleString("id-ID")}</div>
    </div>
  </body></html>`;
}

export { BASE_STYLE };
