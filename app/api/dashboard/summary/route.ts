import { NextResponse } from "next/server";
import { getDashboardData } from "@/lib/dashboard-data";

// Tampilan umum Dashboard: persentase delivery dan grafik bulanan. Tanpa harga jual dan omzet.
export async function GET() {
  try {
    return NextResponse.json(await getDashboardData());
  } catch (error) {
    console.error("Error di /api/dashboard/summary [GET]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}
