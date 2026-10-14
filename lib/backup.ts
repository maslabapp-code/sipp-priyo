import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const BACKUP_DIR = path.join(process.cwd(), "backups");
const RETENTION_DAYS = 30;

export type BackupFile = { filename: string; sizeBytes: number; createdAt: string };

function parseDbUrl(url: string) {
  const m = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:/]+):(\d+)\/([^?]+)/);
  if (!m) throw new Error("DATABASE_URL tidak valid, cek isi file .env");
  const [, user, password, host, port, database] = m;
  return { user, password, host, port, database };
}

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

/** Hanya izinkan nama file backup yang valid, untuk mencegah path traversal. */
export function backupFilePath(filename: string): string {
  if (!/^[a-zA-Z0-9_.-]+\.backup$/.test(filename)) {
    throw new Error("Nama file backup tidak valid");
  }
  const full = path.join(BACKUP_DIR, filename);
  if (!full.startsWith(BACKUP_DIR)) {
    throw new Error("Nama file backup tidak valid");
  }
  return full;
}

export function listBackups(): BackupFile[] {
  ensureBackupDir();
  return fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith(".backup"))
    .map((f) => {
      const stat = fs.statSync(path.join(BACKUP_DIR, f));
      return { filename: f, sizeBytes: stat.size, createdAt: stat.mtime.toISOString() };
    })
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function deleteBackup(filename: string) {
  const p = backupFilePath(filename);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

function cleanupOldBackups() {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  for (const b of listBackups()) {
    if (new Date(b.createdAt).getTime() < cutoff) {
      try {
        deleteBackup(b.filename);
      } catch {
        // abaikan, bukan hal kritis
      }
    }
  }
}

/** Jalankan pg_dump dan simpan hasilnya ke folder backups/. */
export function runBackup(): Promise<BackupFile> {
  ensureBackupDir();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL tidak diset di .env");
  const { user, password, host, port, database } = parseDbUrl(databaseUrl);

  const timestamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
  const filename = `mtp-${database}-${timestamp}.backup`;
  const outPath = path.join(BACKUP_DIR, filename);

  // Kalau pg_dump tidak ada di PATH, set PG_DUMP_PATH di .env, contoh:
  // PG_DUMP_PATH="C:\Program Files\PostgreSQL\16\bin\pg_dump.exe"
  const pgDumpPath = process.env.PG_DUMP_PATH || "pg_dump";

  return new Promise((resolve, reject) => {
    const child = spawn(/* turbopackIgnore: true */ pgDumpPath, ["-h", host, "-p", port, "-U", user, "-F", "c", "-f", outPath, database], {
      env: { ...process.env, PGPASSWORD: password },
    });

    let stderr = "";
    child.stderr.on("data", (d) => (stderr += d.toString()));

    child.on("error", (err) => {
      reject(
        new Error(
          `Gagal menjalankan pg_dump: ${err.message}. Pastikan PostgreSQL sudah terinstall dan pg_dump ada di PATH, atau set PG_DUMP_PATH di file .env.`
        )
      );
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`pg_dump gagal (kode ${code}): ${stderr || "tidak ada detail error"}`));
        return;
      }
      cleanupOldBackups();
      const stat = fs.statSync(outPath);
      resolve({ filename, sizeBytes: stat.size, createdAt: stat.mtime.toISOString() });
    });
  });
}
