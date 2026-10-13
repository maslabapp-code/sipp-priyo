// Konstanta SJ yang aman dipakai di sisi browser (tidak mengimpor database).

// Jenis SJ keluar: P = produksi, J = jasa, W = WIP (masing-masing punya urutan nomor sendiri)
export const JENIS_SJ = [
  { value: "P", label: "P – Produksi" },
  { value: "J", label: "J – Jasa" },
  { value: "W", label: "W – WIP" },
] as const;

// Satu lembar SJ maksimal 13 baris (sesuai formulir cetak dokumen asli)
export const MAX_ITEM_PER_SJ = 13;

export function isJenisSj(v: unknown): v is "P" | "J" | "W" {
  return v === "P" || v === "J" || v === "W";
}
