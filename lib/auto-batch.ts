import { db } from "@/db";
import { rawMaterialBatches, rawMaterialUsages, rawMaterials } from "@/db/schema";
import { asc, eq, inArray } from "drizzle-orm";
import { toNumber } from "./calc";
import { stockOf } from "./stock";

export type BatchSisa = {
  id: string;
  noSj: string | null;
  tanggal: Date;
  sisa: number;
  satuanStok: string;
};

// Sisa tiap kedatangan bahan baku (terlama dulu). `abaikanUsageIds` dipakai saat menghitung ulang
// alokasi sebuah potong: pemakaian milik potong itu sendiri tidak dihitung supaya tidak mengurangi dirinya.
export async function listBatchSisa(rawMaterialId: string, abaikanUsageIds: string[] = []): Promise<BatchSisa[]> {
  const [mat] = await db.select().from(rawMaterials).where(eq(rawMaterials.id, rawMaterialId));
  if (!mat) return [];

  const batches = await db
    .select()
    .from(rawMaterialBatches)
    .where(eq(rawMaterialBatches.rawMaterialId, rawMaterialId))
    .orderBy(asc(rawMaterialBatches.tanggal), asc(rawMaterialBatches.createdAt));
  if (batches.length === 0) return [];

  const ids = batches.map((b) => b.id);
  const skip = new Set(abaikanUsageIds);
  const usages = (
    await db
      .select({ id: rawMaterialUsages.id, batchId: rawMaterialUsages.batchId, qty: rawMaterialUsages.qty })
      .from(rawMaterialUsages)
      .where(inArray(rawMaterialUsages.batchId, ids))
  ).filter((u) => !skip.has(u.id));

  return batches.map((b) => {
    const terpakai = usages.filter((u) => u.batchId === b.id).reduce((s, u) => s + toNumber(u.qty), 0);
    const st = stockOf({ qty: b.qty, qty2: b.qty2, satuan: mat.satuan, satuan2: b.satuan2 });
    return { id: b.id, noSj: b.noSj, tanggal: b.tanggal, sisa: st.qtyStok - terpakai, satuanStok: st.satuanStok };
  });
}

export type Alokasi = { batchId: string; noSj: string | null; qty: number; satuanStok: string };

// Bagi qty potong ke kedatangan-kedatangan: terlama yang masih punya sisa dulu (FIFO).
// Kalau satu kedatangan tidak cukup, sisanya diambil dari kedatangan berikutnya.
// Kalau semua kedatangan sudah habis, kekurangannya dibebankan ke kedatangan terakhir
// (jadi minus dan terlihat ada yang salah), sesuai aturan selisih negatif.
export function bagiKeKedatangan(qty: number, daftar: BatchSisa[]): { alokasi: Alokasi[]; kurang: number } {
  const alokasi: Alokasi[] = [];
  let sisaQty = qty;
  for (const b of daftar) {
    if (sisaQty <= 0) break;
    if (b.sisa <= 0) continue;
    const ambil = Math.min(b.sisa, sisaQty);
    alokasi.push({ batchId: b.id, noSj: b.noSj, qty: ambil, satuanStok: b.satuanStok });
    sisaQty -= ambil;
  }
  let kurang = 0;
  if (sisaQty > 0 && daftar.length > 0) {
    const terakhir = daftar[daftar.length - 1];
    kurang = sisaQty;
    const ada = alokasi.find((a) => a.batchId === terakhir.id);
    if (ada) ada.qty += sisaQty;
    else alokasi.push({ batchId: terakhir.id, noSj: terakhir.noSj, qty: sisaQty, satuanStok: terakhir.satuanStok });
  }
  return { alokasi, kurang };
}

// Kedatangan yang sedang aktif (terlama yang masih punya sisa) untuk ditampilkan di layar Produksi
export async function pickBatch(rawMaterialId: string): Promise<BatchSisa | null> {
  const daftar = await listBatchSisa(rawMaterialId);
  if (daftar.length === 0) return null;
  return daftar.find((b) => b.sisa > 0) ?? daftar[daftar.length - 1];
}

