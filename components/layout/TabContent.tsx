"use client";

import { useTabs } from "./TabContext";
import { TabActiveProvider } from "./DataSync";
import { Dashboard } from "../modules/Dashboard";
import { TransaksiBulanan } from "../modules/TransaksiBulanan";
import { OutstandingPO } from "../modules/OutstandingPO";
import { Produksi } from "../modules/Produksi";
import { StokBahanBaku } from "../modules/StokBahanBaku";
import { Return } from "../modules/Return";
import { SuratJalan } from "../modules/SuratJalan";
import { SuratJalanMasuk } from "../modules/SuratJalanMasuk";
import { Invoice } from "../modules/Invoice";
import { MasterPart } from "../modules/MasterPart";
import { MasterBahanBaku } from "../modules/MasterBahanBaku";
import { MasterCustomer } from "../modules/MasterCustomer";
import { Backup } from "../modules/Backup";

const MODULES: Record<string, React.ComponentType> = {
  dashboard: Dashboard,
  "transaksi-bulanan": TransaksiBulanan,
  "outstanding-po": OutstandingPO,
  produksi: Produksi,
  "stok-bahan-baku": StokBahanBaku,
  return: Return,
  "surat-jalan": SuratJalan,
  "surat-jalan-masuk": SuratJalanMasuk,
  invoice: Invoice,
  "master-part": MasterPart,
  "master-bahan-baku": MasterBahanBaku,
  "master-customer": MasterCustomer,
  backup: Backup,
};

export function TabContent() {
  const { tabs, activeKey } = useTabs();

  return (
    <div className="flex-1 min-h-0 relative">
      {tabs.map((tab) => {
        const Comp = MODULES[tab.moduleId];
        if (!Comp) return null;
        const isActive = tab.key === activeKey;
        return (
          <div
            key={tab.key}
            className="absolute inset-0 overflow-auto"
            style={{ display: isActive ? "block" : "none" }}
          >
            <TabActiveProvider value={isActive}>
              <Comp />
            </TabActiveProvider>
          </div>
        );
      })}
    </div>
  );
}
