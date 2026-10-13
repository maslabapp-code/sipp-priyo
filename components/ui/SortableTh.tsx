"use client";

export function SortableTh({
  label,
  active,
  dir,
  onClick,
  align = "left",
  width,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
  align?: "left" | "right" | "center";
  width?: number;
}) {
  return (
    <th
      onClick={onClick}
      className="px-2 py-2 font-medium sticky top-0 whitespace-nowrap cursor-pointer select-none"
      style={{
        textAlign: align,
        color: active ? "var(--accent)" : "var(--text-secondary)",
        background: "var(--surface-muted)",
        minWidth: width,
      }}
      title="Klik untuk urutkan"
    >
      <span className="inline-flex items-center gap-1" style={{ flexDirection: align === "right" ? "row-reverse" : "row" }}>
        {label}
        <span style={{ opacity: active ? 1 : 0.25, fontSize: 9 }}>
          {active ? (dir === "asc" ? "▲" : "▼") : "▲"}
        </span>
      </span>
    </th>
  );
}
