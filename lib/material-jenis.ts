// Jenis material yang masuk dari customer + satuan tagihannya.
// Tagihan CPL dicek dalam KG; nut square, wiremesh, dan WIP dalam pcs.
export const JENIS_MATERIAL = [
  { value: "lembaran", label: "Lembaran", satuan: "Kg" },
  { value: "coil", label: "Coil", satuan: "Kg" },
  { value: "sheet_pita", label: "Sheet / Pitaan", satuan: "Kg" },
  { value: "as_kawat", label: "As / Kawat", satuan: "Kg" },
  { value: "wip", label: "WIP (setengah jadi)", satuan: "pcs" },
  { value: "nut_square", label: "Nut Square", satuan: "pcs" },
  { value: "wiremesh", label: "Wiremesh", satuan: "pcs" },
] as const;

export type JenisMaterial = (typeof JENIS_MATERIAL)[number]["value"];

export function isJenisMaterial(v: unknown): v is JenisMaterial {
  return JENIS_MATERIAL.some((j) => j.value === v);
}

export function satuanTagihan(jenis: string | null | undefined): string {
  return JENIS_MATERIAL.find((j) => j.value === jenis)?.satuan ?? "Kg";
}

export function labelJenis(jenis: string | null | undefined): string {
  return JENIS_MATERIAL.find((j) => j.value === jenis)?.label ?? "Lembaran";
}
