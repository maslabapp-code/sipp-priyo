import {
  pgTable,
  text,
  integer,
  numeric,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

// ── Master data ────────────────────────────────────────────

export const customers = pgTable("customers", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  nama: text("nama").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const parts = pgTable(
  "parts",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    kodePart: text("kode_part"),
    namaBarang: text("nama_barang").notNull(),
    kategori: text("kategori"), // contoh: RPL, CNC, DNP, MESH, dll
    hargaJualDefault: numeric("harga_jual_default", { precision: 14, scale: 2 }).notNull().default("0"),
    customerId: text("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    // ── Hubungan ke bahan baku (dikunci di master, bukan diketik ulang tiap potong) ──
    rawMaterialId: text("raw_material_id").references(() => rawMaterials.id, { onDelete: "set null" }),
    satuanPotong: text("satuan_potong"), // Lembar | Pita | Kg — satuan yang dicatat saat potong
    konversiPcs: numeric("konversi_pcs", { precision: 14, scale: 4 }), // pcs per satuan potong (per lembar / pita / kg)
    lebarPotong: numeric("lebar_potong", { precision: 14, scale: 4 }), // mm
    beratPerUnit: numeric("berat_per_unit", { precision: 14, scale: 4 }), // kg per lembar / pita
    brutoPerKg: numeric("bruto_per_kg", { precision: 14, scale: 4 }), // pcs per kg bruto
    nettoPerKg: numeric("netto_per_kg", { precision: 14, scale: 4 }), // pcs per kg netto
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("parts_nama_idx").on(table.namaBarang)]
);

// ── Transaksi bulanan ──────────────────────────────────────

export const monthlyTransactions = pgTable(
  "monthly_transactions",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    partId: text("part_id")
      .notNull()
      .references(() => parts.id, { onDelete: "cascade" }),
    bulan: integer("bulan").notNull(), // 1-12
    tahun: integer("tahun").notNull(),

    stock: numeric("stock", { precision: 14, scale: 2 }).notNull().default("0"),
    poAct: numeric("po_act", { precision: 14, scale: 2 }).notNull().default("0"), // catatan/referensi

    poCpl1: numeric("po_cpl_1", { precision: 14, scale: 2 }).notNull().default("0"),
    poCpl2: numeric("po_cpl_2", { precision: 14, scale: 2 }).notNull().default("0"),
    poCpl3: numeric("po_cpl_3", { precision: 14, scale: 2 }).notNull().default("0"),
    noPo: text("no_po"), // No. PO — 1 per bulan per part; kalau tidak lunas di akhir bulan dianggap hangus

    hargaJual: numeric("harga_jual", { precision: 14, scale: 2 }).notNull().default("0"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("monthly_tx_part_bulan_tahun_idx").on(
      table.partId,
      table.bulan,
      table.tahun
    ),
  ]
);

// Rincian kirim per tanggal (kalender harian)
export const dailyDeliveries = pgTable(
  "daily_deliveries",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    monthlyTransactionId: text("monthly_transaction_id")
      .notNull()
      .references(() => monthlyTransactions.id, { onDelete: "cascade" }),
    tanggal: integer("tanggal").notNull(), // 1-31
    qtyRencana: numeric("qty_rencana", { precision: 14, scale: 2 }).notNull().default("0"), // jadwal/Sch
    qtyKirim: numeric("qty_kirim", { precision: 14, scale: 2 }).notNull().default("0"), // realisasi/Act
  },
  (table) => [
    uniqueIndex("daily_delivery_tx_tanggal_idx").on(
      table.monthlyTransactionId,
      table.tanggal
    ),
  ]
);

// ── Produksi / Potong bahan baku (Fase 2) ──────────────────

// Log potong: bahan baku (lembar/pita/kg) dipotong jadi part jadi
export const productionCuts = pgTable("production_cuts", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  partId: text("part_id")
    .notNull()
    .references(() => parts.id, { onDelete: "cascade" }),
  tanggal: timestamp("tanggal").notNull(),
  satuan: text("satuan"), // label bebas: "Lembar" / "Pita" / "Kg"
  qty: numeric("qty", { precision: 14, scale: 2 }).notNull().default("0"), // jumlah lembar/pita dipotong
  konversi: numeric("konversi", { precision: 14, scale: 2 }).notNull().default("1"), // pcs per unit
  konversi2: numeric("konversi2", { precision: 14, scale: 2 }).notNull().default("1"), // level ke-2 (misal MESH: Pita x Lbr)
  // Kalau diisi: potongan ini otomatis mengurangi stok batch bahan baku terkait (qty di atas = qty yang dipakai dari batch)
  rawMaterialUsageId: text("raw_material_usage_id").references(() => rawMaterialUsages.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Log kirim dari hasil potongan: DIHAPUS (Sep 2026) — digabung ke daily_deliveries
// (lihat lib/production.ts: findOrCreateMonthlyTransaction + upsertDailyKirim), supaya
// "Kirim" yang dicatat dari Produksi dan dari Transaksi Bulanan selalu satu sumber data.

// ── Relations ──────────────────────────────────────────────

export const customersRelations = relations(customers, ({ many }) => ({
  parts: many(parts),
}));

export const partsRelations = relations(parts, ({ one, many }) => ({
  customer: one(customers, {
    fields: [parts.customerId],
    references: [customers.id],
  }),
  transactions: many(monthlyTransactions),
  productionCuts: many(productionCuts),
}));

export const monthlyTransactionsRelations = relations(
  monthlyTransactions,
  ({ one, many }) => ({
    part: one(parts, {
      fields: [monthlyTransactions.partId],
      references: [parts.id],
    }),
    dailyDeliveries: many(dailyDeliveries),
  })
);

export const dailyDeliveriesRelations = relations(dailyDeliveries, ({ one }) => ({
  monthlyTransaction: one(monthlyTransactions, {
    fields: [dailyDeliveries.monthlyTransactionId],
    references: [monthlyTransactions.id],
  }),
}));

export const productionCutsRelations = relations(productionCuts, ({ one }) => ({
  part: one(parts, {
    fields: [productionCuts.partId],
    references: [parts.id],
  }),
  rawMaterialUsage: one(rawMaterialUsages, {
    fields: [productionCuts.rawMaterialUsageId],
    references: [rawMaterialUsages.id],
  }),
}));

// ── Stok bahan baku (Fase 2) ────────────────────────────────

// Master jenis bahan baku (misal: "Pelat SPCC SD 0.8 mm", "Pelat SECC 1.0 mm", dll)
export const rawMaterials = pgTable("raw_materials", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  nama: text("nama").notNull().unique(),
  satuan: text("satuan"), // satuan tagihan: "Kg" (lembaran/coil/sheet-pita/as-kawat) atau "pcs" (nut square, wiremesh, WIP)
  // lembaran | coil | sheet_pita | as_kawat | wip | nut_square | wiremesh
  jenis: text("jenis").notNull().default("lembaran"),
  // Bahan baku ditentukan oleh spesifikasi + ukuran (+ bentuk/jenis). Contoh: spesifikasi "SPCC SD", ukuran "1.6 x 113".
  grade: text("grade"),
  ukuran: text("ukuran"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Batch bahan baku masuk (satu kedatangan)
export const rawMaterialBatches = pgTable("raw_material_batches", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  rawMaterialId: text("raw_material_id")
    .notNull()
    .references(() => rawMaterials.id, { onDelete: "restrict" }),
  tanggal: timestamp("tanggal").notNull(),
  qty: numeric("qty", { precision: 14, scale: 2 }).notNull().default("0"), // ukuran utama = satuan tagihan (Kg / pcs)
  // Ukuran kedua (opsional): jumlah pita/lembar sesuai keterangan di SJ customer
  qty2: numeric("qty2", { precision: 14, scale: 2 }),
  satuan2: text("satuan2"),
  // Asal kedatangan (diisi otomatis dari Surat Jalan Masuk)
  noSj: text("no_sj"),
  customerId: text("customer_id").references(() => customers.id, { onDelete: "set null" }),
  suratJalanMasukId: text("surat_jalan_masuk_id"),
  // sj = dari Surat Jalan Masuk | stok_awal = stok awal / koreksi (wajib ada keterangan)
  sumber: text("sumber").notNull().default("stok_awal"),
  catatan: text("catatan"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Pemakaian dari satu batch, dipakai untuk part tertentu
export const rawMaterialUsages = pgTable("raw_material_usages", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  batchId: text("batch_id")
    .notNull()
    .references(() => rawMaterialBatches.id, { onDelete: "cascade" }),
  partId: text("part_id").references(() => parts.id, { onDelete: "set null" }),
  tanggal: timestamp("tanggal").notNull(),
  qty: numeric("qty", { precision: 14, scale: 2 }).notNull().default("0"),
  // Catatan potong asal pemakaian ini. Satu potong bisa dibagi ke beberapa kedatangan, jadi satu potong
  // bisa punya beberapa pemakaian. (Sengaja tanpa FK supaya tidak melingkar dengan production_cuts.)
  productionCutId: text("production_cut_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const rawMaterialsRelations = relations(rawMaterials, ({ many }) => ({
  batches: many(rawMaterialBatches),
}));

export const rawMaterialBatchesRelations = relations(rawMaterialBatches, ({ one, many }) => ({
  rawMaterial: one(rawMaterials, {
    fields: [rawMaterialBatches.rawMaterialId],
    references: [rawMaterials.id],
  }),
  usages: many(rawMaterialUsages),
}));

export const rawMaterialUsagesRelations = relations(rawMaterialUsages, ({ one }) => ({
  batch: one(rawMaterialBatches, {
    fields: [rawMaterialUsages.batchId],
    references: [rawMaterialBatches.id],
  }),
  part: one(parts, {
    fields: [rawMaterialUsages.partId],
    references: [parts.id],
  }),
}));

// ── Return (Fase 2) ─────────────────────────────────────────
// Retur DIANGGAP TERPISAH dari Kirim PO bulanan (tidak mengurangi/menambah Actual Penjualan) —
// sesuai konfirmasi user.

// Barang retur DATANG dari customer (dianggap rusak, No. SJ wajib dicatat)
export const returnIncoming = pgTable("return_incoming", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  partId: text("part_id")
    .notNull()
    .references(() => parts.id, { onDelete: "cascade" }),
  tanggal: timestamp("tanggal").notNull(),
  noSj: text("no_sj").notNull(),
  qty: numeric("qty", { precision: 14, scale: 2 }).notNull().default("0"),
  alasan: text("alasan"), // misal: "Reject - customer minta ganti"
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Penyelesaian retur: kirim ulang (barang diperbaiki) ATAU spoilage (barang hangus, tidak bisa diperbaiki)
export const returnResolutions = pgTable("return_resolutions", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  partId: text("part_id")
    .notNull()
    .references(() => parts.id, { onDelete: "cascade" }),
  tanggal: timestamp("tanggal").notNull(),
  jenis: text("jenis").notNull(), // "kirim_ulang" | "spoilage"
  qty: numeric("qty", { precision: 14, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const returnIncomingRelations = relations(returnIncoming, ({ one }) => ({
  part: one(parts, { fields: [returnIncoming.partId], references: [parts.id] }),
}));
export const returnResolutionsRelations = relations(returnResolutions, ({ one }) => ({
  part: one(parts, { fields: [returnResolutions.partId], references: [parts.id] }),
}));

// ── Master kecil untuk dropdown (Fase 2) ───────────────────
// Supaya "Kategori/Proses" di Master Part & "Satuan" di Produksi konsisten (bukan teks bebas lagi).

export const partCategories = pgTable("part_categories", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  nama: text("nama").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const satuanPotong = pgTable("satuan_potong", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  nama: text("nama").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Surat Jalan ──────────────────────────────────────────────

export const suratJalan = pgTable("surat_jalan", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  noSj: text("no_sj").notNull().unique(),
  // P = produksi, J = jasa, W = WIP. Tiap jenis punya urutan nomor sendiri dan mulai dari 1 lagi tiap tahun.
  jenis: text("jenis").notNull().default("P"),
  customerId: text("customer_id").references(() => customers.id, { onDelete: "set null" }),
  tanggal: timestamp("tanggal").notNull(),
  catatan: text("catatan"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Snapshot nama barang & qty saat SJ dibuat (supaya histori tidak berubah walau Master Part diedit nanti)
export const suratJalanItems = pgTable("surat_jalan_items", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  suratJalanId: text("surat_jalan_id")
    .notNull()
    .references(() => suratJalan.id, { onDelete: "cascade" }),
  partId: text("part_id").references(() => parts.id, { onDelete: "set null" }),
  namaBarang: text("nama_barang").notNull(),
  qty: numeric("qty", { precision: 14, scale: 2 }).notNull().default("0"),
  satuan: text("satuan"),
});

export const suratJalanRelations = relations(suratJalan, ({ one, many }) => ({
  customer: one(customers, { fields: [suratJalan.customerId], references: [customers.id] }),
  items: many(suratJalanItems),
}));
export const suratJalanItemsRelations = relations(suratJalanItems, ({ one }) => ({
  suratJalan: one(suratJalan, { fields: [suratJalanItems.suratJalanId], references: [suratJalan.id] }),
  part: one(parts, { fields: [suratJalanItems.partId], references: [parts.id] }),
}));


// ── Surat Jalan Masuk (material dari customer, mis. CPL) ─────────────

export const suratJalanMasuk = pgTable("surat_jalan_masuk", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  noSj: text("no_sj").notNull().unique(), // nomor SJ dari customer
  customerId: text("customer_id").references(() => customers.id, { onDelete: "set null" }),
  tanggal: timestamp("tanggal").notNull(),
  noPo: text("no_po"), // boleh kosong
  catatan: text("catatan"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Satu baris SJ masuk = satu kedatangan (batch) di Stok Bahan Baku
export const suratJalanMasukItems = pgTable("surat_jalan_masuk_items", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  suratJalanMasukId: text("surat_jalan_masuk_id")
    .notNull()
    .references(() => suratJalanMasuk.id, { onDelete: "cascade" }),
  rawMaterialId: text("raw_material_id")
    .notNull()
    .references(() => rawMaterials.id, { onDelete: "restrict" }),
  batchId: text("batch_id").references(() => rawMaterialBatches.id, { onDelete: "set null" }),
  qty: numeric("qty", { precision: 14, scale: 2 }).notNull().default("0"),
  qty2: numeric("qty2", { precision: 14, scale: 2 }),
  satuan2: text("satuan2"),
});

export const suratJalanMasukRelations = relations(suratJalanMasuk, ({ one, many }) => ({
  customer: one(customers, { fields: [suratJalanMasuk.customerId], references: [customers.id] }),
  items: many(suratJalanMasukItems),
}));
export const suratJalanMasukItemsRelations = relations(suratJalanMasukItems, ({ one }) => ({
  suratJalanMasuk: one(suratJalanMasuk, { fields: [suratJalanMasukItems.suratJalanMasukId], references: [suratJalanMasuk.id] }),
  rawMaterial: one(rawMaterials, { fields: [suratJalanMasukItems.rawMaterialId], references: [rawMaterials.id] }),
}));
