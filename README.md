# 📒 Cash Book — Buku Keuangan Keluarga Digital

Aplikasi web manajemen keuangan keluarga modern bergaya **Clean Fintech** untuk mencatat pengeluaran harian, memantau anggaran kas bulanan bersama keluarga, sekaligus mengelola **Kas Pribadi** yang terpisah secara privat.

![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?style=flat-square&logo=prisma)
![TiDB Cloud / MySQL](https://img.shields.io/badge/Database-MySQL%20%2F%20TiDB%20Cloud-00758F?style=flat-square&logo=mysql)
![PWA Ready](https://img.shields.io/badge/PWA-Installable-0d9488?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

---

## ✨ Fitur Utama

### 1. Manajemen Kas Keluarga (Bersama)
- **📊 Beranda Interaktif (`/dashboard`)**: Ringkasan 4 kartu utama (Total Anggaran, Total Pengeluaran, Sisa Saldo, Rata-rata Harian), grafik batang pengeluaran harian, diagram donat distribusi kategori, grafik tren 6 bulan, serta daftar transaksi terbaru.
- **➕ Catat Pengeluaran Cepat (`/transaksi/baru`)**:
  - **Pintasan "Sering Dicatat" (1-Ketuk)** untuk mengisi otomatis nama item, kategori, dan nominal terakhir dari transaksi yang paling sering dicatat.
  - Tombol tambah nominal cepat (`+10rb` hingga `+500rb`) dan pemilih kategori visual.
  - Peringatan otomatis jika nominal melebihi sisa kas bulan berjalan.
- **📋 Riwayat & Filter Lengkap (`/transaksi`)**: Pencarian item, filter kategori, anggota, rentang tanggal, preset (`7 Hari`, `30 Hari`, `Bulan Ini`, `Bulan Lalu`), pengurutan tanggal/nominal, ekspor **CSV**, serta tampilan **Mobile Fintech Ledger** yang rapi di layar HP.
- **📈 Laporan & Ekspor (`/laporan`)**: Realisasi anggaran, 6 metrik analitik (termasuk hari, kategori, dan anggota terboros), perbandingan tren 6 bulan, serta ekspor **CSV**, **PDF**, dan mode **Cetak (Print)**.
- **📅 Kalender Pengeluaran (`/kalender`)**: Visualisasi intensitas pengeluaran harian (hemat, sedang, tinggi), penanda kas masuk, dukungan geser (*swipe*) antar bulan di HP, dan rincian transaksi per tanggal.
- **🔄 Pindah Saldo Bulan Lalu (*Carry-Over*)**: Mendeteksi otomatis sisa kas bulan sebelumnya untuk dipindahkan menjadi saldo awal bulan baru.

### 2. Kas Pribadi (Privat & Terisolasi)
- **🔒 Buku Kas Pribadi (`/pribadi`)**: Setiap anggota memiliki buku kas pribadi sendiri (Saldo Utama, Top-Up, Pengeluaran, dan Pemasukan) yang **100% terpisah** dari saldo, riwayat, dan laporan Kas Keluarga. Data hanya dapat dilihat oleh pemilik akun masing-masing.

### 3. Asisten AI, Audit & Kenyamanan Penggunaan
- **🤖 Asisten AI Keuangan**: Widget chat mengambang untuk menanyakan ringkasan pengeluaran, analisis kebiasaan belanja, dan bantuan pencatatan transaksi (didukung Groq API).
- **🧾 Log Aktivitas & Arsip Database (`/pengaturan`)**: Audit trail lengkap setiap pencatatan, perubahan, penghapusan, dan top-up kas; serta fitur arsip otomatis transaksi lama (> 90 hari) ke `MonthlySnapshot` tanpa mengubah total historis.
- **🌐 Multi-Bahasa & Tema**: Mendukung **Bahasa Indonesia**, **English**, dan **Nederlands**, serta mode **Terang (Light)** dan **Gelap (Dark)**.
- **📱 Responsif & PWA**: Tampilan optimal di desktop maupun HP, dilengkapi notifikasi Toast & modal konfirmasi in-app, *Skeleton Shimmer*, pengingat harian, dan dapat dipasang ke layar utama HP (PWA).

---

## 🧭 Panduan Singkat untuk Pengguna

### Cara Masuk atau Mendaftar
Saat membuka halaman login (`/login`), tersedia 3 pilihan tab:

1. **Masuk (Login)**
   - Gunakan **Nama / Username / Email** dan **Password / PIN** yang sudah terdaftar.
2. **Buat Buku Kas Keluarga Baru (Daftar)**
   - Isi Nama Keluarga, Email aktif, dan Password/PIN.
   - Masukkan **kode OTP 6 digit** yang dikirim ke email Anda.
   - Akun Anda otomatis menjadi **Super Admin** dan langsung mendapatkan **Kode Undangan Keluarga** (contoh: `CB-XXXX-XXXX`).
3. **Gabung Keluarga (Pakai Kode Undangan)**
   - Minta **Kode Undangan** dari Super Admin / Admin keluarga Anda (dapat dilihat di menu **Pengaturan → Anggota Keluarga**).
   - Masukkan Kode Undangan, pilih nama panggilan unik, dan buat Password/PIN Anda sendiri.

### Hak Akses Berdasarkan Peran

| Fitur / Aksi | Member | Admin | Super Admin |
| :--- | :---: | :---: | :---: |
| Lihat Beranda, Riwayat, Laporan & Kalender | ✅ | ✅ | ✅ |
| Catat Pengeluaran Kas Keluarga | ✅ | ✅ | ✅ |
| Edit Transaksi Sendiri (maks. 24 jam) | ✅ | ✅ | ✅ |
| Edit / Hapus Semua Transaksi Kas Keluarga | ❌ | ✅ | ✅ |
| Atur Kas Bulanan & Tambah Kas (Top-Up) | ❌ | ✅ | ✅ |
| Kelola Anggota Keluarga (maks. 5 anggota aktif) | ❌ | ✅ | ✅ |
| Ubah Kode Undangan, Arsip Database & Log Aktivitas | ❌ | ❌ | ✅ |
| Kelola Buku Kas Pribadi Sendiri (`/pribadi`) | ✅ | ✅ | ✅ |

> **Catatan:** Seluruh perhitungan tanggal transaksi, laporan bulanan, dan log aktivitas menggunakan zona waktu seragam **WITA (`Asia/Makassar`)** agar selalu konsisten antara perangkat pengguna dan server.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 14](https://nextjs.org/) (App Router & Route Handlers) + React 18
- **Database & ORM**: [TiDB Cloud](https://pingcap.com/products/tidb-cloud) / MySQL + [Prisma 6](https://www.prisma.io/)
- **Autentikasi**: [jose](https://github.com/panva/jose) (JWT HTTP-Only Cookie, kompatibel Edge Middleware) + `bcryptjs`
- **Styling & Ikon**: Custom Clean Fintech CSS Design System + Tailwind CSS utilities + [Lucide React](https://lucide.dev/)
- **Visualisasi & Ekspor**: [Recharts](https://recharts.org/), `jsPDF` + `jspdf-autotable`, `xlsx`
- **Email & AI (Opsional)**: `nodemailer` (OTP Email), Groq API (Asisten AI Keuangan)

---

## 🚀 Instalasi & Menjalankan Secara Lokal

### Prasyarat
- **Node.js** versi `18.x` atau lebih baru
- **npm**
- Database **MySQL** atau **TiDB Cloud**

### Langkah-langkah

1. **Clone repository**
   ```bash
   git clone https://github.com/Vincentaa7/cash-book.git
   cd cash-book
   ```

2. **Install dependensi**
   ```bash
   npm install
   ```

3. **Konfigurasi Environment Variables**

   Buat file `.env` di folder root proyek:
   ```env
   # Wajib: Koneksi Database MySQL / TiDB Cloud
   DATABASE_URL="mysql://user:password@host:4000/dbname?sslaccept=strict"

   # Wajib: Kunci rahasia untuk token sesi JWT (minimal 32 karakter acak)
   JWT_SECRET="ganti-dengan-secret-key-acak-minimal-32-karakter"

   # Opsional: Untuk fitur Asisten AI Keuangan (Groq)
   GROQ_API_KEY="gsk_your_groq_api_key"
   GROQ_MODEL="openai/gpt-oss-120b,qwen/qwen3.8-27b,openai/gpt-oss-20b"

   # Opsional: Untuk mengirim kode OTP 6 digit ke email saat daftar keluarga baru
   SMTP_HOST="smtp.gmail.com"
   SMTP_PORT="465"
   SMTP_USER="email-anda@gmail.com"
   SMTP_PASS="app-password-email-anda"
   ```
   > **Tips Mode Pengembangan:** Jika `SMTP_USER` / `SMTP_PASS` belum diisi saat menjalankan secara lokal, kode OTP verifikasi pendaftaran tetap dapat dilihat pada log terminal server.

4. **Sinkronisasi Skema Database**
   ```bash
   npx prisma db push
   npx prisma generate
   ```

5. **Jalankan Server Pengembangan**
   ```bash
   npm run dev
   ```
   Buka [http://localhost:3000](http://localhost:3000) di browser Anda.

---

## ☁️ Deployment (Vercel)

1. Push proyek ke GitHub.
2. Impor repository di [Vercel](https://vercel.com/).
3. Tambahkan variabel lingkungan (`DATABASE_URL`, `JWT_SECRET`, serta variabel opsional `GROQ_API_KEY` dan `SMTP_*`) pada menu **Settings → Environment Variables**.
4. Pastikan *Build Command* menggunakan default `npm run build` (`prisma generate && next build`), lalu klik **Deploy**.

---

## 📄 Lisensi

Proyek ini dirilis di bawah lisensi **MIT**.
