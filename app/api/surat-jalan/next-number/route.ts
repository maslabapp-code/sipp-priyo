import { NextRequest, NextResponse } from "next/server";
import { nextSjNumber } from "@/lib/sj-number";
import { isJenisSj } from "@/lib/sj-const";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tanggal = searchParams.get("tanggal") ?? new Date().toISOString().slice(0, 10);
    const jenisParam = searchParams.get("jenis") ?? "P";
    const jenis = isJenisSj(jenisParam) ? jenisParam : "P";
    const noSj = await nextSjNumber(new Date(tanggal), jenis);
    return NextResponse.json({ noSj });
  } catch (error) {
    console.error("Error di /api/surat-jalan/next-number [GET]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}
