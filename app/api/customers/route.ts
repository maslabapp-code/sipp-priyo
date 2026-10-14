import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { desc, sql } from "drizzle-orm";

export async function GET() {
  try {
  const rows = await db.select().from(customers).orderBy(desc(customers.createdAt));
  return NextResponse.json(rows);

  } catch (error) {
    console.error("Error di /api/customers [GET]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
  const body = await req.json();
  if (!body.nama || typeof body.nama !== "string") {
    return NextResponse.json({ error: "Nama customer wajib diisi" }, { status: 400 });
  }
  const nama = body.nama.trim();
  const [dup] = await db.select().from(customers).where(sql`lower(${customers.nama}) = ${nama.toLowerCase()}`);
  if (dup) {
    return NextResponse.json({ error: `Customer "${dup.nama}" sudah ada`, existing: dup }, { status: 409 });
  }
  const [row] = await db.insert(customers).values({ nama }).returning();
  return NextResponse.json(row, { status: 201 });

  } catch (error) {
    console.error("Error di /api/customers [POST]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}
