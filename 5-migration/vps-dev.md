# Moodara — Project Context & Deployment Plan

## 1. Tujuan Proyek

Saya sedang menyiapkan deployment project **Moodara** ke VPS pribadi berbasis Ubuntu.

Target utama:
- Mempertahankan repository sebagai monorepo untuk saat ini.
- Menjalankan frontend dan backend sebagai layanan/container terpisah.
- Menggunakan PostgreSQL sebagai database, menggantikan MySQL yang sebelumnya digunakan backend.
- Menjalankan PostgreSQL melalui Docker Compose dengan persistent storage.
- Menghubungkan backend ke PostgreSQL melalui jaringan internal Docker.
- Menggunakan Nginx untuk reverse proxy HTTP/HTTPS jika dibutuhkan.
- Menjaga layanan n8n yang sudah berjalan agar tidak terganggu.
- Menyiapkan backup database dan konfigurasi deployment yang aman.

Repository:
- GitHub: https://github.com/Yukihine12/Moodara

## 2. Kondisi VPS

Informasi yang diketahui sejauh ini:

| Komponen | Informasi |
|---|---|
| OS | Ubuntu 24.04 |
| Private IP | `10.11.10.131` |
| Public IP | `43.157.227.178` |
| CPU | 2 vCPU |
| RAM | Sekitar 2 GB |
| Root disk | Sekitar 40 GB |
| Container runtime | Docker |
| Database yang direncanakan | PostgreSQL 17 |
| Aplikasi yang sudah berjalan | n8n |
| Domain n8n | `n8n.ykhn.my.id` |
| Reverse proxy | Nginx pernah digunakan di host |

Informasi di atas berasal dari kondisi sebelumnya dan harus diverifikasi kembali sebelum melakukan perubahan.

### Kondisi n8n

n8n sudah berjalan dalam Docker dan sebelumnya menggunakan:
- Container: `n8n`
- Port host: `5678`
- Volume: `n8n_n8n_data`
- URL: `https://n8n.ykhn.my.id`

**Prioritas utama: jangan merusak, menghentikan, menghapus, atau mengubah konfigurasi n8n tanpa kebutuhan yang jelas dan persetujuan saya.**

Jangan mengasumsikan konfigurasi Nginx, DNS, port, atau container saat ini masih sama. Periksa terlebih dahulu.

## 3. Rancangan Arsitektur

Target arsitektur:

```text
Internet
   |
   v
Public IP VPS
   |
   v
Nginx Reverse Proxy (HTTP/HTTPS)
   |
   +----> Frontend Moodara
   |
   +----> Backend Moodara
                  |
                  v
          Private Docker Network
                  |
                  v
             PostgreSQL
                  |
                  v
          Persistent Docker Volume

n8n tetap berjalan sebagai layanan terpisah.
```

Catatan:
- Frontend dan backend tidak harus berada dalam repository terpisah.
- Satu monorepo bisa membangun beberapa Docker image.
- Database tidak boleh diekspos langsung ke internet.
- Nginx digunakan untuk trafik HTTP/HTTPS, bukan sebagai kebutuhan wajib untuk koneksi PostgreSQL.
- Backend harus mengakses PostgreSQL melalui jaringan internal Docker jika keduanya berjalan sebagai container.
- Jangan menggabungkan atau mengubah konfigurasi n8n hanya demi menyederhanakan deployment Moodara.

## 4. PostgreSQL yang Sudah Disiapkan

Folder konfigurasi PostgreSQL di VPS:

```text
~/moodara-db/
├── .env
└── compose.yaml
```

Container dan resource yang direncanakan:

| Komponen | Nilai |
|---|---|
| Container | `moodara-postgres` |
| Image | `postgres:17-alpine` |
| Database | `moodara` |
| Admin role | `moodara_admin` |
| Application role | `moodara_app` |
| Port PostgreSQL | `5432` |
| Host port binding | `127.0.0.1:5432` |
| Docker volume | `moodara_postgres_data` |

Konfigurasi Compose yang direncanakan:

```yaml
services:
  postgres:
    image: postgres:17-alpine
    container_name: moodara-postgres
    restart: unless-stopped
    env_file:
      - .env
    ports:
      - "127.0.0.1:5432:5432"
    volumes:
      - moodara_postgres_data:/var/lib/postgresql/data
    healthcheck:
      test:
        - CMD-SHELL
        - pg_isready -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  moodara_postgres_data:
    name: moodara_postgres_data
```

Konfigurasi aktual harus diperiksa di VPS sebelum diedit atau dijalankan ulang.

### Keamanan PostgreSQL

Port mapping:

```yaml
ports:
  - "127.0.0.1:5432:5432"
```

berarti port database pada host hanya dipublikasikan melalui loopback VPS.

Ketentuan:
- Jangan mengubah binding menjadi `0.0.0.0:5432:5432`.
- Jangan membuka port `5432` ke internet.
- Jangan membuat aturan firewall publik untuk port `5432`.
- DBeaver dari laptop dapat menggunakan SSH tunnel untuk mengakses database.
- Koneksi backend dalam Docker sebaiknya menggunakan jaringan internal Docker, bukan IP public VPS.

### Pengelolaan password

File PostgreSQL `.env` berisi variabel inisialisasi:

```dotenv
POSTGRES_DB=moodara
POSTGRES_USER=moodara_admin
POSTGRES_PASSWORD=<password-admin-yang-disimpan-secara-rahasia>
```

Password aplikasi ditetapkan terpisah melalui PostgreSQL untuk role `moodara_app`.

Backend menggunakan password role `moodara_app`, bukan otomatis password administrator.

**Jangan menulis password asli ke dokumen ini, repository, prompt agent, atau file Markdown yang akan dibagikan.**

Perubahan `.env` tidak otomatis mengganti password role PostgreSQL yang sudah ada setelah database diinisialisasi.

## 5. Konteks Backend Moodara

Informasi backend yang pernah dibagikan:

- Node.js dan TypeScript.
- Express 5.
- Entry point hasil build: `dist/index.js`.
- Script build: `tsc`.
- Script start: `node dist/index.js`.
- Script development: `tsx watch src/index.ts`.
- Repository menggunakan ES modules melalui `"type": "module"`.
- Dependency yang sebelumnya terlihat mencakup `mysql2`.
- Dockerfile sebelumnya menggunakan Node.js 18 Alpine.

Semua informasi tersebut harus diverifikasi dari source code terkini.

### Keputusan database

Saya memutuskan menggunakan **PostgreSQL**, meskipun backend sebelumnya menggunakan MySQL.

Agent harus memeriksa:
- Seluruh import dan penggunaan `mysql2`.
- Modul koneksi database dan connection pool.
- Query SQL yang masih spesifik untuk MySQL.
- Schema, migration, seed, dan inisialisasi tabel.
- Placeholder query dan parameter binding.
- Tipe data, auto-increment, transaksi, dan penanganan tanggal.
- Login, autentikasi, session, dan operasi CRUD.
- Variabel environment yang benar-benar digunakan kode.
- Versi Node.js dan kompatibilitas dependency.

Jangan menganggap bahwa mengganti `mysql2` menjadi `pg` saja sudah cukup.

Sebelum mengubah kode, buat ringkasan komponen yang terdampak dan rencana migrasi. Gunakan parameterized queries dan pola koneksi database yang konsisten.

Jangan menghapus dependency, tabel, atau kode lama sebelum memastikan tidak lagi digunakan.

## 6. Environment Backend

Contoh konfigurasi backend:

```dotenv
DB_HOST=<sesuai lokasi backend>
DB_PORT=5432
DB_NAME=moodara
DB_USER=moodara_app
DB_PASSWORD=<password-role-moodara_app>
```

Penentuan host:
- Backend dalam Docker network yang sama: `DB_HOST=postgres`, jika nama service tersebut dapat di-resolve dari backend.
- Backend berjalan langsung pada host Ubuntu: `DB_HOST=127.0.0.1`.
- Backend berjalan di laptop: tentukan endpoint berdasarkan lingkungan development dan jalur jaringan yang dipakai.

Variabel di atas hanyalah contoh. Periksa konfigurasi aplikasi untuk mengetahui nama environment variable yang sebenarnya dibaca oleh kode.

Jangan memasukkan `.env` produksi ke dalam Docker image. Gunakan environment file atau mekanisme secret yang sesuai dan pastikan rahasia tidak masuk Git.

## 7. Rencana Deployment Bertahap

### Fase 1 — Reconnaissance

Sebelum mengubah apa pun:
1. Periksa struktur repository.
2. Baca `package.json`, Dockerfile, `compose.yaml`, konfigurasi TypeScript, dan `.gitignore`.
3. Temukan modul koneksi database dan seluruh query SQL.
4. Identifikasi framework frontend dan cara build-nya.
5. Periksa status VPS: container, network, volume, port, RAM, disk, dan service.
6. Periksa konfigurasi Nginx dan routing n8n sebelum merencanakan perubahan.

Hasil yang diharapkan:
- Ringkasan arsitektur saat ini.
- Daftar komponen yang perlu diubah.
- Risiko dan dependency antar-komponen.
- Rencana implementasi yang disetujui sebelum modifikasi.

### Fase 2 — Migrasi Backend ke PostgreSQL

1. Tentukan perubahan kode dan schema yang diperlukan.
2. Pastikan driver PostgreSQL yang sesuai digunakan.
3. Sesuaikan query, koneksi, transaksi, dan migration.
4. Periksa autentikasi serta semua operasi database.
5. Tambahkan pengujian koneksi dan operasi CRUD.
6. Pastikan tidak ada query MySQL yang tertinggal.

Jika ada data MySQL yang perlu dipertahankan, rencanakan migrasi data secara terpisah. Jangan menganggap database baru sudah memiliki data lama.

### Fase 3 — Docker Network

1. Periksa network container PostgreSQL yang sudah ada.
2. Tentukan cara menghubungkan backend ke PostgreSQL.
3. Pertahankan volume `moodara_postgres_data`.
4. Jangan membuat ulang database hanya untuk memperbaiki network.
5. Jangan mengubah network atau volume n8n tanpa alasan dan persetujuan.
6. Pastikan backend dapat mengakses PostgreSQL tanpa mengekspos port database ke internet.

### Fase 4 — Containerisasi Frontend dan Backend

1. Tentukan Dockerfile frontend dan backend berdasarkan struktur repository aktual.
2. Build image masing-masing layanan.
3. Gunakan Docker Compose untuk mengelola layanan Moodara jika sesuai.
4. Terapkan healthcheck dan urutan kesiapan layanan bila diperlukan.
5. Validasi environment variable dan koneksi database.
6. Uji layanan sebelum memasukkannya ke jalur trafik publik.

### Fase 5 — Nginx dan Domain

1. Periksa konfigurasi Nginx aktif.
2. Periksa port yang sudah digunakan.
3. Tentukan domain atau subdomain untuk frontend dan backend.
4. Konfigurasikan reverse proxy hanya setelah jalur layanan jelas.
5. Periksa DNS dan sertifikat TLS.
6. Uji routing HTTPS dan pastikan n8n tetap dapat diakses.

Jangan menimpa seluruh konfigurasi Nginx secara membabi buta. Lakukan perubahan minimal, validasi konfigurasi, dan siapkan cara rollback.

### Fase 6 — Verifikasi dan Backup

- Periksa health status seluruh container.
- Uji koneksi backend ke PostgreSQL.
- Uji endpoint API utama.
- Uji autentikasi dan operasi database.
- Pastikan port PostgreSQL hanya terikat pada loopback host.
- Pastikan n8n masih berjalan.
- Buat backup PostgreSQL.
- Simpan salinan backup di luar VPS.
- Dokumentasikan proses restore dan uji pemulihan jika memungkinkan.

## 8. Aturan Keselamatan untuk Agent

Agent harus mengikuti aturan berikut:

1. **Inspeksi terlebih dahulu, ubah kemudian.**
2. Jangan mengarang kondisi sistem yang belum diperiksa.
3. Bedakan fakta yang sudah diverifikasi dengan asumsi.
4. Jelaskan rencana perubahan dan file yang akan terdampak sebelum melakukan perubahan besar.
5. Bekerja secara bertahap, satu bagian pada satu waktu.
6. Gunakan tes setelah setiap perubahan.
7. Jangan meminta saya membagikan password, private key, token, atau rahasia lainnya.
8. Pastikan `.env` dan secret tidak masuk Git.
9. Jangan mengekspos PostgreSQL ke internet.
10. Jangan mengganggu n8n yang sudah berjalan.
11. Jangan menjalankan perintah destruktif tanpa konfirmasi eksplisit.

Perintah berisiko yang memerlukan konfirmasi:
- `docker compose down -v`
- `docker volume rm`
- `docker system prune` atau `docker volume prune`
- Menghapus data directory PostgreSQL.
- Menghapus database atau tabel.
- Menginisialisasi ulang volume database.
- Mengganti konfigurasi Nginx aktif.
- Restart service produksi yang dapat mengganggu layanan.
- Mengubah firewall atau port publik.
- Mengganti kredensial yang sedang digunakan.

Jangan menjalankan cleanup atau reset hanya karena terjadi error. Periksa log dan penyebabnya terlebih dahulu.

## 9. Cara Agent Membantu Saya

Saya ingin agent berperan sebagai senior engineer sekaligus tutor.

Preferensi kerja:
- Jelaskan langkah demi langkah menggunakan Bahasa Indonesia.
- Jelaskan alasan teknis sebelum memberikan perintah.
- Utamakan pemahaman alur sistem dan diagram arsitektur.
- Hindari perubahan besar sekaligus.
- Jangan langsung menghasilkan banyak file tanpa memeriksa repository.
- Jika ada beberapa pilihan teknis, jelaskan trade-off dan rekomendasikan satu pilihan.
- Ajukan pertanyaan singkat jika informasi yang belum diketahui memengaruhi keamanan atau kebenaran implementasi.
- Setelah menjalankan tes, jelaskan hasil dan langkah selanjutnya.

## 10. Status yang Belum Dikonfirmasi

Hal berikut harus diperiksa sebelum implementasi:
- Status aktual container `moodara-postgres`.
- Apakah role `moodara_app` sudah dibuat dan password-nya sudah ditetapkan.
- Apakah backend berjalan di laptop atau VPS.
- Apakah backend dan PostgreSQL sudah berbagi Docker network.
- Apakah migrasi MySQL ke PostgreSQL sudah mulai dilakukan.
- Apakah terdapat data lama yang harus dipertahankan.
- Struktur dan framework frontend terkini.
- Konfigurasi Nginx, DNS, dan TLS yang aktif.
- Port yang tersedia dan resource VPS terkini.

**Instruksi awal untuk agent:** mulai dari Fase 1. Inspeksi repository dan kondisi deployment yang tersedia, lalu laporkan temuan serta rencana tindakan sebelum melakukan perubahan infrastruktur atau migrasi database.
