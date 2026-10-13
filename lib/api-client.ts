/**
 * Ambil JSON dari API dengan aman.
 * - Kalau koneksi putus / server tidak merespons: pesan jelas, bukan crash.
 * - Kalau body kosong/rusak (misal server sempat reload di tengah request): pesan jelas.
 * - Kalau server balas error (status bukan 2xx) tapi ada { error: "..." }: pesan itu yang ditampilkan.
 */
export async function fetchJson<T = unknown>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch {
    throw new Error("Tidak bisa terhubung ke server. Cek apakah aplikasinya masih jalan, lalu coba lagi.");
  }

  const text = await res.text();
  let body: unknown = undefined;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      // respons bukan JSON valid, body dibiarkan undefined
    }
  }

  if (!res.ok) {
    const message =
      body && typeof body === "object" && "error" in (body as Record<string, unknown>) &&
      typeof (body as Record<string, unknown>).error === "string"
        ? ((body as Record<string, unknown>).error as string)
        : `Server merespons dengan error (kode ${res.status}). Coba lagi.`;
    throw new Error(message);
  }

  if (text && body === undefined) {
    throw new Error("Respons dari server tidak valid. Coba lagi — kalau masih terjadi, restart aplikasinya.");
  }

  return body as T;
}
