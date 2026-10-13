"use client";

import { useMemo, useState } from "react";

type Getter<T> = (row: T) => string | number | null | undefined;

export function useTableControls<T>(rows: T[], getters: Record<string, Getter<T>>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filters, setFilters] = useState<Record<string, string>>({});

  function setFilter(key: string, value: string) {
    setFilters((f) => ({ ...f, [key]: value }));
  }

  function toggleSort(key: string) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else {
      setSortKey(null);
    }
  }

  const filteredSorted = useMemo(() => {
    let r = rows;

    for (const [key, val] of Object.entries(filters)) {
      if (!val) continue;
      const getter = getters[key];
      if (!getter) continue;
      const needle = val.toLowerCase();
      r = r.filter((row) => String(getter(row) ?? "").toLowerCase().includes(needle));
    }

    if (sortKey && getters[sortKey]) {
      const getter = getters[sortKey];
      r = [...r].sort((a, b) => {
        const av = getter(a);
        const bv = getter(b);
        if (typeof av === "number" && typeof bv === "number") {
          return sortDir === "asc" ? av - bv : bv - av;
        }
        return sortDir === "asc"
          ? String(av ?? "").localeCompare(String(bv ?? ""))
          : String(bv ?? "").localeCompare(String(av ?? ""));
      });
    }

    return r;
  }, [rows, filters, sortKey, sortDir, getters]);

  return { filteredSorted, filters, setFilter, sortKey, sortDir, toggleSort };
}
