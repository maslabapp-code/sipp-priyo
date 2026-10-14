"use client";

import { useEffect, useState } from "react";
import { useTabs } from "./TabContext";

type MenuItem = {
  moduleId: string;
  label: string;
  icon: React.ReactNode;
};

type MenuGroup = {
  group: true;
  label: string;
  icon: React.ReactNode;
  children: MenuItem[];
};

type MenuEntry = MenuItem | MenuGroup;

const MENU: MenuEntry[] = [
  { moduleId: "dashboard", label: "Dashboard", icon: <IconGrid /> },
  { moduleId: "transaksi-bulanan", label: "Transaksi Bulanan", icon: <IconTable /> },
  { moduleId: "outstanding-po", label: "Outstanding PO", icon: <IconAlert /> },
  { moduleId: "produksi", label: "Produksi", icon: <IconScissors /> },
  { moduleId: "stok-bahan-baku", label: "Stok Bahan Baku", icon: <IconLayers /> },
  { moduleId: "return", label: "Return", icon: <IconReturn /> },
  { moduleId: "surat-jalan-masuk", label: "Surat Jalan Masuk", icon: <IconTruck /> },
  { moduleId: "surat-jalan", label: "Surat Jalan Keluar", icon: <IconTruck /> },
  { moduleId: "invoice", label: "Invoice", icon: <IconInvoice /> },
  {
    group: true,
    label: "Master Data",
    icon: <IconFolder />,
    children: [
      { moduleId: "master-part", label: "Master Part", icon: <IconBox /> },
      { moduleId: "master-bahan-baku", label: "Master Bahan Baku", icon: <IconDrop /> },
      { moduleId: "master-customer", label: "Customer", icon: <IconUsers /> },
    ],
  },
  { moduleId: "backup", label: "Backup Database", icon: <IconDatabase /> },
];

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [breakpoint]);
  return isMobile;
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useIsMobile();
  const { openTab, setActive, tabs, activeKey } = useTabs();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const menuItems: MenuEntry[] = MENU;

  function handleClick(item: MenuItem) {
    const key = item.moduleId;
    const existing = tabs.find((t) => t.key === key);
    if (existing) {
      setActive(key);
    } else {
      openTab({ key, title: item.label, moduleId: item.moduleId });
    }
    if (isMobile) setMobileOpen(false);
  }

  function toggleGroup(label: string) {
    if (collapsed && !isMobile) setCollapsed(false);
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // abaikan, tetap arahkan ke halaman login
    }
    window.location.href = "/login";
  }

  const showLabels = isMobile ? true : !collapsed;
  const activeModuleId = tabs.find((t) => t.key === activeKey)?.moduleId;

  function renderMenuButton(item: MenuItem, isActive: boolean, indented?: boolean) {
    return (
      <button
        key={item.moduleId}
        onClick={() => handleClick(item)}
        title={!showLabels ? item.label : undefined}
        className="group flex items-center gap-2.5 rounded-md px-2 h-9 text-[13px] cursor-pointer transition-colors relative"
        style={{
          color: isActive ? "var(--sidebar-accent)" : "var(--sidebar-text-secondary)",
          background: isActive ? "var(--sidebar-accent-soft)" : "transparent",
          fontWeight: isActive ? 500 : 400,
          marginLeft: indented && showLabels ? 14 : 0,
        }}
        onMouseEnter={(e) => {
          if (!isActive) e.currentTarget.style.background = "var(--sidebar-hover)";
        }}
        onMouseLeave={(e) => {
          if (!isActive) e.currentTarget.style.background = "transparent";
        }}
      >
        {isActive && (
          <span
            className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full"
            style={{ background: "var(--sidebar-accent)" }}
          />
        )}
        <span className="shrink-0 [&>svg]:w-[17px] [&>svg]:h-[17px]">{item.icon}</span>
        {showLabels && <span className="truncate">{item.label}</span>}
      </button>
    );
  }

  const panel = (
    <aside
      className="flex flex-col shrink-0 h-full transition-[width] duration-150"
      style={{
        width: isMobile ? 220 : collapsed ? 56 : 208,
        background: "var(--sidebar-bg)",
        borderRight: "1px solid var(--sidebar-border)",
        color: "var(--sidebar-text)",
      }}
    >
      <div
        className="h-12 flex items-center shrink-0 px-3 gap-2"
        style={{ borderBottom: "1px solid var(--sidebar-border)" }}
      >
        <div
          className="w-6 h-6 rounded flex items-center justify-center shrink-0 text-[11px] font-semibold"
          style={{ background: "var(--sidebar-accent)", color: "white" }}
        >
          M
        </div>
        {showLabels && (
          <span className="text-[13px] font-semibold tracking-tight truncate">
            SIPP
          </span>
        )}
        {isMobile && (
          <button
            onClick={() => setMobileOpen(false)}
            className="ml-auto w-7 h-7 rounded flex items-center justify-center cursor-pointer"
            style={{ color: "var(--sidebar-text-muted)" }}
          >
            ×
          </button>
        )}
      </div>

      <nav className="flex-1 py-2 flex flex-col gap-0.5 px-2 overflow-y-auto">
        {menuItems.map((item) => {
          if ("group" in item) {
            const childActive = item.children.some((c) => c.moduleId === activeModuleId);
            const isExpanded = expandedGroups.has(item.label) || childActive;
            return (
              <div key={item.label}>
                <button
                  onClick={() => toggleGroup(item.label)}
                  title={!showLabels ? item.label : undefined}
                  className="w-full flex items-center gap-2.5 rounded-md px-2 h-9 text-[13px] cursor-pointer transition-colors"
                  style={{
                    color: childActive ? "var(--sidebar-accent)" : "var(--sidebar-text-secondary)",
                    fontWeight: childActive ? 500 : 400,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--sidebar-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span className="shrink-0 [&>svg]:w-[17px] [&>svg]:h-[17px]">{item.icon}</span>
                  {showLabels && (
                    <>
                      <span className="truncate flex-1 text-left">{item.label}</span>
                      <span className="shrink-0 transition-transform" style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}>
                        <IconChevronRight />
                      </span>
                    </>
                  )}
                </button>
                {isExpanded && showLabels && (
                  <div className="flex flex-col gap-0.5 mt-0.5">
                    {item.children.map((child) => renderMenuButton(child, child.moduleId === activeModuleId, true))}
                  </div>
                )}
              </div>
            );
          }
          return renderMenuButton(item, item.moduleId === activeModuleId);
        })}
      </nav>

      <div className="px-2 pt-2" style={{ borderTop: "1px solid var(--sidebar-border)" }}>
        <button
          onClick={handleLogout}
          title={!showLabels ? "Keluar" : undefined}
          className="w-full flex items-center gap-2.5 rounded-md px-2 h-9 text-[13px] cursor-pointer transition-colors"
          style={{ color: "var(--sidebar-text-secondary)" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--sidebar-hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <span className="shrink-0 [&>svg]:w-[17px] [&>svg]:h-[17px]"><IconLogout /></span>
          {showLabels && <span className="truncate">Keluar</span>}
        </button>
      </div>

      {!isMobile && (
        <div className="p-2">
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="w-full flex items-center justify-center h-8 rounded-md text-[12px] cursor-pointer"
            style={{ color: "var(--sidebar-text-muted)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--sidebar-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            title={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
          >
            <IconChevron collapsed={collapsed} />
          </button>
        </div>
      )}
    </aside>
  );

  if (!isMobile) return panel;

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-2.5 left-2.5 z-40 w-9 h-9 rounded-md flex items-center justify-center cursor-pointer shadow-sm"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          display: mobileOpen ? "none" : "flex",
        }}
        aria-label="Buka menu"
      >
        <IconHamburger />
      </button>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40"
          style={{ background: "rgba(15,20,28,0.45)" }}
          onClick={() => setMobileOpen(false)}
        >
          <div onClick={(e) => e.stopPropagation()} className="h-full">
            {panel}
          </div>
        </div>
      )}
    </>
  );
}

function IconHamburger() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
      <path d="M3 5.5h14M3 10h14M3 14.5h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconFolder() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <path
        d="M3 6a1.5 1.5 0 011.5-1.5H8l1.5 2H15.5A1.5 1.5 0 0117 8v6.5A1.5 1.5 0 0115.5 16h-11A1.5 1.5 0 013 14.5V6z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconChevronRight() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconChevron({ collapsed }: { collapsed: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d={collapsed ? "M6 3l5 5-5 5" : "M10 3l-5 5 5 5"}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconGrid() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <rect x="3" y="3" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="3" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="3" y="11" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="11" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
function IconTable() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <rect x="3" y="4" width="14" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 8.5h14M8 4v12" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
function IconAlert() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <path d="M10 3L2.5 16h15L10 3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M10 8.5v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="10" cy="13.7" r="0.9" fill="currentColor" />
    </svg>
  );
}
function IconBox() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <path
        d="M10 3l7 3.5v7L10 17l-7-3.5v-7L10 3z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M3.5 6.5L10 10l6.5-3.5M10 10v7" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <circle cx="7.5" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2.5 16c.7-2.7 2.6-4 5-4s4.3 1.3 5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="14" cy="6.5" r="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M13 11c1.9.2 3.3 1.4 3.9 3.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function IconScissors() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <circle cx="5.5" cy="5" r="2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="5.5" cy="15" r="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 6.3L16 14M7 13.7L16 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function IconLayers() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <path d="M10 3l7 3.7L10 10.3 3 6.7 10 3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M3 10l7 3.7 7-3.7M3 13.3L10 17l7-3.7" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
function IconDrop() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <path
        d="M10 3c2.5 3.2 5 6.2 5 9a5 5 0 01-10 0c0-2.8 2.5-5.8 5-9z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconReturn() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <path d="M4 10a6 6 0 1 1 1.8 4.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4 6v4h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconLogout() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <path d="M8 3.5H5.5A1.5 1.5 0 004 5v10a1.5 1.5 0 001.5 1.5H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 6.5L15.5 10 12 13.5M15.5 10H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconDatabase() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <ellipse cx="10" cy="5" rx="6" ry="2.3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 5v10c0 1.27 2.69 2.3 6 2.3s6-1.03 6-2.3V5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4 10c0 1.27 2.69 2.3 6 2.3s6-1.03 6-2.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function IconInvoice() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <path d="M5 2.5h7l3 3v12H5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M12 2.5v3h3" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M7.5 10h5M7.5 13h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconTruck() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <path d="M2 6h9v7H2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M11 9h3.5L17 11.5V13h-6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="6" cy="15" r="1.6" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="14.5" cy="15" r="1.6" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
