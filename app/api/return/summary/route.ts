import { NextResponse } from "next/server";
import { db } from "@/db";
import { parts, customers, returnIncoming, returnResolutions } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { toNumber } from "@/lib/calc";

export async function GET() {
  try {
  const partRows = await db
    .select({
      id: parts.id,
      namaBarang: parts.namaBarang,
      kodePart: parts.kodePart,
      customerNama: customers.nama,
    })
    .from(parts)
    .leftJoin(customers, eq(parts.customerId, customers.id))
    .orderBy(desc(parts.createdAt));

  const allIncoming = await db.select().from(returnIncoming);
  const allResolutions = await db.select().from(returnResolutions);

  const result = partRows
    .map((p) => {
      const incoming = allIncoming.filter((i) => i.partId === p.id);
      const resolutions = allResolutions.filter((r) => r.partId === p.id);
      const totalDatang = incoming.reduce((s, i) => s + toNumber(i.qty), 0);
      const totalKirimUlang = resolutions
        .filter((r) => r.jenis === "kirim_ulang")
        .reduce((s, r) => s + toNumber(r.qty), 0);
      const totalSpoilage = resolutions
        .filter((r) => r.jenis === "spoilage")
        .reduce((s, r) => s + toNumber(r.qty), 0);
      return {
        ...p,
        totalDatang,
        totalKirimUlang,
        totalSpoilage,
        sisa: totalDatang - totalKirimUlang - totalSpoilage,
        jumlahCatatan: incoming.length,
      };
    })
    .filter((p) => p.totalDatang > 0); // hanya part yang pernah ada retur

  return NextResponse.json(result);

  } catch (error) {
    console.error("Error di /api/return/summary [GET]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}
