import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { returnResolutions } from "@/db/schema";
import { asc, eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
  const { searchParams } = new URL(req.url);
  const partId = searchParams.get("partId");
  if (!partId) return NextResponse.json({ error: "partId wajib diisi" }, { status: 400 });

  const rows = await db
    .select()
    .from(returnResolutions)
    .where(eq(returnResolutions.partId, partId))
    .orderBy(asc(returnResolutions.tanggal));
  return NextResponse.json(rows);

  } catch (error) {
    console.error("Error di /api/return-resolutions [GET]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
  const body = await req.json();
  const { partId, tanggal, jenis, qty } = body;
  if (!partId || !tanggal || !jenis) {
    return NextResponse.json({ error: "partId, tanggal, & jenis wajib diisi" }, { status: 400 });
  }
  if (jenis !== "kirim_ulang" && jenis !== "spoilage") {
    return NextResponse.json({ error: "jenis harus 'kirim_ulang' atau 'spoilage'" }, { status: 400 });
  }
  const [row] = await db
    .insert(returnResolutions)
    .values({ partId, tanggal: new Date(tanggal), jenis, qty: String(qty ?? 0) })
    .returning();
  return NextResponse.json(row, { status: 201 });

  } catch (error) {
    console.error("Error di /api/return-resolutions [POST]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}
