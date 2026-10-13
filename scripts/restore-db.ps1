# restore-db.ps1
# Restore database dari file backup hasil backup-db.ps1.
# PERINGATAN: proses ini akan MENIMPA data yang ada di database tujuan.
#
# Cara pakai:
#   powershell -ExecutionPolicy Bypass -File scripts\restore-db.ps1 -BackupFile "backups\mtp-mtp_dev-2026-09-21_030000.backup"

param(
    [Parameter(Mandatory = $true)]
    [string]$BackupFile
)

$ErrorActionPreference = "Stop"

$PgRestorePath = "pg_restore"

if (-not (Test-Path $BackupFile)) {
    Write-Error "File backup tidak ditemukan: $BackupFile"
    exit 1
}

$EnvFile = Join-Path $PSScriptRoot "..\.env"
$envLine = Get-Content $EnvFile | Where-Object { $_ -match '^DATABASE_URL=' }
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

Write-Host "Anda akan me-restore backup ke database '$DbName'." -ForegroundColor Yellow
Write-Host "SEMUA DATA YANG ADA SEKARANG DI DATABASE INI AKAN TERTIMPA." -ForegroundColor Yellow
$confirm = Read-Host "Ketik 'YA' (huruf besar) untuk melanjutkan"
if ($confirm -ne "YA") {
    Write-Host "Dibatalkan."
    exit 0
}

$env:PGPASSWORD = $DbPass
try {
    & $PgRestorePath -h $DbHost -p $DbPort -U $DbUser -d $DbName --clean --if-exists $BackupFile
    if ($LASTEXITCODE -ne 0) {
        throw "pg_restore keluar dengan kode error $LASTEXITCODE"
    }
    Write-Host "Restore selesai." -ForegroundColor Green
} finally {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}
