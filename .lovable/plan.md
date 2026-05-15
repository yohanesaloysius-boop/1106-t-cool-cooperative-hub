## Rencana Implementasi (5 Fitur Besar)

### 1. Mode Anggota untuk Pengurus & Super Admin
- Tambah toggle "Lihat sebagai Anggota" di header (hanya muncul untuk role pengurus/super_admin).
- Simpan status `viewAsMember` di `localStorage` + context `useAuth`.
- Saat aktif: sembunyikan menu admin, halaman `/admin/*` redirect ke `/dashboard`, `is_pengurus` check di UI dimatikan sementara.
- Toggle balik ke "Mode Pengurus" kapan saja. Tidak ubah role di DB — murni view-switching di klien.

### 2. Fitur Baru

**A. Tabungan Berjangka (Deposito Koperasi)**
- Tabel baru `tabungan_berjangka`: nominal, tenor (3/6/12/24 bulan), bunga_persen (default 0.5%/bulan), tanggal_mulai, tanggal_jatuh_tempo, status (`active`/`matured`/`withdrawn`/`pending`), bukti_url.
- Halaman anggota `/tabungan-berjangka`: ajukan, lihat saldo + estimasi bagi hasil, riwayat.
- Halaman pengurus `/admin/tabungan-berjangka`: verifikasi & cairkan saat jatuh tempo.
- RLS: anggota lihat punya sendiri, pengurus lihat semua.

**B. Program Reward SHU**
- Tabel `shu_rewards`: `user_id`, `tahun`, `poin_keaktifan`, `bonus_loyalitas`, `bonus_referral`, `total_bonus`.
- Sistem poin (umum di Indonesia):
  - Setor simpanan wajib tepat waktu: +10 poin/bulan
  - Hadir rapat: +20 poin
  - Pinjaman lunas tepat waktu: +50 poin
  - Anggota >2 tahun: bonus loyalitas 5% dari SHU dasar
  - Referral anggota baru aktif: +100 poin
- Poin dikonversi ke bonus SHU saat pembagian akhir tahun.
- Halaman `/shu` ditambah tab "Reward & Poin Saya".

### 3. Aturan Bisnis (Settings)
- Halaman baru `/admin/pengaturan` (super_admin only).
- Edit nilai di tabel `settings`:
  - `pinjaman.bunga_persen` (default 1.5%/bulan)
  - `pinjaman.tenor_max` (default 24 bulan)
  - `simpanan.pokok_min` (default Rp 500.000)
  - `simpanan.wajib_bulanan` (default Rp 100.000)
  - `shu.persen_jasa_modal` (default 30%)
  - `shu.persen_jasa_usaha` (default 25%)
  - `shu.persen_dana_cadangan` (default 25%)
  - `shu.persen_dana_sosial` (default 10%)
  - `shu.persen_pengurus` (default 10%)
  - `tabungan_berjangka.bunga_3bln/6bln/12bln/24bln`
- Form ini langsung dipakai sebagai default di kalkulator pinjaman & form simpanan.

### 4. Setup Data Awal
- **Super admin pertama**: sudah otomatis via trigger `handle_new_user` (email `yohanesaloysius@gmail.com`). Tidak perlu migrasi tambahan — cukup dokumentasi cara daftar.
- **Import anggota lama**: tombol "Import CSV" di `/admin/anggota` — parse CSV (nama, email, no_hp, nik, alamat) dan kirim invite via `supabase.auth.admin.inviteUserByEmail` melalui server function (admin client). Anggota dapat email magic link.

### 5. Seed 30 Anggota Contoh
- Migration sekali jalan: insert 30 baris dummy ke `auth.users` + `profiles` + `user_roles` (role `anggota`).
- Nama Indonesia variatif, status campuran (20 active, 7 pending, 3 suspended), nomor anggota auto-generate.
- Tambah beberapa simpanan & pinjaman dummy supaya dashboard hidup.
- Beri tag `created_by = 'seed-demo'` di kolom catatan agar admin bisa hapus massal lewat tombol "Hapus Data Demo" di `/admin/anggota`.

---

### Urutan Eksekusi
1. **Migration besar**: tabel baru (`tabungan_berjangka`, `shu_rewards`), settings default, seed 30 anggota dummy + transaksi.
2. **Auth context**: tambah `viewAsMember` toggle.
3. **UI baru**: header toggle, halaman tabungan berjangka (anggota + admin), halaman reward SHU, halaman pengaturan, tombol import CSV & hapus data demo.
4. **Aturan bisnis**: baca settings di kalkulator & form.

### Catatan
- Tidak menyentuh email/WhatsApp (sesuai permintaan sebelumnya).
- Notifikasi otomatis untuk tabungan jatuh tempo akan ditambahkan ke `daily-reminders` cron yang sudah ada.
- Estimasi: 1 migration besar + ~10 file frontend baru/diubah.

Lanjutkan implementasi?