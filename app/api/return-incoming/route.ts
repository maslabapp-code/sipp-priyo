import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { returnIncoming } from "@/db/schema";
import { asc, eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
  const { searchParams } = new URL(req.url);
  const partId = searchParams.get("partId");
  if (!partId) return NextResponse.json({ error: "partId wajib diisi" }, { status: 400 });

  const rows = await db
    .select()
    .from(returnIncoming)
    .where(eq(returnIncoming.partId, partId))
    .orderBy(asc(returnIncoming.tanggal));
  return NextResponse.json(rows);

  } catch (error) {
    console.error("Error di /api/return-incoming [GET]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
  const body = await req.json();
  const { partId, tanggal, noSj, qty, alasan } = body;
  if (!partId || !tanggal || !noSj) {
    return NextResponse.json({ error: "partId, tanggal, & No. SJ wajib diisi" }, { status: 400 });
  }
  const [row] = await db
    .insert(returnIncoming)
    .values({ partId, tanggal: new Date(tanggal), noSj, qty: String(qty ?? 0), alasan: alasan ?? null })
    .returning();
  return NextResponse.json(row, { status: 201 });

  } catch (error) {
    console.error("Error di /api/return-incoming [POST]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}
