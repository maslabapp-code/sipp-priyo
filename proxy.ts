import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

// Penjaga login untuk SEMUA halaman dan API (Next.js 16: proxy.ts menggantikan middleware.ts).
// Tanpa sesi login yang sah: halaman diarahkan ke /login, API dijawab 401.

function redirectTo(path: string): NextResponse {
  // Lokasi relatif supaya tetap benar di belakang Nginx/HTTPS.
  return new NextResponse(null, { status: 307, headers: { Location: path, "Cache-Control": "no-store" } });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const loggedIn = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);

  const isLoginPage = pathname === "/login";
  const isLoginApi = pathname === "/api/auth/login";

  if (loggedIn) {
    // Sudah login tapi membuka halaman login: kembalikan ke aplikasi.
    if (isLoginPage) return redirectTo("/");
    return NextResponse.next();
  }

  if (isLoginPage || isLoginApi) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Sesi login habis. Silakan login ulang." },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }
  return redirectTo("/login");
}

export const config = {
  // Lewati file statis Next.js dan aset publik.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
