"use client";

import { Sidebar } from "./Sidebar";
import { TabBar } from "./TabBar";
import { TabContent } from "./TabContent";
import { TabProvider, useTabs } from "./TabContext";
import { DataSyncProvider } from "./DataSync";
import { ThemeProvider } from "./ThemeProvider";
import { useEffect } from "react";

function AutoOpenDashboard() {
  const { openTab, tabs } = useTabs();
  useEffect(() => {
    if (tabs.length === 0) {
      openTab({ key: "dashboard", title: "Dashboard", moduleId: "dashboard" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

export function AppShell() {
  return (
    <ThemeProvider>
      <TabProvider>
        <DataSyncProvider>
        <AutoOpenDashboard />
        <div className="flex h-full w-full overflow-hidden">
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <TabBar />
            <TabContent />
          </div>
        </div>
        </DataSyncProvider>
      </TabProvider>
    </ThemeProvider>
  );
}
