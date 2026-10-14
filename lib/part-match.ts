import { MASTER_MATERIAL, type MasterMaterialRow } from "./master-material-data";

// Mencocokkan nama part di aplikasi dengan nama part di file master material.
// Nama di kedua sisi sering beda penulisan, jadi hasilnya dibagi dua:
//  - "cocok"     : nama sama (huruf besar/kecil dan tanda baca diabaikan), termasuk pasangan R/L
//  - "disarankan": nama mirip (perlu dicek manusia)

export type MatchType = "cocok" | "disarankan" | "tidak";

function key(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function tokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter(Boolean)
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

// "Hook R/L K45" -> kunci untuk "Hook R K45" dan "Hook L K45"
function sideVariants(nama: string): string[] {
  const m = nama.match(/\b(R\s*\/\s*L|RL|R-L|L\s*\/\s*R|LR)\b/i);
  if (!m || m.index === undefined) return [key(nama)];
  const before = nama.slice(0, m.index);
  const after = nama.slice(m.index + m[0].length);
  return [key(nama), key(before + "R" + after), key(before + "L" + after)];
}

// Urutan prioritas kalau satu nama ada di lebih dari satu tabel master (mis. Bracket Pillion Step B ada di Coilan dan Lembaran)
const PRIORITAS: Record<string, number> = { lembaran: 3, sheet_pita: 2, coil: 1 };

const exactIndex = new Map<string, MasterMaterialRow[]>();
for (const m of MASTER_MATERIAL) {
  for (const k of sideVariants(m.nama)) {
    const list = exactIndex.get(k) ?? [];
    list.push(m);
    exactIndex.set(k, list);
  }
}

const masterTokens = MASTER_MATERIAL.map((m) => ({ m, t: tokens(m.nama) }));

export function suggestMaster(namaPart: string): { master: MasterMaterialRow | null; type: MatchType } {
  const hits = exactIndex.get(key(namaPart));
  if (hits && hits.length > 0) {
    const best = [...hits].sort((a, b) => (PRIORITAS[b.jenis] ?? 0) - (PRIORITAS[a.jenis] ?? 0))[0];
    return { master: best, type: "cocok" };
  }
  const tp = tokens(namaPart);
  let best: MasterMaterialRow | null = null;
  let bestScore = 0;
  for (const { m, t } of masterTokens) {
    const score = jaccard(tp, t);
    if (score > bestScore || (score === bestScore && best && (PRIORITAS[m.jenis] ?? 0) > (PRIORITAS[best.jenis] ?? 0))) {
      best = m;
      bestScore = score;
    }
  }
  if (best && bestScore >= 0.6) return { master: best, type: "disarankan" };
  return { master: null, type: "tidak" };
}
