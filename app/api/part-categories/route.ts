import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { partCategories } from "@/db/schema";
import { asc } from "drizzle-orm";

export async function GET() {
  try {
  const rows = await db.select().from(partCategories).orderBy(asc(partCategories.nama));
  return NextResponse.json(rows);

  } catch (error) {
    console.error("Error di /api/part-categories [GET]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
  const body = await req.json();
  if (!body.nama || typeof body.nama !== "string") {
    return NextResponse.json({ error: "Nama kategori wajib diisi" }, { status: 400 });
  }
  const [row] = await db
    .insert(partCategories)
    .values({ nama: body.nama.trim() })
    .onConflictDoNothing()
    .returning();
  return NextResponse.json(row ?? { nama: body.nama.trim() }, { status: 201 });

  } catch (error) {
    console.error("Error di /api/part-categories [POST]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}
