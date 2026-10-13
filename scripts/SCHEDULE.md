# Setup Backup Otomatis Harian (Windows Task Scheduler)

Supaya database ter-backup sendiri setiap hari tanpa perlu diingat-ingat manual.

## 1. Tes dulu backup manual
Buka PowerShell di folder project (`D:\mtp-app` atau lokasi Anda), lalu:
```
powershell -ExecutionPolicy Bypass -File scripts\backup-db.ps1
```
Kalau berhasil, akan muncul file baru di folder `backups\` dengan nama seperti
`mtp-mtp_dev-2026-09-21_030000.backup`.

## 2. Buat jadwal otomatis
1. Buka **Task Scheduler** (cari di Start Menu: "Task Scheduler" / "Penjadwal Tugas").
2. Klik **Create Basic Task...** di panel kanan.
3. **Name**: `Backup MTP Database` → Next.
4. **Trigger**: pilih **Daily** → Next → atur jam (sarankan tengah malam / jam sepi, misal 02:00) → Next.
5. **Action**: pilih **Start a program** → Next.
6. **Program/script**: isi `powershell.exe`
7. **Add arguments**: isi
   ```
   -ExecutionPolicy Bypass -File "D:\mtp-app\scripts\backup-db.ps1"
   ```
   (sesuaikan `D:\mtp-app` dengan lokasi folder project Anda yang sebenarnya)
8. Klik **Finish**.
9. Cari task "Backup MTP Database" di daftar, klik kanan → **Run** untuk tes sekali,
   pastikan file backup baru muncul di folder `backups\`.

## 3. (Sangat disarankan) Simpan salinan backup di luar komputer server
Folder `backups\` ini tetap ada di komputer/server yang sama — kalau komputernya
rusak/kena ransomware/hilang, backup-nya ikut hilang juga. Idealnya salinan backup
juga disimpan di tempat lain, misalnya:
- Sinkron folder `backups\` ke Google Drive / OneDrive (install aplikasi desktop-nya,
  arahkan folder sync ke folder `backups\` ini)
- Atau copy manual ke flashdisk/hardisk eksternal secara berkala

## 4. Cara restore kalau suatu saat perlu
```
powershell -ExecutionPolicy Bypass -File scripts\restore-db.ps1 -BackupFile "backups\mtp-mtp_dev-2026-09-21_030000.backup"
```
Ini akan **menimpa** data yang sedang ada di database dengan isi backup tersebut,
jadi hanya dipakai kalau memang perlu pulihkan dari backup (misal data rusak/salah hapus).
