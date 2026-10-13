"use client";

import { useTabs } from "./TabContext";
import { useTheme } from "./ThemeProvider";

export function TabBar() {
  const { tabs, activeKey, closeTab, setActive } = useTabs();
  const { theme, toggle } = useTheme();

  return (
    <div
      className="h-10 shrink-0 flex items-center"
      style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}
    >
      <div className="flex-1 flex items-stretch overflow-x-auto min-w-0 pl-12 md:pl-0">
        {tabs.length === 0 && (
          <div className="flex items-center px-4 text-[12.5px]" style={{ color: "var(--text-muted)" }}>
            Belum ada tab terbuka — pilih menu di sidebar
          </div>
        )}
        {tabs.map((tab) => {
          const active = tab.key === activeKey;
          return (
            <div
              key={tab.key}
              onClick={() => setActive(tab.key)}
              className="group flex items-center gap-2 px-3.5 text-[12.5px] cursor-pointer select-none shrink-0"
              style={{
                borderRight: "1px solid var(--border)",
                background: active ? "var(--bg)" : "transparent",
                borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
                color: active ? "var(--text-primary)" : "var(--text-secondary)",
                fontWeight: active ? 500 : 400,
              }}
            >
              <span className="truncate max-w-[160px]">{tab.title}</span>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.key);
                }}
                className="w-4 h-4 rounded flex items-center justify-center shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-muted)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <svg width="10" height="10" viewBox="0 0 10 10">
                  <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </span>
            </div>
          );
        })}
      </div>

      <button
        onClick={toggle}
        title={theme === "light" ? "Mode gelap" : "Mode terang"}
        className="mx-3 w-7 h-7 rounded-md flex items-center justify-center cursor-pointer shrink-0"
        style={{ color: "var(--text-secondary)" }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-muted)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        {theme === "light" ? <IconMoon /> : <IconSun />}
      </button>
    </div>
  );
}

function IconMoon() {
  return (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
      <path
        d="M16.5 12.5A7 7 0 018 4a6.5 6.5 0 108.5 8.5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconSun() {
  return (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="3.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M10 2.5v2M10 15.5v2M17.5 10h-2M4.5 10h-2M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4M15.3 15.3l-1.4-1.4M6.1 6.1L4.7 4.7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
