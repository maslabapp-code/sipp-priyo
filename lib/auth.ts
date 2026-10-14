// Login sederhana: 1 akun admin, kredensial dari file .env (tidak ada tabel baru di database).
// Sesi = cookie bertanda tangan HMAC-SHA256. Hanya memakai Web Crypto, jadi bisa dipakai di proxy.ts maupun route.

export const SESSION_COOKIE = "sipp_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 hari

const enc = new TextEncoder();

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Kunci penanda sesi. Ikut berubah kalau password diganti, jadi sesi lama otomatis tidak berlaku. */
function signingKeyMaterial(): string | null {
  const secret = process.env.AUTH_SECRET;
  const password = process.env.ADMIN_PASSWORD;
  if (!secret || secret.length < 16 || !password) return null;
  return `${secret}::${password}`;
}

async function hmacHex(message: string, keyMaterial: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(keyMaterial), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
}

/** Perbandingan string dengan waktu tetap (mencegah tebakan lewat selisih waktu). */
function timingSafeEqualStr(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/** True kalau .env sudah berisi ADMIN_USERNAME, ADMIN_PASSWORD, dan AUTH_SECRET (min. 16 karakter). */
export function isAuthConfigured(): boolean {
  return Boolean(process.env.ADMIN_USERNAME && signingKeyMaterial());
}

export async function checkCredentials(username: string, password: string): Promise<boolean> {
  const u = process.env.ADMIN_USERNAME;
  const p = process.env.ADMIN_PASSWORD;
  if (!u || !p) return false;
  // Kedua pengecekan selalu dijalankan supaya waktu respons tidak membocorkan mana yang salah.
  const userOk = timingSafeEqualStr(username.trim().toLowerCase(), u.trim().toLowerCase());
  const passOk = timingSafeEqualStr(password, p);
  return userOk && passOk;
}

export async function createSessionToken(): Promise<string | null> {
  const km = signingKeyMaterial();
  if (!km) return null;
  const exp = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS;
  const sig = await hmacHex(String(exp), km);
  return `${exp}.${sig}`;
}

export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const km = signingKeyMaterial();
  if (!km) return false; // belum dikonfigurasi = semua dianggap belum login
  const [expStr, sig] = token.split(".");
  if (!expStr || !sig || !/^\d+$/.test(expStr)) return false;
  if (Number(expStr) < Math.floor(Date.now() / 1000)) return false;
  const expected = await hmacHex(expStr, km);
  return timingSafeEqualStr(sig, expected);
}
