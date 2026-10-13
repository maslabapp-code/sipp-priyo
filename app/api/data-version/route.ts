import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

// Token perubahan data untuk pembaruan otomatis antar komputer.
// Nilainya = jumlah seluruh baris yang pernah ditambah/diubah/dihapus di semua tabel (statistik bawaan
// PostgreSQL). Setiap ada orang menyimpan, mengubah, atau menghapus data dari komputer mana pun, angkanya
// bertambah. Tidak membaca isi data sama sekali dan tidak menambah apa pun ke database.
export async function GET() {
  try {
    const r = await db.execute(
      sql`select coalesce(sum(n_tup_ins + n_tup_upd + n_tup_del), 0)::text as token from pg_stat_user_tables`
    );
    const token = String((r.rows[0] as { token?: string } | undefined)?.token ?? "0");
    return NextResponse.json({ token }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Error di /api/data-version [GET]:", error);
    return NextResponse.json({ error: "Gagal membaca versi data" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
