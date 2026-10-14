// Semua rumus turunan mengikuti pola dari file Excel MTP lama:
// - Total PO       = PO CPL 1 + PO CPL 2 + PO CPL 3   (PO Act hanya catatan/referensi)
// - Kirim          = jumlah semua qty_kirim harian dalam bulan itu
// - Sisa PO        = Total PO - Kirim
// - Actual Penjualan = Kirim x Harga Jual
// - PPN 10%        = Actual Penjualan x 10%
// - Total Penjualan  = Total PO x Harga Jual

export type MonthlyTransactionRow = {
  stock: number;
  poAct: number;
  poCpl1: number;
  poCpl2: number;
  poCpl3: number;
  hargaJual: number;
  kirim: number; // sudah dijumlah dari daily deliveries
};

export function computeDerived(row: MonthlyTransactionRow) {
  const totalPo = row.poCpl1 + row.poCpl2 + row.poCpl3;
  const sisaPo = totalPo - row.kirim;
  const actualPenjualan = row.kirim * row.hargaJual;
  const ppn10 = actualPenjualan * 0.1;
  const totalPenjualan = totalPo * row.hargaJual;

  return {
    totalPo,
    sisaPo,
    actualPenjualan,
    ppn10,
    totalPenjualan,
  };
}

export function toNumber(val: unknown): number {
  if (val === null || val === undefined) return 0;
  const n = typeof val === "string" ? parseFloat(val) : Number(val);
  return Number.isFinite(n) ? n : 0;
}

// Total pcs hasil satu kali potong = qty x konversi x konversi2
// (konversi2 dipakai untuk kasus 2 tingkat konversi, misal MESH: Pita x Lembar. Default 1 kalau tidak dipakai.)
export function computeCutTotal(qty: number, konversi: number, konversi2: number) {
  return qty * konversi * konversi2;
}
