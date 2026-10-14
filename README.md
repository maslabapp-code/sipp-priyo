# SIPP v34 — Sistem Informasi Produksi & Pengiriman (MTP)

Sistem tracking stok, PO, kirim, dan penjualan material, menggantikan pencatatan manual di Excel.

## Fase 1 (sudah tersedia)
- Master Customer
- Master Part
- Transaksi Bulanan (Stock, PO Act, PO CPL 1/2/3, Harga Jual — semua field lain dihitung otomatis: Total PO, Kirim, Sisa PO, Actual Penjualan, PPN 10%, Total Penjualan)
- Kirim harian per tanggal (klik angka "Kirim" di tabel untuk buka kalender)

---

## 1. Yang perlu di-install di komputer/server (sekali saja)

### a. Node.js (versi 20 ke atas)
Download dan install dari: https://nodejs.org (pilih versi **LTS**)

Cek sudah terpasang dengan membuka Command Prompt / Terminal:
```
node -v
npm -v
```

### b. PostgreSQL
Download dan install dari: https://www.postgresql.org/download/

Saat instalasi, akan diminta membuat **password untuk user `postgres`** — catat password ini, nanti dipakai di langkah 3.

Setelah terinstall, buat database baru bernama `mtp_dev`. Caranya, buka **pgAdmin** (ikut ter-install bareng PostgreSQL) atau lewat terminal:
```
psql -U postgres
CREATE DATABASE mtp_dev;
\q
```

---

## 2. Install project

1. Ambil project ini ke lokasi yang guru mau (misal `D:\mtp-app`), pilih salah satu:
   - **Dari GitHub:** `git clone <URL-REPOSITORY> D:\mtp-app`
   - **Dari zip:** ekstrak foldernya ke lokasi tersebut.
2. Buka Command Prompt / Terminal, masuk ke folder tersebut:
   ```
   cd D:\mtp-app
   ```
3. Install semua library yang dibutuhkan:
   ```
   npm install
   ```
   (Proses ini butuh koneksi internet, sekali saja di awal.)

---

## 3. Atur koneksi database

File **`.env`** tidak ikut ke GitHub (berisi password), jadi buat sendiri dari contohnya. Di folder project jalankan:

```
copy .env.example .env
```

Lalu buka file **`.env`** pakai Notepad, sesuaikan dengan password PostgreSQL guru:

```
DATABASE_URL="postgresql://postgres:PASSWORD_POSTGRES_GURU@localhost:5432/mtp_dev?schema=public"
```

Ganti `PASSWORD_POSTGRES_GURU` dengan password yang dibuat saat instalasi PostgreSQL tadi.

**Wajib (v34):** tambahkan juga akun login admin di `.env` (contoh lengkapnya ada di `.env.example`):
```
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="passwordkuat123"
AUTH_SECRET="teks-acak-minimal-16-karakter"
```

**Opsional** — kalau nanti fitur Backup Database (lihat bagian 7) muncul error "gagal menjalankan pg_dump", tambahkan baris ini juga di `.env` (sesuaikan versi PostgreSQL-nya):
```
PG_DUMP_PATH="C:\Program Files\PostgreSQL\16\bin\pg_dump.exe"
```

---

## 4. Buat tabel di database (sekali saja, atau setiap kali ada perubahan skema)

```
npx drizzle-kit push
```

Kalau sukses akan muncul tulisan `[✓] Changes applied`.

> **Wajib dijalankan lagi setiap kali ada update aplikasi yang mengubah skema** (misalnya v25:
> kolom Jenis Material, kolom No. SJ pada kedatangan material, Jenis SJ P/J/W, tabel Surat Jalan Masuk,
> v26: kolom bahan baku dan konversi pada Master Part, dan v27: kolom sumber/keterangan pada kedatangan bahan baku, v28: kolom asal potong pada pemakaian bahan baku). v29 tidak mengubah database. v30 menambah dua kolom di bahan baku (spesifikasi dan ukuran): jalankan `npx drizzle-kit push`, atau pakai `update-skema-v30.sql` kalau push macet. v31, v32, dan v33 tidak mengubah database (tidak perlu `drizzle-kit push`).
> Kalau lupa, halaman akan error seperti `column "jenis" does not exist` atau `relation "surat_jalan_masuk" does not exist`.
> Data lama tidak hilang: kolom baru otomatis berisi nilai awal (Jenis Material = Lembaran, Jenis SJ = P).

---

## 5. Jalankan aplikasi

**Mode pengembangan** (untuk sambil edit-edit):
```
npm run dev
```

**Mode produksi** (lebih cepat & stabil, dipakai sehari-hari):
```
npm run build
npm run start
```

> **Penting:** `npm run start` hanya bisa jalan kalau `npm run build` sudah pernah sukses
> (folder `.next` harus ada). Setiap kali ada update kode / folder project ditimpa,
> **matikan server lama dulu**, lalu jalankan `npm run build` ulang sebelum `npm run start`.
> Kalau tampilan jadi polos/berantakan atau server tidak mau jalan, lihat
> **bagian 8 (Troubleshooting)** di bawah.

Setelah jalan, buka browser (Chrome/Edge) ke:
```
http://localhost:3000
```

Kalau mau diakses dari komputer lain di jaringan kantor yang sama, cari IP komputer/server ini (`ipconfig` di Command Prompt, lihat "IPv4 Address"), lalu dari komputer lain buka:
```
http://[IP-KOMPUTER-SERVER]:3000
```

---


### Yang baru di v34: Login Admin
- Semua halaman dan API sekarang **wajib login**. Hanya ada **satu role: Admin** (semua pengguna memakai akun yang sama).
- Username dan password diatur di file `.env` (`ADMIN_USERNAME`, `ADMIN_PASSWORD`, `AUTH_SECRET`). **Tidak ada perubahan database**, jadi tidak perlu `drizzle-kit push` untuk v34.
- Setelah mengisi/mengubah `.env`, **restart aplikasi**. Mengganti password otomatis membuat semua sesi lama keluar.
- Sesi berlaku 7 hari. Tombol **Keluar** ada di bagian bawah sidebar.
- Salah password 5 kali berturut-turut dari satu IP akan dikunci 15 menit.
- Kalau `.env` belum berisi tiga nilai di atas, login ditolak (aplikasi tidak terbuka tanpa login).
- Panduan memasang di VPS: lihat `docs/PANDUAN-DEPLOY-VPS.md`.

### Yang baru di v25 sampai v33
- **Surat Jalan Masuk**: catat SJ material dari customer (mis. CPL). Setiap baris otomatis menjadi kedatangan di Stok Bahan Baku, lengkap dengan No. SJ dan ukuran kedua (jumlah pita/lembar).
- **Surat Jalan Keluar**: pilih Jenis SJ (P produksi, J jasa, W WIP). Nomor otomatis berformat `0555P/GKM/SJ/IX/26`, tiap jenis punya urutan sendiri dan mulai dari 1 lagi tiap tahun. Kalau item lebih dari 13 baris, SJ dipecah otomatis menjadi beberapa SJ dengan nomor berbeda.
- **Master Part (v26)**: tiap part sekarang punya bahan baku, satuan potong, pcs per unit, bruto, netto, lebar potong, dan berat per unit. Konversi ini dikunci di master, jadi admin tidak mengetik konversi lagi saat potong.
- **Impor Master Material (v26)**: di Master Part klik **Impor Master Material**. Sistem mengusulkan pasangan antara part dan baris file master Bule Rita (139 baris). Cek yang berstatus **Cek** (kuning), pilih manual yang belum ada pasangan, lalu klik **Hubungkan**. Bahan baku baru (sekitar 46 jenis) dibuat otomatis di Master Bahan Baku. Bisa diulang kapan saja; part yang sudah punya bahan baku dilewati kecuali dipilih ulang.
- **Produksi (v26)**: di detail part, bahan baku, satuan, dan konversi terisi otomatis dari Master Part. Stok dikurangi otomatis dari kedatangan terlama yang masih ada sisa. Bisa diganti lewat tombol **Ganti kedatangan**. Kalau stok kurang atau belum ada SJ Masuk, muncul peringatan.
- **Data antar tab dan antar komputer ter-update otomatis (v33)**: sebelumnya tiap menu hanya mengambil data sekali saat pertama dibuka, sehingga customer baru belum muncul di Master Part sebelum tab ditutup dan dibuka lagi. Sekarang tab yang diaktifkan memuat ulang datanya secara diam-diam kalau ada simpan/ubah/hapus sejak terakhir dimuat (atau datanya lebih tua dari 60 detik). Perubahan dari komputer lain dicek tiap 20 detik lewat `/api/data-version` (token dari statistik PostgreSQL, tidak menambah tabel) dan tab yang sedang aktif ikut diperbarui, ditunda selagi sedang mengetik. Filter, scroll, dan form yang belum disimpan tidak terganggu. Kode ada di `components/layout/DataSync.tsx`; menu baru cukup memanggil `useAutoRefresh(() => load(true))`.
- **Transaksi Bulanan: semua part tampil otomatis (v32)**: nama barang tidak perlu dipilih satu per satu lagi. Semua part dari Master Part muncul sebagai baris di bulan mana pun (harga dari Master Part), dan baris baru baru disimpan ke database **saat pertama kali diisi** (stock, No. PO, PO, atau kirim harian). Part yang belum diisi tidak membuat data. Ada pilihan **Part: Semua / Sudah ada transaksi** untuk menyaring tampilan. Tombol "Kosongkan" (x) menghapus isian part itu di bulan tersebut, part tetap ada di Master Part. Jadwal Customer dan menu lain tetap hanya membaca baris yang sudah tersimpan.
- **Transaksi Bulanan: kolom tanggal lebih terlihat (v32)**: kolom tanggal lebih ramping (56 px) dan header menampilkan nama hari; Minggu berwarna merah, hari ini berwarna biru. Ada pilihan **Kolom: Fokus tanggal / Lengkap**. Mode Fokus tanggal (bawaan) hanya membekukan Nama Barang, Stock, Total PO, Kirim, dan Sisa PO sehingga tanggal punya ruang di layar biasa tanpa zoom out; mode Lengkap menampilkan semua kolom seperti sebelumnya. Pilihan diingat per browser.
- **Menu Invoice (v31)**: pilih customer dan rentang tanggal, centang Surat Jalan Keluar yang ditagih, lalu sistem menggabungkan item per part (qty dijumlah per SJ, harga dari Master Part) ke kelompok **Part Jadi / WIP / DNP / Jasa**. Harga bisa diubah per invoice, PPN default 11%, terbilang otomatis. Hasilnya diunduh sebagai file Excel dengan susunan invoice lama (kolom Qty berisi penjumlahan seperti `=400+400`). Kelompok ditentukan dari Jenis SJ (P = Jadi, W = WIP, J = Jasa); part berkategori DNP masuk Part DNP.
- **Perbaikan Master Customer (v31)**: tombol **+ Tambah Customer** sekarang membuka kotak isian nama (sebelumnya selalu mengirim "Customer Baru", sehingga gagal diam-diam begitu sudah ada satu). Pesan error (mis. nama sudah ada) tampil di layar, dan mengganti nama menjadi nama yang sudah dipakai ditolak dengan pesan jelas.
- **Dropdown tidak lagi tertutup card (v30)**: daftar dropdown digambar di lapisan paling atas halaman, otomatis naik ke atas kalau ruang di bawah kurang, dan ikut bergeser saat area di dalam card digulir.
- **Bahan baku = spesifikasi + ukuran (v30)**: Master Bahan Baku punya kolom **Spesifikasi** (contoh SPCC SD), **Ukuran** (tebal x lebar, contoh 1.6 x 113), dan **Dipakai part**. Popup tambah bahan baku meminta spesifikasi dan ukuran, lalu menyusun nama otomatis, contoh `SPCC SD 1.6 x 113 (Coil)`.
- **SJ Masuk cukup ketik qty (v30)**: satu kolom qty yang mengikuti jenis bahan baku: lembaran = jumlah lembar, sheet/pita = jumlah pita, coil dan as/kawat = Kg, WIP/nut/wiremesh = pcs. Kg tagihan opsional untuk lembaran dan pita. **Perkiraan total pcs muncul otomatis per part** yang terhubung ke bahan baku itu. Konversi disimpan per part (bukan per bahan baku), karena bahan baku yang sama bisa dipakai part dengan konversi berbeda.
- **Impor Master Material memakai file DATA PART (v30)**: 183 baris part, 154 di antaranya punya spesifikasi dan ukuran (125 bahan baku unik). Bahan baku lama yang namanya berbeda tidak otomatis dihapus; rapikan manual di Master Bahan Baku setelah impor.
- **Tambah data langsung dari dropdown (v29)**: kalau customer, bahan baku, atau kategori belum ada di dropdown, ketik namanya lalu pilih **+ Tambah ... baru** di bagian bawah daftar. Muncul popup kecil; setelah disimpan, datanya otomatis terpilih dan **juga tersimpan di menu master**. Nama yang sudah ada atau mirip ditampilkan sebagai peringatan supaya tidak dobel. Tersedia di Surat Jalan Masuk, Surat Jalan Keluar, Master Part (customer, kategori, bahan baku), dan Stok Awal. Dropdown filter di kepala tabel sengaja tidak diberi opsi tambah.
- **Stok kurang dibagi otomatis (v28)**: kalau qty potong melebihi sisa sebuah kedatangan, sisanya otomatis diambil dari kedatangan berikutnya (terlama dulu). Kalau semua kedatangan habis, kekurangan dibebankan ke kedatangan terakhir sehingga sisanya minus dan muncul peringatan. Di **Stok Bahan Baku → Detail**, tiap pemakaian bisa **dipindah** ke kedatangan lain dari bahan baku yang sama, dan kedatangan yang minus punya tombol **Kompensasi otomatis** (memindahkan pemakaian terbaru ke kedatangan lain yang masih ada sisa).
- **Dashboard (v28)**: menampilkan **Delivery Bulan Ini** (persen terkirim dibanding total PO), grafik **Delivery per Bulan** (6 bulan) dan **Delivery per Customer**. Harga jual dan omzet **tidak lagi tampil** di Dashboard maupun export-nya. Datanya tetap tersedia di `/api/dashboard/omzet` untuk tampilan Admin saat login dipasang.
- **Stok Bahan Baku satu pintu (v27)**: kedatangan hanya masuk lewat **Surat Jalan Masuk**, dan pemakaian hanya tercatat otomatis dari **Produksi**. Form tambah kedatangan manual diganti tombol **+ Stok Awal / Koreksi** (untuk stok saat mulai memakai aplikasi atau koreksi hasil hitung fisik) yang **wajib berisi keterangan** dan tampil sebagai "Stok Awal / Koreksi". Detail pemakaian sekarang hanya-lihat. Stok yang sudah dipakai produksi tidak bisa dihapus, dan kedatangan dari SJ Masuk hanya bisa dihapus lewat menu SJ Masuk.
- **Stok Bahan Baku (v26)**: sisa stok dihitung dalam satuan produksi (pita/lembar, atau Kg untuk coil). Kg tampil sebagai perkiraan (≈). Untuk lembaran dan sheet/pita, jumlah pita/lembar **wajib** diisi di SJ Masuk.
- **Master Bahan Baku**: kolom Jenis Material (lembaran, coil, sheet/pitaan, as/kawat, WIP, nut square, wiremesh). Satuan tagihan otomatis Kg atau pcs.

---

## 6. Supaya otomatis jalan tiap komputer/laptop nyala (tanpa buka CMD)

Supaya user tinggal buka laptop dan aplikasinya sudah jalan sendiri di background —
tidak perlu ketik perintah apa pun. Ikuti panduan lengkap di
[`scripts/AUTOSTART.md`](scripts/AUTOSTART.md) (setup sekali saja, pakai Windows Task Scheduler).

---

## 7. Backup Database

### a. Backup manual lewat aplikasi (paling gampang)
1. Buka aplikasi di browser, klik menu **"Backup Database"** di sidebar (paling bawah).
2. Klik tombol **"Backup Sekarang"** — tunggu beberapa detik sampai muncul di daftar.
3. Untuk simpan salinannya ke komputer/laptop yang sedang dipakai, klik **"Unduh"** di baris file backup tersebut.
4. Kalau ada backup lama yang mau dibuang, klik **"Hapus"** di baris file itu.

### b. Backup otomatis terjadwal (disarankan, sekali setup saja)
Supaya database ter-backup sendiri tiap hari tanpa perlu diingat-ingat, ikuti panduan lengkap di
[`scripts/SCHEDULE.md`](scripts/SCHEDULE.md) — pakai **Windows Task Scheduler**, cukup setup sekali.

File backup otomatis maupun manual tersimpan di folder `backups/` di dalam folder project,
dan otomatis dihapus kalau sudah lebih dari 30 hari (biar tidak memenuhi disk).

### c. Kalau perlu restore dari backup
Dilakukan lewat terminal (bukan dari aplikasi web, karena berisiko menimpa data), lihat langkah
di bagian bawah [`scripts/SCHEDULE.md`](scripts/SCHEDULE.md).

---

## 8. Troubleshooting (kalau ada masalah saat menjalankan aplikasi)

### a. Start gagal: "Could not find a production build in the '.next' directory"
Artinya aplikasi belum di-build. `npm run start` (dan `scripts\start-app.bat`) butuh hasil build.
Jalankan sekali:
```
npm install
npm run build
npm run start
```
Ulangi `npm run build` setiap ada update kode.

### b. Tampilan polos/berantakan (tanpa warna, tombol & kotak mentah), padahal `npm run dev` normal
**Gejala:** halaman muncul tapi tanpa gaya (CSS). Di browser tekan **F12 → Console / Network**,
akan terlihat error seperti:
```
GET http://localhost:3000/_next/static/chunks/xxxxx.css  404 (Not Found)
GET http://localhost:3000/_next/static/chunks/xxxxx.js   404 (Not Found)
```

**Penyebab:** masih ada **server lama yang jalan di port 3000** (proses `node.exe` dari
sesi sebelumnya, atau dari Task Scheduler). Server lama itu masih menyajikan halaman dari build
lama, sedangkan file CSS/JS-nya sudah diganti oleh `npm run build` yang baru — sehingga
nama filenya tidak cocok (404). Ini bukan bug di kode aplikasi.

**Cara memperbaiki (urut, jangan dilompati):**

1. **Cek siapa yang memakai port 3000:**
   ```
   netstat -ano | findstr :3000
   ```
   Cari baris yang berstatus `LISTENING`, catat angka **PID** di kolom paling kanan.
   (Baris `TIME_WAIT` / `CLOSE_WAIT` / `FIN_WAIT_2` boleh diabaikan.)

2. **Matikan proses itu:**
   ```
   taskkill /F /PID <nomor PID>
   ```
   Kalau muncul **"Access is denied"**, proses itu jalan dengan hak akses lebih tinggi
   (biasanya dari Task Scheduler). Buka Command Prompt dengan **Run as administrator**
   (klik kanan → Run as administrator), lalu ulangi perintah di atas. Alternatif: Task Manager
   (dibuka sebagai administrator) → tab **Details** → cari PID-nya → klik kanan → **End task**.

   Atau cukup jalankan `scripts\stop-app.bat`.

3. **Pastikan port sudah kosong** (tidak boleh ada lagi baris `LISTENING`):
   ```
   netstat -ano | findstr :3000
   ```

4. **Hapus build lama dan build ulang:**
   ```
   rmdir /s /q .next
   npm run build
   ```
   Tunggu sampai selesai tanpa error merah.

5. **Start sekali saja** di satu jendela Command Prompt:
   ```
   npm run start
   ```

6. **Bersihkan cache browser:** buka `http://localhost:3000` di jendela **Incognito**,
   atau tekan **Ctrl + Shift + R**.

> **Kalau memakai Task Scheduler (bagian 6):** sebelum update aplikasi, hentikan dulu
> task **Jalankan Aplikasi MTP** (klik kanan → **End**) atau jalankan `scripts\stop-app.bat`,
> lalu build ulang, baru jalankan task-nya lagi. Kalau proses lama tidak bisa dimatikan,
> **Disable** task-nya dulu sementara, matikan prosesnya, build, tes manual, lalu **Enable** lagi.

### c. Port 3000 dipakai aplikasi lain (`EADDRINUSE`)
Matikan proses yang memakai port 3000 (langkah b.1–b.3), atau jalankan di port lain:
```
npx next start -p 3100
```
lalu buka `http://localhost:3100`. (Kalau ganti port, sesuaikan juga `start-app.bat` dan
shortcut `Buka Aplikasi MTP.url`.)

### d. `npm` / `node` tidak dikenali
Node.js belum terpasang atau belum masuk PATH. Install ulang dari https://nodejs.org (versi LTS),
tutup lalu buka lagi Command Prompt, cek dengan `node -v`. Ini juga bisa terjadi kalau task
di Task Scheduler jalan sebagai user yang berbeda.

### e. Server jalan tapi halaman error saat membuka data
Kemungkinan PostgreSQL belum jalan atau password di `.env` salah. Cek service PostgreSQL di
`services.msc` (harus **Running**), dan pastikan `DATABASE_URL` di `.env` sesuai (bagian 3).

### f. Build sering error / tidak stabil, atau file terkunci
Kalau folder project berada di dalam **OneDrive** (misal `Desktop` atau `Documents`),
sinkronisasi OneDrive bisa mengunci atau menunda file di `.next` dan `node_modules`
(puluhan ribu file yang sering berubah). **Sebaiknya letakkan project di luar OneDrive**,
misalnya `C:\mtp-app` atau `D:\mtp-app`. Kalau terpaksa di OneDrive, pause sinkronisasi saat build.

### g00. `npx drizzle-kit push` macet (tidak selesai lebih dari 2 menit)
Penyebab yang paling sering: PostgreSQL tidak aktif atau tidak terjangkau, `.env` menunjuk database yang salah (mis. `.env` tertimpa dari zip), atau pertanyaan interaktif tidak terlihat di jendela CMD lama. Coba: Ctrl+C, pastikan service PostgreSQL **Running**, cek `DATABASE_URL` di `.env`, lalu jalankan lagi di **PowerShell/Windows Terminal**.
Kalau tetap macet, pakai cara manual: buka **pgAdmin → database `mtp_dev` → Tools → Query Tool**, buka file `scripts\update-skema-v28.sql`, lalu tekan **F5**. File itu aman dijalankan berulang dan tidak menghapus data. Setelah sukses, lanjut `npm run build`.

### g0. Error `column ... does not exist` / `relation ... does not exist` setelah update
Skema database belum diperbarui. Matikan server, jalankan `npx drizzle-kit push`, lalu `npm run build` dan `npm run start`.

### g. Ingin melihat error asli saat start
`start-app-hidden.vbs` menyembunyikan jendela CMD sehingga error tidak terlihat. Untuk debug,
klik dua kali `scripts\start-app.bat` supaya jendela tetap terbuka dan pesan error bisa dibaca.

---

## 9. Catatan untuk GitHub

- **Jangan pernah meng-commit file `.env` dan folder `backups/`.** Keduanya sudah masuk `.gitignore`. `.env` berisi password database, `backups/` berisi seluruh data perusahaan.
- Gunakan repository **Private**. Kode ini memuat data perusahaan: nama, alamat, dan nomor rekening di `lib/invoice-const.ts`, serta data master part/bahan baku di `lib/master-material-data.ts`.
- Kalau `.env` atau file backup sempat ter-commit, menghapusnya di commit berikutnya **tidak cukup** karena masih ada di riwayat. Ganti password PostgreSQL dan hapus riwayatnya.
- `node_modules/`, `.next/`, dan `next-env.d.ts` dibuat otomatis (`npm install`, `npm run build`), jadi tidak disimpan di GitHub.
- Setelah `git clone` di komputer lain, urutannya: `npm install`, salin `.env.example` menjadi `.env`, `npx drizzle-kit push`, `npm run build`, `npm run start`.

### Cara upload (push) pertama kali ke GitHub

1. **Pasang Git** dari https://git-scm.com (Git for Windows, pilihan bawaan). Cek dengan `git --version`. Siapkan akun GitHub (gratis) di https://github.com.
2. **Atur nama dan email Git** (sekali saja, email sama dengan akun GitHub):
   ```
   git config --global user.name "Nama Anda"
   git config --global user.email "email-github@contoh.com"
   ```
3. **Buat repository di GitHub:** klik tanda **+** (kanan atas) → **New repository**. Isi nama (misal `mtp-app`), pilih **Private**. **Jangan** centang Add README, .gitignore, atau license (project ini sudah punya). Klik **Create repository**, lalu salin URL-nya (berakhiran `.git`).
4. **Masuk ke folder project** lewat Command Prompt, misal `cd D:\sipp_guru`.
5. **Inisialisasi dan cek file yang akan diunggah:**
   ```
   git init
   git add .
   git status
   ```
   Periksa daftar hijau: `.env`, folder `backups`, `node_modules`, dan `.next` **tidak boleh muncul**. Kalau muncul, jangan lanjut, cek isi `.gitignore`.
6. **Commit:**
   ```
   git commit -m "MTP App v33"
   git branch -M main
   ```
7. **Hubungkan ke GitHub dan push:**
   ```
   git remote add origin https://github.com/USERNAME/mtp-app.git
   git push -u origin main
   ```
   Ganti URL dengan milik Anda dari langkah 3. Akan muncul jendela login GitHub di browser, masuk lalu izinkan. Kalau terminal meminta password, GitHub tidak menerima password akun: buat **Personal Access Token** di GitHub (Settings → Developer settings → Personal access tokens) dan pakai token itu sebagai password.
8. **Cek hasilnya:** refresh halaman repository di GitHub, semua file harus muncul dan tidak ada `.env`.

> **Alternatif tanpa perintah:** pakai aplikasi **GitHub Desktop** (https://desktop.github.com). File → Add local repository → pilih folder project → Commit → **Publish repository** (centang **Keep this code private**).

### Cara update berikutnya (v34 dan seterusnya)

Timpa file project dengan versi baru (jangan hapus folder `.git` dan file `.env`), lalu:
```
git add .
git status
git commit -m "v34: keterangan perubahan"
git push
```
Kalau komputer lain sudah memakai project ini lewat `git clone`, cukup `git pull`, lalu jalankan `npx drizzle-kit push` bila catatan versi menyebut ada perubahan database, kemudian `npm run build` dan `npm run start` ulang.

---

## Struktur data ringkas

- **Customer** → pelanggan
- **Part** → master barang, terhubung ke Customer
- **Transaksi Bulanan** → 1 baris = 1 Part di 1 Bulan+Tahun, isi Stock/PO Act/PO CPL 1-3/Harga Jual
- **Kirim Harian** → rincian tanggal & qty kirim, dijumlah otomatis jadi "Kirim" di Transaksi Bulanan

## Rumus otomatis
- Total PO = PO CPL 1 + PO CPL 2 + PO CPL 3
- Sisa PO = Total PO − Kirim
- Actual Penjualan = Kirim × Harga Jual
- PPN 10% = Actual Penjualan × 10%
- Total Penjualan = Total PO × Harga Jual
