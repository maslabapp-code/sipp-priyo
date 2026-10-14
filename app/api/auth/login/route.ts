import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  checkCredentials,
  createSessionToken,
  isAuthConfigured,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

// Pembatas percobaan login (di memori): maks. 5 gagal per IP dalam 15 menit.
const MAX_FAILS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const fails = new Map<string, { count: number; first: number }>();

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

function blockedFor(ip: string): number {
  const rec = fails.get(ip);
  if (!rec) return 0;
  if (Date.now() - rec.first > WINDOW_MS) {
    fails.delete(ip);
    return 0;
  }
  return rec.count >= MAX_FAILS ? Math.ceil((WINDOW_MS - (Date.now() - rec.first)) / 60000) : 0;
}

function registerFail(ip: string) {
  const rec = fails.get(ip);
  if (!rec || Date.now() - rec.first > WINDOW_MS) fails.set(ip, { count: 1, first: Date.now() });
  else rec.count += 1;
}

export async function POST(req: NextRequest) {
  const headers = { "Cache-Control": "no-store" };
  try {
    if (!isAuthConfigured()) {
      return NextResponse.json(
        { error: "Login belum dikonfigurasi. Isi ADMIN_USERNAME, ADMIN_PASSWORD, dan AUTH_SECRET (min. 16 karakter) di file .env lalu restart aplikasi." },
        { status: 500, headers }
      );
    }

    const ip = clientIp(req);
    const wait = blockedFor(ip);
    if (wait > 0) {
      return NextResponse.json(
        { error: `Terlalu banyak percobaan gagal. Coba lagi dalam ${wait} menit.` },
        { status: 429, headers }
      );
    }

    const body = (await req.json().catch(() => null)) as { username?: unknown; password?: unknown } | null;
    const username = typeof body?.username === "string" ? body.username : "";
    const password = typeof body?.password === "string" ? body.password : "";

    const ok = await checkCredentials(username, password);
    if (!ok) {
      registerFail(ip);
      await new Promise((r) => setTimeout(r, 600)); // memperlambat tebak-tebakan
      return NextResponse.json({ error: "Username atau password salah." }, { status: 401, headers });
    }

    fails.delete(ip);
    const token = await createSessionToken();
    if (!token) {
      return NextResponse.json({ error: "Gagal membuat sesi login." }, { status: 500, headers });
    }

    const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
    const res = NextResponse.json({ ok: true }, { headers });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: proto === "https", // aktif otomatis saat diakses lewat HTTPS
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    return res;
  } catch (error) {
    console.error("Error di /api/auth/login [POST]:", error);
    return NextResponse.json({ error: "Terjadi kesalahan saat login." }, { status: 500, headers });
  }
}
