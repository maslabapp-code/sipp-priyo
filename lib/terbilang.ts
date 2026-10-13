// Angka -> kata dalam bahasa Indonesia (aman dipakai di browser maupun server).
const SATUAN = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas"];

function kata(n: number): string {
  if (n < 12) return SATUAN[n];
  if (n < 20) return kata(n - 10) + " belas";
  if (n < 100) return kata(Math.floor(n / 10)) + " puluh" + (n % 10 ? " " + kata(n % 10) : "");
  if (n < 200) return "seratus" + (n % 100 ? " " + kata(n % 100) : "");
  if (n < 1000) return kata(Math.floor(n / 100)) + " ratus" + (n % 100 ? " " + kata(n % 100) : "");
  if (n < 2000) return "seribu" + (n % 1000 ? " " + kata(n % 1000) : "");
  if (n < 1e6) return kata(Math.floor(n / 1000)) + " ribu" + (n % 1000 ? " " + kata(n % 1000) : "");
  if (n < 1e9) return kata(Math.floor(n / 1e6)) + " juta" + (n % 1e6 ? " " + kata(n % 1e6) : "");
  if (n < 1e12) return kata(Math.floor(n / 1e9)) + " milyar" + (n % 1e9 ? " " + kata(n % 1e9) : "");
  return kata(Math.floor(n / 1e12)) + " triliun" + (n % 1e12 ? " " + kata(n % 1e12) : "");
}

/** 2468492604 -> "Dua Milyar Empat Ratus ... Rupiah" */
export function terbilangRupiah(angka: number): string {
  const n = Math.round(Math.abs(angka));
  const teks = n === 0 ? "nol" : kata(n);
  const judul = teks.replace(/\b\w/g, (c) => c.toUpperCase());
  return `${angka < 0 ? "Minus " : ""}${judul} Rupiah`;
}
