import { db } from "@/db";
import { suratJalan } from "@/db/schema";
import { and, eq, gte, lt } from "drizzle-orm";

export { JENIS_SJ, MAX_ITEM_PER_SJ, isJenisSj } from "./sj-const";

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

// Format sesuai dokumen asli, contoh: 0555P/GKM/SJ/IX/26
export function formatNoSj(seq: number, jenis: string, tanggal: Date): string {
  const yy = String(tanggal.getFullYear()).slice(-2);
  return `${String(seq).padStart(4, "0")}${jenis}/GKM/SJ/${ROMAN[tanggal.getMonth()]}/${yy}`;
}

// Nomor berikutnya: urut per jenis, mulai dari 1 lagi tiap tahun.
export async function nextSjNumber(tanggal: Date, jenis: string): Promise<string> {
  const year = tanggal.getFullYear();
  const rows = await db
    .select({ noSj: suratJalan.noSj })
    .from(suratJalan)
    .where(
      and(
        eq(suratJalan.jenis, jenis),
        gte(suratJalan.tanggal, new Date(year, 0, 1)),
        lt(suratJalan.tanggal, new Date(year + 1, 0, 1))
      )
    );
  let maxSeq = 0;
  for (const r of rows) {
    const seq = parseInt(r.noSj, 10); // angka di depan, contoh "0555P/..." -> 555
    if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
  }
  return formatNoSj(maxSeq + 1, jenis, tanggal);
}
