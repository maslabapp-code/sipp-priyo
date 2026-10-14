"use client";

import { createContext, useCallback, useContext, useState } from "react";

export type TabDef = {
  key: string; // unique id, misal "transaksi-bulanan" atau "transaksi-bulanan:2025-02"
  title: string;
  moduleId: string; // menentukan komponen apa yang dirender
  params?: Record<string, string>;
};

type TabContextType = {
  tabs: TabDef[];
  activeKey: string | null;
  openTab: (tab: TabDef) => void;
  closeTab: (key: string) => void;
  setActive: (key: string) => void;
};

const TabContext = createContext<TabContextType | null>(null);

export function TabProvider({ children }: { children: React.ReactNode }) {
  const [tabs, setTabs] = useState<TabDef[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const openTab = useCallback((tab: TabDef) => {
    setTabs((prev) => {
      if (prev.some((t) => t.key === tab.key)) return prev;
      return [...prev, tab];
    });
    setActiveKey(tab.key);
  }, []);

  const closeTab = useCallback(
    (key: string) => {
      setTabs((prev) => {
        const idx = prev.findIndex((t) => t.key === key);
        const next = prev.filter((t) => t.key !== key);
        if (activeKey === key) {
          const fallback = next[idx - 1] ?? next[0];
          setActiveKey(fallback ? fallback.key : null);
        }
        return next;
      });
    },
    [activeKey]
  );

  const setActive = useCallback((key: string) => setActiveKey(key), []);

  return (
    <TabContext.Provider value={{ tabs, activeKey, openTab, closeTab, setActive }}>
      {children}
    </TabContext.Provider>
  );
}

export function useTabs() {
  const ctx = useContext(TabContext);
  if (!ctx) throw new Error("useTabs must be used within TabProvider");
  return ctx;
}
