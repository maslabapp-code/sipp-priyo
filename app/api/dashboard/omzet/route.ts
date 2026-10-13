import { NextResponse } from "next/server";
import { getOmzetData } from "@/lib/dashboard-data";

// Harga jual dan omzet. Tidak dipakai Dashboard umum; disiapkan untuk tampilan Admin saat login dipasang.
export async function GET() {
  try {
    return NextResponse.json(await getOmzetData());
  } catch (error) {
    console.error("Error di /api/dashboard/omzet [GET]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}
