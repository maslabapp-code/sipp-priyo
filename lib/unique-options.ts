/** Ambil daftar nilai unik dari kolom tertentu di sebuah tabel, untuk dipakai sebagai opsi Searchable Select filter. */
export function uniqueOptions<T>(
  rows: T[],
  getter: (row: T) => string | null | undefined
): { value: string; label: string }[] {
  const set = new Set<string>();
  for (const r of rows) {
    const v = getter(r);
    if (v) set.add(v);
  }
  return Array.from(set)
    .sort((a, b) => a.localeCompare(b))
    .map((v) => ({ value: v, label: v }));
}
