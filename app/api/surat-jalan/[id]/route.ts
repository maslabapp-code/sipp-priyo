import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { suratJalan, suratJalanItems, customers } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  const { id } = await params;
  const [row] = await db
    .select({
      id: suratJalan.id,
      noSj: suratJalan.noSj,
      tanggal: suratJalan.tanggal,
      catatan: suratJalan.catatan,
      customerNama: customers.nama,
      createdAt: suratJalan.createdAt,
    })
    .from(suratJalan)
    .leftJoin(customers, eq(suratJalan.customerId, customers.id))
    .where(eq(suratJalan.id, id))
    .limit(1);

  if (!row) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });

  const items = await db.select().from(suratJalanItems).where(eq(suratJalanItems.suratJalanId, id));
  return NextResponse.json({ ...row, items });

  } catch (error) {
    console.error("Error di /api/[id] [GET]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  const { id } = await params;
  await db.delete(suratJalan).where(eq(suratJalan.id, id));
  return NextResponse.json({ ok: true });

  } catch (error) {
    console.error("Error di /api/[id] [DELETE]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}
