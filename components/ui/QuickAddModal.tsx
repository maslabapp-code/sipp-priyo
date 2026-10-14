"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { JENIS_MATERIAL, satuanTagihan } from "@/lib/material-jenis";

// Popup kecil untuk menambah data master langsung dari dropdown (tanpa pindah ke menu master).
// Datanya tersimpan lewat API master yang sama, jadi otomatis muncul juga di menu master-nya.

type Row = { id: string; nama: string; [k: string]: unknown };

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function Shell({
  title,
  hint,
  onClose,
  onSubmit,
  saving,
  error,
  children,
  submitLabel,
}: {
  title: string;
  hint?: string;
  onClose: () => void;
  onSubmit: () => void;
  saving: boolean;
  error: React.ReactNode;
  children: React.ReactNode;
  submitLabel: string;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ background: "rgba(15, 20, 28, 0.5)" }} onMouseDown={onClose}>
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-[420px] rounded-xl overflow-hidden"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="px-5 py-3.5" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="text-[13.5px] font-semibold">{title}</div>
          {hint && <div className="text-[12px]" style={{ color: "var(--text-secondary)" }}>{hint}</div>}
        </div>
        <div className="p-5 flex flex-col gap-3">
          {children}
          {error && <div className="text-[12px] px-3 py-2 rounded-md" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>{error}</div>}
        </div>
        <div className="px-5 py-3 flex justify-end gap-2" style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={onClose} className="h-8 px-3 rounded-md text-[12.5px] cursor-pointer" style={{ border: "1px solid var(--border)" }}>Batal</button>
          <button
            onClick={onSubmit}
            disabled={saving}
            className="h-8 px-4 rounded-md text-[12.5px] font-medium text-white cursor-pointer disabled:opacity-50"
            style={{ background: "var(--accent)" }}
          >
            {saving ? "Menyimpan..." : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: "var(--surface)",
  color: "var(--text-primary)",
  border: "1px solid var(--border)",
};

// Pemeriksaan nama: sudah ada persis -> tawarkan pakai yang ada. Mirip -> tampilkan sebagai peringatan.
function useNameCheck(nama: string, existing: Row[]) {
  return useMemo(() => {
    const q = nama.trim();
    const n = norm(q);
    const persis = q ? existing.find((e) => e.nama.trim().toLowerCase() === q.toLowerCase()) : undefined;
    const mirip =
      n.length >= 3
        ? existing.filter((e) => e.id !== persis?.id && (norm(e.nama).includes(n) || n.includes(norm(e.nama)))).slice(0, 4)
        : [];
    return { persis, mirip };
  }, [nama, existing]);
}

function NameField({
  label,
  nama,
  setNama,
  check,
  onUse,
  placeholder,
  onEnter,
}: {
  label: string;
  nama: string;
  setNama: (v: string) => void;
  check: { persis?: Row; mirip: Row[] };
  onUse: (r: Row) => void;
  placeholder?: string;
  onEnter: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  return (
    <div>
      <label className="text-[11.5px] mb-1 block" style={{ color: "var(--text-secondary)" }}>{label}</label>
      <input
        ref={ref}
        value={nama}
        onChange={(e) => setNama(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onEnter();
          }
        }}
        placeholder={placeholder}
        className="w-full h-9 px-2.5 rounded-md text-[13px]"
        style={inputStyle}
      />
      {check.persis && (
        <div className="mt-1.5 text-[12px]" style={{ color: "var(--danger)" }}>
          Sudah ada: <b>{check.persis.nama}</b>.{" "}
          <button onClick={() => onUse(check.persis as Row)} className="underline cursor-pointer" style={{ color: "var(--accent)" }}>
            Pakai yang sudah ada
          </button>
        </div>
      )}
      {!check.persis && check.mirip.length > 0 && (
        <div className="mt-1.5 text-[12px]" style={{ color: "var(--warn)" }}>
          Mirip yang sudah ada:{" "}
          {check.mirip.map((m, i) => (
            <span key={m.id}>
              {i > 0 && ", "}
              <button onClick={() => onUse(m)} className="underline cursor-pointer" style={{ color: "var(--accent)" }}>{m.nama}</button>
            </span>
          ))}
          . Pastikan bukan data yang sama.
        </div>
      )}
    </div>
  );
}

async function kirim(url: string, body: unknown): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export function QuickAddCustomer({
  initialName,
  existing,
  onCreated,
  onClose,
}: {
  initialName: string;
  existing: Row[];
  onCreated: (row: Row) => void;
  onClose: () => void;
}) {
  const [nama, setNama] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const check = useNameCheck(nama, existing);

  async function submit() {
    setError("");
    if (!nama.trim()) return setError("Nama customer wajib diisi.");
    if (check.persis) return setError("Nama ini sudah ada. Pilih \"Pakai yang sudah ada\".");
    setSaving(true);
    const r = await kirim("/api/customers", { nama: nama.trim() });
    setSaving(false);
    if (r.ok) onCreated(r.data as Row);
    else if (r.status === 409 && r.data.existing) onCreated(r.data.existing as Row);
    else setError((r.data.error as string) || "Gagal menyimpan customer.");
  }

  return (
    <Shell title="Tambah Customer Baru" hint="Tersimpan juga di menu Master Customer." onClose={onClose} onSubmit={submit} saving={saving} error={error} submitLabel="Simpan dan pakai">
      <NameField label="Nama customer" nama={nama} setNama={setNama} check={check} onUse={onCreated} onEnter={submit} />
    </Shell>
  );
}

const BENTUK_NAMA: Record<string, string> = {
  coil: "Coil",
  lembaran: "Lembar",
  sheet_pita: "Pita",
  as_kawat: "Batang",
  wiremesh: "Roll",
  wip: "WIP",
  nut_square: "Nut",
};

export function QuickAddMaterial({
  initialName,
  existing,
  onCreated,
  onClose,
}: {
  initialName: string;
  existing: Row[];
  onCreated: (row: Row) => void;
  onClose: () => void;
}) {
  // Bahan baku ditentukan oleh spesifikasi + ukuran + bentuk. Nama dibuat otomatis dari ketiganya,
  // tetapi bisa diubah kalau perlu (mis. nut atau barang yang tidak punya ukuran tebal x lebar).
  const [grade, setGrade] = useState("");
  const [ukuran, setUkuran] = useState("");
  const [jenis, setJenis] = useState("lembaran");
  const [nama, setNama] = useState(initialName);
  const [namaManual, setNamaManual] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const check = useNameCheck(nama, existing);

  function susunNama(g: string, u: string, j: string) {
    const bagian = [g.trim().toUpperCase(), u.trim().replace(/,/g, ".").replace(/\s*[xX]\s*/g, " x ")].filter(Boolean).join(" ");
    return bagian ? `${bagian} (${BENTUK_NAMA[j] ?? ""})`.replace(" ()", "") : "";
  }
  function ubah(g: string, u: string, j: string) {
    setGrade(g);
    setUkuran(u);
    setJenis(j);
    const baru = susunNama(g, u, j);
    if (!namaManual && baru) setNama(baru);
  }

  async function submit() {
    setError("");
    if (!nama.trim()) return setError("Isi spesifikasi dan ukuran, atau tulis nama bahan baku.");
    if (check.persis) return setError("Nama ini sudah ada. Pilih \"Pakai yang sudah ada\".");
    setSaving(true);
    const r = await kirim("/api/raw-materials", { nama: nama.trim(), jenis, grade: grade.trim().toUpperCase(), ukuran: ukuran.trim().replace(/,/g, ".").replace(/\s*[xX]\s*/g, " x ") });
    setSaving(false);
    if (r.ok) onCreated(r.data as Row);
    else if (r.status === 409 && r.data.existing) onCreated(r.data.existing as Row);
    else setError((r.data.error as string) || "Gagal menyimpan bahan baku.");
  }

  return (
    <Shell title="Tambah Bahan Baku Baru" hint="Bahan baku ditentukan oleh spesifikasi dan ukuran. Tersimpan juga di Master Bahan Baku." onClose={onClose} onSubmit={submit} saving={saving} error={error} submitLabel="Simpan dan pakai">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11.5px] mb-1 block" style={{ color: "var(--text-secondary)" }}>Spesifikasi</label>
          <input value={grade} onChange={(e) => ubah(e.target.value, ukuran, jenis)} placeholder="mis. SPCC SD" className="w-full h-9 px-2.5 rounded-md text-[13px]" style={inputStyle} />
        </div>
        <div>
          <label className="text-[11.5px] mb-1 block" style={{ color: "var(--text-secondary)" }}>Ukuran (tebal x lebar)</label>
          <input value={ukuran} onChange={(e) => ubah(grade, e.target.value, jenis)} placeholder="mis. 1.6 x 113" className="w-full h-9 px-2.5 rounded-md text-[13px]" style={inputStyle} />
        </div>
      </div>
      <div>
        <label className="text-[11.5px] mb-1 block" style={{ color: "var(--text-secondary)" }}>Jenis material</label>
        <select value={jenis} onChange={(e) => ubah(grade, ukuran, e.target.value)} className="w-full h-9 px-2 rounded-md text-[13px]" style={inputStyle}>
          {JENIS_MATERIAL.map((j) => (
            <option key={j.value} value={j.value}>{j.label}</option>
          ))}
        </select>
        <div className="mt-1 text-[11.5px]" style={{ color: "var(--text-muted)" }}>Ditagih dalam {satuanTagihan(jenis)}.</div>
      </div>
      <NameField
        label="Nama bahan baku"
        nama={nama}
        setNama={(v) => {
          setNama(v);
          setNamaManual(true);
        }}
        check={check}
        onUse={onCreated}
        placeholder="terisi otomatis dari spesifikasi + ukuran"
        onEnter={submit}
      />
    </Shell>
  );
}

export function QuickAddKategori({
  initialName,
  existing,
  onCreated,
  onClose,
}: {
  initialName: string;
  existing: Row[];
  onCreated: (row: Row) => void;
  onClose: () => void;
}) {
  const [nama, setNama] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const check = useNameCheck(nama, existing);

  async function submit() {
    setError("");
    if (!nama.trim()) return setError("Nama kategori wajib diisi.");
    if (check.persis) return setError("Nama ini sudah ada. Pilih \"Pakai yang sudah ada\".");
    setSaving(true);
    const r = await kirim("/api/part-categories", { nama: nama.trim() });
    setSaving(false);
    if (r.ok) onCreated({ id: (r.data.id as string) ?? nama.trim(), nama: (r.data.nama as string) ?? nama.trim() });
    else setError((r.data.error as string) || "Gagal menyimpan kategori.");
  }

  return (
    <Shell title="Tambah Kategori / Proses Baru" hint="Tersimpan juga di daftar kategori Master Part." onClose={onClose} onSubmit={submit} saving={saving} error={error} submitLabel="Simpan dan pakai">
      <NameField label="Nama kategori / proses" nama={nama} setNama={setNama} check={check} onUse={onCreated} onEnter={submit} />
    </Shell>
  );
}
