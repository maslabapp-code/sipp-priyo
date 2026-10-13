import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { backupFilePath, deleteBackup } from "@/lib/backup";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
  try {
    const { filename } = await params;
    const filePath = backupFilePath(filename);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "File backup tidak ditemukan" }, { status: 404 });
    }
    const buffer = fs.readFileSync(filePath);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error di /api/backup/[filename] [GET]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
  try {
    const { filename } = await params;
    deleteBackup(filename);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error di /api/backup/[filename] [DELETE]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server, silakan coba lagi." }, { status: 500 });
  }
}
