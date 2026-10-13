import { NextRequest, NextResponse } from "next/server";
import { excelResponse } from "@/lib/export-excel";
import { buildInvoiceBuffer } from "@/lib/invoice-excel";
import { INVOICE_GRUP, type InvoiceLine, type InvoiceMeta } from "@/lib/invoice-const";

// Menerima isi invoice yang sudah dicek di layar, mengembalikan file Excel siap cetak.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const m = body.meta ?? {};
    const rawLines: unknown = body.lines;
    if (!m.noInvoice || typeof m.noInvoice !== "string" || !m.noInvoice.trim()) {
      return NextResponse.json({ error: "No. Invoice wajib diisi" }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(m.tanggal ?? ""))) {
      return NextResponse.json({ error: "Tanggal invoice tidak valid" }, { status: 400 });
    }
    if (!Array.isArray(rawLines) || rawLines.length === 0) {
      return NextResponse.json({ error: "Invoice belum punya barang" }, { status: 400 });
    }

    const lines: InvoiceLine[] = [];
    for (const l of rawLines as Record<string, unknown>[]) {
      const qtys = Array.isArray(l.qtys) ? l.qtys.map(Number).filter((n) => Number.isFinite(n)) : [];
      const harga = Number(l.harga);
      if (!INVOICE_GRUP.includes(l.grup as (typeof INVOICE_GRUP)[number]) || typeof l.nama !== "string" || !Number.isFinite(harga) || qtys.length === 0) {
        return NextResponse.json({ error: "Ada baris barang yang datanya tidak valid" }, { status: 400 });
      }
      lines.push({ grup: l.grup as InvoiceLine["grup"], nama: l.nama, qtys, harga });
    }

    const ppn = Number(m.ppnPersen);
    const meta: InvoiceMeta = {
      noInvoice: m.noInvoice.trim(),
      tanggal: m.tanggal,
      noSuratJalan: String(m.noSuratJalan ?? "").trim(),
      noPo: String(m.noPo ?? "").trim(),
      alamat: String(m.alamat ?? ""),
      ppnPersen: Number.isFinite(ppn) && ppn >= 0 ? ppn : 11,
      penandatangan: String(m.penandatangan ?? "").trim(),
    };

    const buf = await buildInvoiceBuffer(meta, lines);
    const nama = `Invoice ${meta.noInvoice}.xlsx`.replace(/[\\/:*?"<>|]/g, "-");
    return excelResponse(buf, nama);
  } catch (error) {
    console.error("Error di /api/invoice/export [POST]:", error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Gagal membuat file invoice di server. Detail: ${detail}` }, { status: 500 });
  }
}
