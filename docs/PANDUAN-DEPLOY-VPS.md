# Panduan Deploy SIPP v34 ke VPS Hostinger KVM 2

Panduan ini ditulis untuk **SIPP v34** (sudah memiliki login admin bawaan). Folder project di panduan ini bernama `sipp-v34`.

## 0. Hasil pemeriksaan project (penting dibaca)

| Temuan | Artinya untuk VPS |
|---|---|
| Next.js 16 + React 19 | Butuh **Node.js 20+** (kita pakai Node 22 LTS) |
| Database **PostgreSQL** + Drizzle ORM | Install PostgreSQL di VPS yang sama |
| `puppeteer` dipakai untuk export PDF (`lib/export-pdf.ts`) | Linux butuh library tambahan untuk Chrome (ada di langkah 3) |
| Fitur Backup memakai `pg_dump` | Paket `postgresql-client` harus ada (ikut terpasang bersama PostgreSQL) |
| Tabel dibuat dengan `npx drizzle-kit push` (folder `drizzle/` tidak ada) | Jalankan sekali di VPS |
| **Login admin bawaan (v34)**, 1 akun untuk semua pengguna | Username dan password diisi di `.env`. Tidak ada perubahan database. Tanpa isi `.env` yang benar, login ditolak |
| Skrip `.bat`, `.vbs`, `.ps1` di folder `scripts/` | Khusus Windows, **tidak dipakai** di VPS (diganti systemd + cron) |

> **Rekomendasi:** pakai domain + HTTPS (langkah 8) supaya password login tidak terkirim tanpa enkripsi.

---

## 1. Memilih dan membeli VPS

### Apakah KVM 2 cukup? Ya, lebih dari cukup.
Spesifikasi KVM 2 Hostinger (cek ulang di halaman produk, bisa berubah): sekitar **2 vCPU, 8 GB RAM, 100 GB NVMe**.
Untuk aplikasi internal dengan puluhan user, ini sangat longgar. RAM 8 GB juga aman untuk `next build` dan Chrome (Puppeteer).

### Pilihan saat checkout
1. **Periode:** 12 bulan atau lebih biasanya jauh lebih murah per bulan daripada bulanan. Harga promo biasanya naik saat perpanjangan, jadi cek harga renewal.
2. **Lokasi server:** pilih yang paling dekat dengan pengguna (Singapore, atau Indonesia jika tersedia di pilihan).
3. **Sistem operasi:** pilih **Ubuntu 24.04 LTS** (OS polos). Jangan pilih template aplikasi seperti panel/WordPress/Docker.
4. **Panel kontrol (hPanel):** tidak perlu. Kita mengatur lewat SSH.
5. **Backup otomatis Hostinger (opsional):** berguna sebagai lapisan tambahan, tapi tetap buat backup database sendiri (langkah 10).
6. **Password root:** buat yang kuat, simpan di password manager.

### Domain (sangat disarankan)
- Dengan **domain** (misal `mtp.perusahaananda.com`) Anda bisa pakai **HTTPS gratis** (Let's Encrypt). Ini penting karena login/password dikirim lewat internet.
- Tanpa domain, aplikasi hanya bisa lewat `http://IP-VPS`, dan password login akan terkirim tanpa enkripsi. Tidak disarankan untuk data perusahaan.
- Setelah punya domain, buat **A record**: `mtp` → IP VPS (di DNS domain Anda).

Setelah VPS aktif, catat: **IP VPS** dan **password root**.

---

## 2. Setup awal VPS (keamanan dasar)

Dari komputer Windows, buka **PowerShell** (Win menu → ketik PowerShell):

```powershell
ssh root@IP-VPS
```
Ketik `yes` saat ditanya fingerprint, lalu password root.

### 2.1 Update sistem dan zona waktu
```bash
apt update && apt upgrade -y
timedatectl set-timezone Asia/Jakarta
```

### 2.2 Buat user biasa (jangan jalankan aplikasi sebagai root)
```bash
adduser deploy          # isi password kuat, sisanya Enter
usermod -aG sudo deploy
```

### 2.3 Login pakai SSH key (lebih aman dari password)
Di **PowerShell Windows** (bukan di VPS):
```powershell
ssh-keygen -t ed25519          # Enter terus sampai selesai
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh root@IP-VPS "mkdir -p /home/deploy/.ssh && cat >> /home/deploy/.ssh/authorized_keys && chown -R deploy:deploy /home/deploy/.ssh && chmod 700 /home/deploy/.ssh && chmod 600 /home/deploy/.ssh/authorized_keys"
```
Tes di jendela PowerShell baru: `ssh deploy@IP-VPS` (harus masuk tanpa password VPS).

### 2.4 Matikan login root dan login password SSH
Hanya lakukan setelah langkah 2.3 berhasil.
```bash
sudo nano /etc/ssh/sshd_config
```
Ubah/pastikan baris ini:
```
PermitRootLogin no
PasswordAuthentication no
```
```bash
sudo systemctl restart ssh
```
**Jangan tutup sesi lama** sampai Anda berhasil membuka sesi baru `ssh deploy@IP-VPS`.

### 2.5 Firewall dan fail2ban
```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo apt install -y fail2ban
sudo systemctl enable --now fail2ban
```
Port 3000 (aplikasi) dan 5432 (database) **sengaja tidak dibuka**. Hanya Nginx (80/443) yang terlihat dari internet.

---

## 3. Install software yang dibutuhkan

Login sebagai `deploy`.

```bash
# Dasar
sudo apt install -y git curl unzip rsync build-essential nginx

# Node.js 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v && npm -v

# PostgreSQL (Ubuntu 24.04 membawa versi 16) + pg_dump/pg_restore
sudo apt install -y postgresql postgresql-client

# Library untuk Chrome milik Puppeteer (export PDF)
sudo apt install -y libnss3 libatk1.0-0t64 libatk-bridge2.0-0t64 libcups2t64 libdrm2 \
  libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2t64 \
  libpango-1.0-0 libcairo2 libxshmfence1 fonts-liberation
```

---

## 4. Siapkan database PostgreSQL

Pilih password **hanya huruf dan angka** (hindari `@`, `:`, `/`, `#`). Kode backup di aplikasi membaca `DATABASE_URL` dengan pola sederhana, jadi karakter khusus bisa membuatnya gagal.

```bash
sudo -u postgres psql
```
Di dalam `psql`:
```sql
CREATE USER mtp_user WITH PASSWORD 'GantiDenganPasswordKuat123';
CREATE DATABASE mtp_prod OWNER mtp_user;
\q
```
PostgreSQL di Ubuntu secara bawaan hanya menerima koneksi dari VPS itu sendiri (localhost). Biarkan begitu.

---

## 5. Upload project ke VPS

Zip v34 berisi folder `sipp-v34`. Ada dua cara. **Cara A lebih sederhana**, **Cara B lebih rapi untuk update jangka panjang**.

### Cara A: upload langsung dari Windows (rsync/scp)
1. Ekstrak zip di Windows, misalnya ke `D:\mtp-app\sipp-v34`.
2. **Jangan ikut sertakan** `node_modules`, `.next`, `.env`, `backups`. Di PowerShell:
```powershell
cd D:\mtp-app
# Kompres tanpa folder berat
tar --exclude=node_modules --exclude=.next --exclude=.env --exclude=backups -czf mtp.tar.gz sipp-v34
scp mtp.tar.gz deploy@IP-VPS:/home/deploy/
```
3. Di VPS:
```bash
mkdir -p ~/apps && cd ~/apps
tar -xzf ~/mtp.tar.gz
cd sipp-v34
```
Folder aplikasi Anda sekarang: `/home/deploy/apps/sipp-v34`.

### Cara B: lewat GitHub (disarankan, repository **private**)
Nama zip menyebut "github", jadi kemungkinan project sudah ada di GitHub.
```bash
cd ~/apps
git clone https://github.com/USERNAME/REPO.git sipp-v34
```
Untuk repo private pakai Personal Access Token (GitHub → Settings → Developer settings → Fine-grained tokens, akses read-only ke repo itu) sebagai password saat clone.
Update berikutnya cukup `git pull` lalu build ulang (langkah 11).

---

## 6. Konfigurasi dan build aplikasi

```bash
cd ~/apps/sipp-v34
cp .env.example .env
nano .env
```
Isi `.env`:
```
DATABASE_URL="postgresql://mtp_user:GantiDenganPasswordKuat123@localhost:5432/mtp_prod?schema=public"

# Login admin (wajib)
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="PasswordAdminKuat2026"
AUTH_SECRET="tempel-hasil-openssl-di-sini"
```
- Buat `AUTH_SECRET` acak dengan perintah: `openssl rand -hex 32` lalu salin hasilnya.
- Username dan password pakai **huruf dan angka saja** (hindari `#`, `$`, tanda kutip, spasi).
- `PG_DUMP_PATH` tidak perlu diisi di Linux.
- Mengganti password di kemudian hari: ubah `ADMIN_PASSWORD`, lalu `sudo systemctl restart mtp`. Semua sesi lama otomatis keluar.

```bash
chmod 600 .env                 # hanya pemilik yang boleh baca
npm ci                         # install library (termasuk download Chrome untuk PDF)
npx drizzle-kit push           # buat semua tabel di database baru
npm run build                  # build produksi
```
- Pada database baru, **abaikan** file `scripts/update-skema-v28.sql` dan `update-skema-v30.sql`. Itu hanya untuk database lama yang di-upgrade.
- `drizzle-kit` ada di devDependencies, jadi jangan pakai `npm ci --omit=dev`.
- Kalau `drizzle-kit push` menanyakan konfirmasi, baca pesannya. Di database kosong aman memilih lanjut.

Tes cepat:
```bash
npm run start
```
Lalu di jendela SSH kedua: `curl -I http://localhost:3000` (harus `307` dengan `location: /login`, tandanya login aktif). Hentikan dengan `Ctrl+C`.

---

## 7. Jalankan terus-menerus dengan systemd

Agar aplikasi otomatis hidup saat VPS reboot dan restart sendiri jika crash:

```bash
sudo nano /etc/systemd/system/mtp.service
```
Isi:
```ini
[Unit]
Description=Aplikasi MTP (Next.js)
After=network.target postgresql.service

[Service]
Type=simple
User=deploy
WorkingDirectory=/home/deploy/apps/sipp-v34
Environment=NODE_ENV=production
Environment=PORT=3000
# Dengar hanya di localhost supaya hanya bisa diakses lewat Nginx
ExecStart=/usr/bin/npm run start -- -H 127.0.0.1 -p 3000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now mtp
sudo systemctl status mtp          # harus "active (running)"
journalctl -u mtp -f               # lihat log (Ctrl+C untuk keluar)
```

---

## 8. Nginx + HTTPS

Nginx menerima akses dari internet (port 80/443) lalu meneruskannya ke aplikasi. Login ditangani oleh aplikasi itu sendiri.

### 8.1 Konfigurasi situs
Ganti `mtp.domainanda.com` dengan domain Anda.
```bash
sudo nano /etc/nginx/sites-available/mtp
```
```nginx
server {
    listen 80;
    server_name mtp.domainanda.com;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;      # export PDF/Excel bisa agak lama
    }
}
```
```bash
sudo ln -s /etc/nginx/sites-available/mtp /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

### 8.2 HTTPS gratis (Let's Encrypt)
Pastikan A record domain sudah mengarah ke IP VPS (cek dengan `ping mtp.domainanda.com`).
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d mtp.domainanda.com
```
Pilih opsi redirect HTTP ke HTTPS. Sertifikat diperbarui otomatis.

### 8.3 Coba
Buka `https://mtp.domainanda.com` dari HP/laptop mana pun. Harus muncul halaman **Login SIPP v34**. Masuk dengan `ADMIN_USERNAME` dan `ADMIN_PASSWORD` dari `.env`.

> **Tanpa domain:** ganti `server_name` dengan `_;` dan akses lewat `http://IP-VPS`. Lewati 8.2. Login tetap berfungsi, tetapi password terkirim tanpa enkripsi, jadi kurang aman.
> **Catatan:** hanya ada satu role (Admin). Semua orang yang tahu username dan password punya akses penuh.

---

## 9. Memindahkan data lama (jika sudah ada data di komputer lokal)

Aplikasi punya fitur Backup yang menghasilkan file `.backup` (format custom pg_dump).

1. Di komputer lama: buka menu Backup di aplikasi dan unduh file backup terbaru (atau ambil dari folder `backups/`).
2. Upload ke VPS:
```powershell
scp D:\mtp-app\sipp-v34\backups\mtp-mtp_dev-XXXX.backup deploy@IP-VPS:/home/deploy/
```
3. Restore di VPS (**menimpa data yang ada**). Lakukan **sebelum** atau **sesudah** `drizzle-kit push` (kalau sudah push, pakai `--clean --if-exists`):
```bash
sudo systemctl stop mtp
PGPASSWORD='GantiDenganPasswordKuat123' pg_restore -h localhost -U mtp_user -d mtp_prod \
  --clean --if-exists --no-owner --no-privileges ~/mtp-mtp_dev-XXXX.backup
cd ~/apps/sipp-v34 && npx drizzle-kit push     # sinkronkan skema jika backup dari versi lebih lama
sudo systemctl start mtp
```
Jika muncul beberapa peringatan "does not exist, skipping", itu normal saat `--clean`.

---

## 10. Backup otomatis (wajib untuk data perusahaan)

```bash
mkdir -p ~/db-backups
nano ~/backup-mtp.sh
```
```bash
#!/bin/bash
export PGPASSWORD='GantiDenganPasswordKuat123'
FILE=~/db-backups/mtp-$(date +%F_%H%M).backup
pg_dump -h localhost -U mtp_user -F c -f "$FILE" mtp_prod
# hapus backup lebih dari 30 hari
find ~/db-backups -name "*.backup" -mtime +30 -delete
```
```bash
chmod 700 ~/backup-mtp.sh
crontab -e
```
Tambahkan baris (jalan tiap hari jam 02:00):
```
0 2 * * * /home/deploy/backup-mtp.sh
```
**Salinan di luar VPS:** secara berkala unduh folder `db-backups` ke komputer kantor:
```powershell
scp deploy@IP-VPS:/home/deploy/db-backups/*.backup D:\backup-mtp\
```
Aktifkan juga backup/snapshot VPS dari Hostinger sebagai lapisan kedua.

---

## 11. Cara update aplikasi di kemudian hari

Setiap ada versi baru (misal v34):
```bash
cd ~/apps/sipp-v34
# Cara B (GitHub):
git pull
# Cara A: upload tar.gz baru, ekstrak menimpa folder, JANGAN menimpa .env

npm ci
npx drizzle-kit push        # v34 tidak mengubah database; jalankan hanya jika versi berikutnya menyebutnya
npm run build
sudo systemctl restart mtp
```
**Sebelum update**, jalankan `~/backup-mtp.sh` dulu supaya ada titik kembali.

---

## 12. Troubleshooting cepat

| Gejala | Penyebab / solusi |
|---|---|
| 502 Bad Gateway | Aplikasi mati. `sudo systemctl status mtp` dan `journalctl -u mtp -n 50` |
| Login selalu gagal / "Login belum dikonfigurasi" | `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `AUTH_SECRET` (min. 16 karakter) belum terisi di `.env`, atau aplikasi belum di-restart: `sudo systemctl restart mtp` |
| Terkunci "Terlalu banyak percobaan gagal" | Tunggu 15 menit, atau `sudo systemctl restart mtp` untuk mereset |
| Error `column ... does not exist` / `relation ... does not exist` | Skema belum diperbarui: `npx drizzle-kit push` lalu restart |
| Export PDF gagal / Chrome tidak jalan | Library Chrome belum lengkap (langkah 3). Coba `npx puppeteer browsers install chrome`, lalu lihat log `journalctl -u mtp` untuk nama library yang kurang |
| `npm run start` error "no production build" | Jalankan `npm run build` dulu |
| Backup di aplikasi gagal "pg_dump" | `which pg_dump` harus ada. Pastikan password DB tidak memuat `@` atau `:` |
| Tidak bisa SSH setelah ubah config | Masuk lewat **Browser terminal / VNC** di hPanel Hostinger, perbaiki `/etc/ssh/sshd_config` |
| Certbot gagal | A record belum mengarah ke IP VPS, atau port 80 belum dibuka di `ufw` |
| Build kehabisan memori | Jarang di 8 GB. Tambah swap: `sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile` |

---

## 13. Checklist akhir

- [ ] VPS Ubuntu 24.04 aktif, login root dimatikan, SSH key aktif
- [ ] Firewall: hanya 22, 80, 443 terbuka
- [ ] Node 22, PostgreSQL, Nginx terpasang
- [ ] Database `mtp_prod` dan user `mtp_user` dibuat
- [ ] Project di `~/apps/sipp-v34`, `.env` terisi, `chmod 600`
- [ ] `npm ci`, `drizzle-kit push`, `npm run build` sukses
- [ ] Service `mtp` aktif dan otomatis hidup setelah reboot (tes: `sudo reboot`)
- [ ] Domain mengarah ke VPS, HTTPS aktif
- [ ] `.env` berisi `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `AUTH_SECRET`; halaman login muncul dan salah password ditolak
- [ ] Backup harian jalan dan sudah dicoba restore sekali
- [ ] Data lama sudah dipindahkan (jika ada)
- [ ] Bagikan alamat `https://mtp.domainanda.com` dan username/password admin ke user

## 14. Saran lanjutan
1. **Monitoring uptime gratis** (UptimeRobot) untuk notifikasi jika situs mati.
2. **Update keamanan rutin:** `sudo apt update && sudo apt upgrade -y` sebulan sekali (atau aktifkan `unattended-upgrades`).
3. Ganti password admin berkala, dan segera ganti jika ada staf yang berhenti.
