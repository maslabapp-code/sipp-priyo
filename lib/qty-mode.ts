// Cara mengisi qty di SJ Masuk / Stok Awal mengikuti jenis bahan baku:
//  - lembaran     -> ketik JUMLAH LEMBAR (Kg tagihan boleh diisi, tidak wajib)
//  - sheet_pita   -> ketik JUMLAH PITA   (Kg tagihan boleh diisi, tidak wajib)
//  - coil, as/kawat -> ketik Kg
//  - wip, nut, wiremesh -> ketik pcs
export type QtyMode = "lembar" | "pita" | "kg" | "pcs";

export function modeOf(jenis: string | null | undefined): QtyMode {
  if (jenis === "lembaran") return "lembar";
  if (jenis === "sheet_pita") return "pita";
  if (jenis === "wip" || jenis === "nut_square" || jenis === "wiremesh") return "pcs";
  return "kg";
}

export const MODE_LABEL: Record<QtyMode, string> = {
  lembar: "Jumlah lembar",
  pita: "Jumlah pita",
  kg: "Qty (Kg)",
  pcs: "Qty (pcs)",
};

export type PartPakai = { namaBarang: string; konversiPcs: string | null; satuanPotong: string | null };

// Perkiraan total pcs dari qty yang diketik. Konversi (pcs per lembar / pita / kg) ada di Master Part,
// karena bahan baku yang sama bisa dipakai part dengan panjang berbeda. Jadi hasilnya per part.
export function estimasiPcs(qtyUtama: number, parts: PartPakai[]): { pcs: number; nama: string }[] {
  if (!(qtyUtama > 0)) return [];
  return parts
    .map((p) => ({ k: Number(p.konversiPcs), nama: p.namaBarang }))
    .filter((p) => p.k > 0)
    .map((p) => ({ pcs: qtyUtama * p.k, nama: p.nama }));
}
