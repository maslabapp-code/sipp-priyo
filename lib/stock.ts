import { toNumber } from "./calc";

// Stok dihitung dalam SATUAN PRODUKSI, karena itulah yang dicatat saat potong:
//  - kalau kedatangan punya ukuran kedua (pita/lembar) -> stok = jumlah pita/lembar
//  - kalau tidak (mis. coil, atau data lama) -> stok = qty utama (Kg / pcs)
// Kg tetap disimpan untuk cek tagihan CPL dan ditampilkan sebagai perkiraan sisa.
export function stockOf(b: {
  qty: unknown;
  qty2?: unknown;
  satuan?: string | null;
  satuan2?: string | null;
}) {
  const qtyUtama = toNumber(b.qty);
  const q2 = b.qty2 == null ? 0 : toNumber(b.qty2);
  if (q2 > 0) {
    return { qtyStok: q2, satuanStok: b.satuan2 ?? "", qtyKg: qtyUtama, punyaUkuranKedua: true };
  }
  return { qtyStok: qtyUtama, satuanStok: b.satuan ?? "", qtyKg: qtyUtama, punyaUkuranKedua: false };
}

// Perkiraan sisa dalam Kg (sebanding dengan sisa pita/lembar)
export function sisaKgOf(qtyKg: number, qtyStok: number, sisa: number): number | null {
  if (qtyStok <= 0) return null;
  return (qtyKg * sisa) / qtyStok;
}
