"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  value: string | number;
  onSave: (newValue: string) => Promise<void> | void;
  align?: "left" | "right";
  type?: "text" | "number";
  width?: number;
  mono?: boolean;
  placeholder?: string;
};

export function EditableCell({
  value,
  onSave,
  align = "left",
  type = "text",
  mono = false,
  placeholder,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? ""));
  const [saved, setSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(String(value ?? ""));
  }, [value, editing]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  async function commit() {
    setEditing(false);
    if (draft === String(value ?? "")) return;
    await onSave(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 900);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        type={type}
        inputMode={type === "number" ? "decimal" : undefined}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setDraft(String(value ?? ""));
            setEditing(false);
          }
        }}
        className={`w-full h-full px-2 py-1.5 outline-none bg-transparent ${mono ? "font-mono-num" : ""}`}
        style={{
          textAlign: align,
          boxShadow: "inset 0 0 0 2px var(--focus)",
        }}
      />
    );
  }

  return (
    <div
      onClick={() => setEditing(true)}
      className={`w-full h-full px-2 py-1.5 cursor-text truncate ${mono ? "font-mono-num" : ""} ${
        saved ? "cell-saved" : ""
      }`}
      style={{ textAlign: align, color: value === "" || value === undefined ? "var(--text-muted)" : undefined }}
      title="Klik untuk edit"
    >
      {String(value ?? "") === "" ? placeholder ?? "—" : String(value)}
    </div>
  );
}
