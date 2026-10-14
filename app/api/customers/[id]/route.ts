import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { and, eq, ne, sql } from "drizzle-orm";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  const { id } = await params;
  const body = await req.json();
  const nama = typeof body.nama === "string" ? body.nama.trim() : "";
  if (!nama) {
    return NextResponse.json({ error: "Nama customer wajib diisi" }, { status: 400 });
  }
  const [dup] = await db
    .select()
    .from(customers)
    .where(and(sql`lower(${customers.nama}) = ${nama.toLowerCase()}`, ne(customers.id, id)));
  if (dup) {
    return NextResponse.json({ error: `Customer "${dup.nama}" sudah ada` }, { status: 409 });
  }
  const [row] = await db
    .update(customers)
    .set({ nama })
    .where(eq(customers.id, id))
    .returning();
  if (!row) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
  return NextResponse.json(row);

  } catch (error) {
    console.error("Error di /api/customers/[id] [PATCH]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  const { id } = await params;
  await db.delete(customers).where(eq(customers.id, id));
  return NextResponse.json({ ok: true });

  } catch (error) {
    console.error("Error di /api/customers/[id] [DELETE]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}
