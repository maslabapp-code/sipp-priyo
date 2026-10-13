// Konstanta Invoice yang aman dipakai di browser (tidak mengimpor database).
// Isi mengikuti format invoice Excel yang selama ini dipakai (contoh: Invoice CPL 31 Maret 2026).

export const INVOICE_PERUSAHAAN = {
  nama: "PT.GEMILANG KARYA METAL ABADI",
  baris: [
    "Office & workshop",
    "Pergudangan AKA Bisnis Point Blok C No.12, Jl.Prabukiansantang Gebang Raya, Tangerang",
    "Tlp/Fax (021) 55727566, e-mail: mitragemilangsukses@gmail.com",
  ],
  syaratBayar: "Syarat pembayaran 30 Hari setelah invoice diterima",
  bank: [
    "Pembayaran harap ditransfer ke Rekening",
    "BANK OCBC NISP",
    "Cabang Taman Ratu",
    "A/N PT. GEMILANG KARYA METAL ABADI",
    "NO REK : 526800003406",
  ],
  penandatangan: "Rita Oktavia",
};

export const INVOICE_PPN_DEFAULT = 11; // persen, sesuai invoice yang berjalan

// Urutan kelompok di invoice
export const INVOICE_GRUP = ["Part Jadi", "Part WIP", "Part DNP", "Part Jasa"] as const;
export type InvoiceGrup = (typeof INVOICE_GRUP)[number];

// Alamat awal untuk customer yang namanya cocok (bisa diubah di layar, lalu diingat browser)
export function alamatAwalCustomer(nama: string): string {
  if (/cipta\s*perdana\s*lancar|^cpl\b/i.test(nama)) {
    return ["PT.Cipta Perdana Lancar", "Jl.Prabu Siliwangi KM 0,5", "Komplek PT.UTU Tangerang, Banten", "Telp  : 021- 5907391", "Fax  : 021-5907387", "UP  : Ibu Nurfadilah"].join("\n");
  }
  return nama;
}

export type InvoiceLine = { grup: InvoiceGrup; nama: string; qtys: number[]; harga: number };

export type InvoiceMeta = {
  noInvoice: string;
  tanggal: string; // yyyy-mm-dd
  noSuratJalan: string;
  noPo: string;
  alamat: string; // beberapa baris, baris pertama = nama customer
  ppnPersen: number;
  penandatangan: string;
};

export function grupDariSj(jenis: string, kategori: string | null): InvoiceGrup {
  if ((kategori ?? "").trim().toUpperCase() === "DNP") return "Part DNP";
  if (jenis === "W") return "Part WIP";
  if (jenis === "J") return "Part Jasa";
  return "Part Jadi";
}

export function hitungInvoice(lines: InvoiceLine[], ppnPersen: number) {
  const jumlahQty = lines.reduce((s, l) => s + l.qtys.reduce((a, b) => a + b, 0), 0);
  const jumlah = lines.reduce((s, l) => s + l.qtys.reduce((a, b) => a + b, 0) * l.harga, 0);
  const ppn = Math.round((jumlah * ppnPersen) / 100);
  return { jumlahQty, jumlah, ppn, total: jumlah + ppn };
}
