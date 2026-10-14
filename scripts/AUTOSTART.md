# Setup Auto-Jalan Saat Laptop Nyala

Supaya aplikasi otomatis running di background begitu laptop dinyalakan/login —
user tinggal buka browser, tidak perlu buka CMD atau ketik perintah apa pun.

## 1. Build dulu (sekali, atau tiap ada update kode)
Ini WAJIB dilakukan minimal sekali sebelum lanjut ke langkah berikutnya, dan setiap
kali ada update kode dari saya:
```
npm run build
```

## 2. Tes manual dulu sebelum dijadwalkan
Coba jalankan dulu untuk pastikan tidak ada error:
- Klik dua kali `scripts\start-app-hidden.vbs`
- Tidak akan muncul jendela apa pun (memang sengaja disembunyikan) — tunggu sekitar
  5-10 detik, lalu buka browser ke `http://localhost:3000`, pastikan aplikasi terbuka.
- Untuk menghentikannya, buka **Task Manager** (Ctrl+Shift+Esc) → tab **Details** →
  cari proses `node.exe` → **End task**.

Kalau langkah ini berhasil, lanjut ke setup otomatis di bawah.

## 3. Jadwalkan otomatis jalan saat login (Task Scheduler)
1. Buka **Task Scheduler** (cari di Start Menu).
2. Klik **Create Basic Task...** di panel kanan.
3. **Name**: `Jalankan Aplikasi MTP` → Next.
4. **Trigger**: pilih **When I log on** → Next.
5. **Action**: pilih **Start a program** → Next.
6. **Program/script**: klik **Browse...**, pilih file
   `wscript.exe` (biasanya ada di `C:\Windows\System32\wscript.exe`)
7. **Add arguments**: isi dengan path lengkap ke file vbs, contoh:
   ```
   "D:\mtp-app\scripts\start-app-hidden.vbs"
   ```
   (sesuaikan `D:\mtp-app` dengan lokasi folder project sebenarnya)
8. Klik **Finish**.
9. Cari task **"Jalankan Aplikasi MTP"** di daftar tengah, klik kanan → **Properties**.
   Di tab **General**, centang **"Run whether user is logged on or not"** kalau mau
   aplikasi tetap jalan meski belum ada yang login sama sekali (opsional — kalau
   dicentang, nanti akan diminta masukkan password Windows user itu sekali).
10. Klik kanan task tadi → **Run** untuk tes. Tunggu beberapa detik, buka browser ke
    `http://localhost:3000`, pastikan aplikasi terbuka.
11. **Restart laptop** untuk memastikan benar-benar jalan otomatis dari awal boot.

## 4. Siapkan jalan pintas untuk buka aplikasinya
Supaya user tidak perlu ingat-ingat alamat `localhost:3000`:
- Copy file `scripts\Buka Aplikasi MTP.url` ke **Desktop**.
- Klik dua kali kapan saja untuk buka aplikasi di browser default.
- (Boleh juga di-pin ke Taskbar biar makin gampang diakses.)

## Menghentikan aplikasi (misalnya sebelum update/build ulang)
Klik dua kali `scripts\stop-app.bat` — otomatis mencari dan mematikan proses yang sedang
memakai port 3000 (lebih aman daripada mematikan semua `node.exe` lewat Task Manager,
kalau-kalau ada aplikasi Node lain yang kebetulan jalan di komputer yang sama).

## Troubleshooting
- **Browser bilang "tidak bisa terhubung"** → server belum selesai nyala, tunggu
  10-15 detik lagi setelah laptop nyala/login, lalu refresh. Kalau tetap gagal,
  cek Task Scheduler apakah task-nya sukses jalan (klik kanan task → lihat kolom
  **Last Run Result**, harus `0x0`).
- **Setelah update kode dari saya** → wajib `npm run build` ulang dulu. Urutannya:
  1. Klik dua kali `scripts\stop-app.bat` untuk matikan server yang sedang jalan.
  2. Timpa file project dengan yang baru.
  3. Jalankan `npm run build` di folder project.
  4. Klik dua kali `scripts\start-app-hidden.vbs` lagi (atau jalankan task-nya lewat Task Scheduler).
- **Mau lihat log/error server** → buka `scripts\start-app.bat` langsung (bukan yang
  `-hidden.vbs`) dengan cara klik dua kali; kali ini jendela CMD akan tetap terbuka
  dan menampilkan log, berguna untuk debug kalau ada masalah.
