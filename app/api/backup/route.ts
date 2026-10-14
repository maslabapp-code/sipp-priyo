import { NextResponse } from "next/server";
import { listBackups, runBackup } from "@/lib/backup";

export async function GET() {
  try {
    return NextResponse.json(listBackups());
  } catch (error) {
    console.error("Error di /api/backup [GET]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}

export async function POST() {
  try {
    const result = await runBackup();
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Error di /api/backup [POST]:", error);
    const message = error instanceof Error ? error.message : "Gagal membuat backup.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
