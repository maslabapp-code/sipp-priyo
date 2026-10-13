"use client";

import { useEffect, useRef, useState } from "react";

export function ExportButton({
  baseUrl,
  params,
}: {
  baseUrl: string;
  params?: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function buildUrl(format: string) {
    const qs = new URLSearchParams({ ...(params ?? {}), format });
    return `${baseUrl}?${qs.toString()}`;
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="h-8 px-3 rounded-md text-[12.5px] font-medium cursor-pointer flex items-center gap-1.5"
        style={{ border: "1px solid var(--border)", color: "var(--text-secondary)", background: "var(--surface)" }}
      >
        <IconDownload />
        Export
      </button>
      {open && (
        <div
          className="absolute right-0 top-9 z-30 rounded-md overflow-hidden"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", minWidth: 150, boxShadow: "0 4px 16px rgba(0,0,0,0.12)" }}
        >
          <a
            href={buildUrl("xlsx")}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 h-9 text-[12.5px] cursor-pointer no-underline"
            style={{ color: "var(--text-primary)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-muted)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            📊 Excel (.xlsx)
          </a>
          <a
            href={buildUrl("pdf")}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 h-9 text-[12.5px] cursor-pointer no-underline"
            style={{ color: "var(--text-primary)", borderTop: "1px solid var(--border)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-muted)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            📄 PDF
          </a>
        </div>
      )}
    </div>
  );
}

function IconDownload() {
  return (
    <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
      <path d="M10 3v10m0 0l-4-4m4 4l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 15v1a2 2 0 002 2h10a2 2 0 002-2v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
