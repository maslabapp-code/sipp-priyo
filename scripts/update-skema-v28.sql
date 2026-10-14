-- ============================================================
--  Update skema database MTP ke v28 (cara manual)
--  Pakai ini kalau "npx drizzle-kit push" macet atau gagal.
--  Aman dijalankan berulang kali (memakai IF NOT EXISTS).
--  Data lama tidak dihapus.
--
--  Cara pakai:
--   1. Buka pgAdmin -> klik database "mtp_dev" -> menu Tools -> Query Tool
--   2. Buka file ini (ikon folder) atau salin seluruh isinya ke kotak query
--   3. Tekan F5 (Execute). Harus muncul "Query returned successfully".
-- ============================================================

BEGIN;

-- v25: jenis material dan ukuran kedua pada kedatangan bahan baku
ALTER TABLE raw_materials
  ADD COLUMN IF NOT EXISTS jenis text NOT NULL DEFAULT 'lembaran';

ALTER TABLE raw_material_batches
  ADD COLUMN IF NOT EXISTS qty2 numeric(14,2),
  ADD COLUMN IF NOT EXISTS satuan2 text,
  ADD COLUMN IF NOT EXISTS no_sj text,
  ADD COLUMN IF NOT EXISTS customer_id text REFERENCES customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS surat_jalan_masuk_id text;

-- v25: jenis SJ keluar (P produksi, J jasa, W WIP)
ALTER TABLE surat_jalan
  ADD COLUMN IF NOT EXISTS jenis text NOT NULL DEFAULT 'P';

-- v25: Surat Jalan Masuk
CREATE TABLE IF NOT EXISTS surat_jalan_masuk (
  id text PRIMARY KEY,
  no_sj text NOT NULL UNIQUE,
  customer_id text REFERENCES customers(id) ON DELETE SET NULL,
  tanggal timestamp NOT NULL,
  no_po text,
  catatan text,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS surat_jalan_masuk_items (
  id text PRIMARY KEY,
  surat_jalan_masuk_id text NOT NULL REFERENCES surat_jalan_masuk(id) ON DELETE CASCADE,
  raw_material_id text NOT NULL REFERENCES raw_materials(id) ON DELETE RESTRICT,
  batch_id text REFERENCES raw_material_batches(id) ON DELETE SET NULL,
  qty numeric(14,2) NOT NULL DEFAULT 0,
  qty2 numeric(14,2),
  satuan2 text
);

-- v26: Master Part terhubung ke bahan baku dan konversi
ALTER TABLE parts
  ADD COLUMN IF NOT EXISTS raw_material_id text REFERENCES raw_materials(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS satuan_potong text,
  ADD COLUMN IF NOT EXISTS konversi_pcs numeric(14,4),
  ADD COLUMN IF NOT EXISTS lebar_potong numeric(14,4),
  ADD COLUMN IF NOT EXISTS berat_per_unit numeric(14,4),
  ADD COLUMN IF NOT EXISTS bruto_per_kg numeric(14,4),
  ADD COLUMN IF NOT EXISTS netto_per_kg numeric(14,4);

-- v27: sumber dan keterangan pada kedatangan (SJ Masuk atau Stok Awal / Koreksi)
ALTER TABLE raw_material_batches
  ADD COLUMN IF NOT EXISTS sumber text NOT NULL DEFAULT 'stok_awal',
  ADD COLUMN IF NOT EXISTS catatan text;

-- Kedatangan yang sudah berasal dari SJ Masuk ditandai sj
UPDATE raw_material_batches SET sumber = 'sj' WHERE surat_jalan_masuk_id IS NOT NULL;

-- v28: asal potong pada pemakaian bahan baku (satu potong bisa dibagi ke beberapa kedatangan)
ALTER TABLE raw_material_usages
  ADD COLUMN IF NOT EXISTS production_cut_id text;

COMMIT;
