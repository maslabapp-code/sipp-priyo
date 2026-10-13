# backup-db.ps1
# Backup otomatis database PostgreSQL untuk MTP System.
# Cara pakai manual: buka PowerShell di folder project, jalankan:
#   powershell -ExecutionPolicy Bypass -File scripts\backup-db.ps1
#
# Untuk backup otomatis terjadwal, lihat SCHEDULE.md di folder yang sama.

$ErrorActionPreference = "Stop"

# ── Konfigurasi ──────────────────────────────────────────────
# Lokasi folder backup disimpan (boleh diubah, sebaiknya di drive/partisi
# yang berbeda dari database aslinya, atau folder yang ikut di-backup ke cloud)
$BackupDir = Join-Path $PSScriptRoot "..\backups"

# Berapa hari backup lama disimpan sebelum dihapus otomatis (retensi)
$RetentionDays = 30

# Lokasi pg_dump.exe. Kalau PostgreSQL diinstall di lokasi default, biasanya sudah
# otomatis ketemu lewat PATH. Kalau tidak ketemu, isi manual path lengkapnya di sini,
# contoh: "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe"
$PgDumpPath = "pg_dump"

# ── Baca DATABASE_URL dari file .env ────────────────────────
$EnvFile = Join-Path $PSScriptRoot "..\.env"
if (-not (Test-Path $EnvFile)) {
    Write-Error "File .env tidak ditemukan di $EnvFile"
    exit 1
}

$envLine = Get-Content $EnvFile | Where-Object { $_ -match '^DATABASE_URL=' }
if (-not $envLine) {
    Write-Error "DATABASE_URL tidak ditemukan di file .env"
    exit 1
}

# Parse: DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DBNAME?schema=public"
$raw = $envLine -replace '^DATABASE_URL=', '' -replace '"', ''
if ($raw -notmatch 'postgresql://([^:]+):([^@]+)@([^:/]+):(\d+)/([^?]+)') {
    Write-Error "Format DATABASE_URL tidak dikenali."
    exit 1
}
$DbUser = $Matches[1]
$DbPass = $Matches[2]
$DbHost = $Matches[3]
$DbPort = $Matches[4]
$DbName = $Matches[5]

# ── Jalankan backup ──────────────────────────────────────────
if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
}

$timestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$outFile = Join-Path $BackupDir "mtp-$DbName-$timestamp.backup"

Write-Host "Backup database '$DbName' ke $outFile ..."

$env:PGPASSWORD = $DbPass
try {
    & $PgDumpPath -h $DbHost -p $DbPort -U $DbUser -F c -f $outFile $DbName
    if ($LASTEXITCODE -ne 0) {
        throw "pg_dump keluar dengan kode error $LASTEXITCODE"
    }
    Write-Host "Backup berhasil: $outFile" -ForegroundColor Green
} finally {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}

# ── Hapus backup lama sesuai retensi ─────────────────────────
$cutoff = (Get-Date).AddDays(-$RetentionDays)
Get-ChildItem $BackupDir -Filter "mtp-$DbName-*.backup" |
    Where-Object { $_.LastWriteTime -lt $cutoff } |
    ForEach-Object {
        Write-Host "Menghapus backup lama: $($_.Name)"
        Remove-Item $_.FullName -Force
    }

Write-Host "Selesai."
