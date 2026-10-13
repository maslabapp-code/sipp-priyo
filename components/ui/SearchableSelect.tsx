"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type SearchableOption = { value: string; label: string; sublabel?: string };

type Props = {
  options: SearchableOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Tampilan compact untuk dipakai di dalam sel tabel. */
  size?: "sm" | "md";
  /**
   * Kalau diisi, di bagian bawah daftar muncul opsi "+ Tambah ..." untuk membuat data baru langsung dari dropdown
   * (tanpa pindah ke menu master). Menerima teks yang sedang diketik di kotak pencarian.
   */
  onCreate?: (teks: string) => void;
  /** Nama jenis data untuk teks opsi tambah, mis. "customer" atau "bahan baku". */
  createLabel?: string;
};

/**
 * Dropdown dengan kotak pencarian di dalamnya — dipakai untuk memilih dari data master
 * (Part, Customer, Bahan Baku, dst) yang jumlahnya bisa banyak, supaya tidak perlu
 * scroll panjang di <select> biasa.
 */
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Pilih...",
  disabled = false,
  className = "",
  size = "md",
  onCreate,
  createLabel = "data",
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Posisi daftar dihitung dari tombol dan digambar di lapisan paling atas halaman (portal),
  // supaya tidak terpotong oleh card atau tabel yang memakai overflow-hidden/auto.
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number; width: number; maxH: number } | null>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || (o.sublabel ?? "").toLowerCase().includes(q)
    );
  }, [options, query]);

  // Opsi tambah baru muncul kalau teks yang diketik belum persis sama dengan data yang ada
  const q = query.trim();
  const sudahAda = q !== "" && options.some((o) => o.label.trim().toLowerCase() === q.toLowerCase());
  const showCreate = !!onCreate && !sudahAda;
  const jumlahBaris = filtered.length + (showCreate ? 1 : 0);

  function createNew() {
    const teks = query.trim();
    setOpen(false);
    setQuery("");
    onCreate?.(teks);
  }

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      const t = e.target as Node;
      const didalamTombol = rootRef.current?.contains(t);
      const didalamDaftar = listRef.current?.contains(t);
      if (!didalamTombol && !didalamDaftar) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  // Hitung posisi daftar: di bawah tombol, atau di atasnya kalau ruang di bawah kurang
  useLayoutEffect(() => {
    if (!open) return;
    function hitung() {
      const el = rootRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const ruangBawah = vh - r.bottom - 8;
      const ruangAtas = r.top - 8;
      const butuh = 260;
      const lebar = Math.max(r.width, 200);
      const left = Math.min(Math.max(8, r.left), Math.max(8, window.innerWidth - lebar - 8));
      if (ruangBawah >= butuh || ruangBawah >= ruangAtas) {
        setPos({ left, top: r.bottom + 4, width: r.width, maxH: Math.max(140, Math.min(ruangBawah, 340)) });
      } else {
        setPos({ left, bottom: vh - r.top + 4, width: r.width, maxH: Math.max(140, Math.min(ruangAtas, 340)) });
      }
    }
    hitung();
    window.addEventListener("resize", hitung);
    window.addEventListener("scroll", hitung, true); // true: ikut saat area scroll di dalam card bergeser
    return () => {
      window.removeEventListener("resize", hitung);
      window.removeEventListener("scroll", hitung, true);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setHighlight(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  function selectOption(v: string) {
    onChange(v);
    setOpen(false);
    setQuery("");
  }

  const h = size === "sm" ? "h-7" : "h-8";
  const textSize = size === "sm" ? "text-[11.5px]" : "text-[12.5px]";

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`${h} w-full px-2 rounded-md ${textSize} flex items-center justify-between gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-left`}
        style={{ border: "1px solid var(--border)", background: "var(--surface)", color: selected ? "var(--text-primary)" : "var(--text-muted)" }}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <span className="flex items-center gap-1 shrink-0">
          {selected && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
                setOpen(false);
                setQuery("");
              }}
              title="Hapus pilihan"
              className="w-4 h-4 rounded-full flex items-center justify-center cursor-pointer hover:opacity-100"
              style={{ color: "var(--text-muted)", opacity: 0.7 }}
            >
              ×
            </span>
          )}
          <span style={{ color: "var(--text-muted)" }}>▾</span>
        </span>
      </button>

      {open && pos && typeof document !== "undefined" && createPortal(
        <div
          ref={listRef}
          className="fixed rounded-md overflow-hidden shadow-lg flex flex-col"
          style={{
            zIndex: 1000,
            left: pos.left,
            top: pos.top,
            bottom: pos.bottom,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            minWidth: Math.max(pos.width, 200),
            width: "max-content",
            maxWidth: 360,
            maxHeight: pos.maxH,
          }}
        >
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlight((h) => Math.min(h + 1, Math.max(jumlahBaris - 1, 0)));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlight((h) => Math.max(h - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                if (highlight < filtered.length && filtered[highlight]) selectOption(filtered[highlight].value);
                else if (showCreate) createNew();
              } else if (e.key === "Escape") {
                setOpen(false);
                setQuery("");
              }
            }}
            placeholder="Cari..."
            className={`w-full h-8 px-2.5 ${textSize} outline-none`}
            style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-primary)" }}
          />
          <div className="overflow-auto min-h-0">
            {filtered.length === 0 && (
              <div className={`px-2.5 py-2 ${textSize}`} style={{ color: "var(--text-muted)" }}>
                Tidak ada hasil.
              </div>
            )}
            {filtered.map((o, i) => (
              <div
                key={o.value}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectOption(o.value);
                }}
                onMouseEnter={() => setHighlight(i)}
                className={`px-2.5 py-1.5 ${textSize} cursor-pointer truncate`}
                style={{
                  background: i === highlight ? "var(--accent-soft)" : "transparent",
                  color: o.value === value ? "var(--accent)" : "var(--text-primary)",
                  fontWeight: o.value === value ? 600 : 400,
                }}
              >
                {o.label}
                {o.sublabel && (
                  <span className="ml-1.5" style={{ color: "var(--text-muted)", fontWeight: 400 }}>
                    {o.sublabel}
                  </span>
                )}
              </div>
            ))}
          </div>
          {showCreate && (
            <div
              onMouseDown={(e) => {
                e.preventDefault();
                createNew();
              }}
              onMouseEnter={() => setHighlight(filtered.length)}
              className={`px-2.5 py-2 ${textSize} cursor-pointer truncate font-medium`}
              style={{
                borderTop: "1px solid var(--border)",
                background: highlight === filtered.length ? "var(--accent-soft)" : "transparent",
                color: "var(--accent)",
              }}
            >
              {q ? `+ Tambah "${q}" sebagai ${createLabel} baru` : `+ Tambah ${createLabel} baru`}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
