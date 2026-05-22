# Plan: Modul 2 & 3 Koperasi (Keuangan/Operasional + Pengalaman Anggota)

Mengerjakan dua kelompok besar dari roadmap. Modul 4–6 (Analitik AI, Marketplace lanjutan, Legal/Dokumen) ditangguhkan untuk remix berikutnya.

## Modul 2 — Keuangan & Operasional

### 2.1 Notifikasi WhatsApp otomatis (cron)
- File `src/routes/api/public/hooks/daily-reminders.ts` sudah ada — perluas:
  - Kirim pesan WA via `uazapi` proxy (sudah dipakai project) ke anggota yang punya angsuran H-3, H-1, dan jatuh tempo hari ini.
  - Pengingat simpanan wajib tanggal 25 tiap bulan.
  - Notifikasi pengurus untuk OPEX pending approval > 24 jam.
- Tambah tabel `notification_log` (channel, target_user, template, status, ref_id, sent_at) untuk audit & dedup.
- Daftarkan cron harian via `pg_cron` (08:00 WIB) memanggil endpoint.

### 2.2 Auto-debet simpanan wajib
- RPC SQL `auto_debet_simpanan_wajib(_periode date)`:
  - Loop anggota aktif → ambil nominal wajib dari `settings.iuran_wajib_default` atau per-anggota → cek saldo `wallets` cukup → debit ke kas koperasi & insert `simpanan` + `wallet_transactions`.
  - Yang saldonya kurang → masuk `notification_log` "simpanan_wajib_gagal" + buat tagihan `angsuran_simpanan` (atau tabel sederhana `pending_iuran`).
- Cron bulanan tanggal 5 jam 03:00 WIB memanggil RPC tersebut.
- Halaman `/admin/simpanan` tambah tombol "Jalankan Auto-Debet Sekarang" (manual override) + tab "Riwayat Auto-Debet".

### 2.3 Dana Cadangan & Dana Sosial
- Tabel `reserve_funds`: jenis (cadangan/sosial/pendidikan), saldo, target_persen_shu, deskripsi.
- Tabel `reserve_fund_movements`: fund_id, tipe (setor/tarik), nominal, sumber (shu/manual/donasi), ref_id, tanggal, catatan.
- Halaman `/admin/dana-cadangan`: 3 card saldo (cadangan/sosial/pendidikan), list mutasi, tombol setor/tarik dengan approval bendahara.
- Integrasi: saat distribusi SHU di `admin.shu.tsx`, otomatis sisihkan ke 3 dana ini sesuai persentase di settings.

### 2.4 RAPB (Rencana Anggaran Pendapatan & Belanja)
- Tabel `budget_plans`: tahun, status (draft/disahkan/aktif/ditutup), disahkan_pada, disahkan_oleh, catatan.
- Tabel `budget_items`: plan_id, kategori (pendapatan/beban), sub_kategori (mengacu opex_categories untuk beban), uraian, nominal_rencana, nominal_realisasi (computed view).
- Halaman `/admin/rapb`: list tahun, detail tahun (form tambah item, total rencana vs realisasi, % serapan, chart bar).
- RPC `get_rapb_realisasi(_plan_id)` agregasi dari `opex_expenses`, `wallet_transactions`, `simpanan`.

## Modul 3 — Pengalaman Anggota

### 3.1 Chat Support (Anggota ↔ Pengurus)
- Tabel `support_tickets`: user_id, subjek, kategori (umum/pinjaman/simpanan/teknis/komplain), status (open/in_progress/resolved/closed), prioritas, assigned_to, created_at, resolved_at.
- Tabel `support_messages`: ticket_id, sender_id, sender_role, body, attachments (jsonb), read_by (jsonb), created_at.
- Realtime via `supabase.channel` untuk pesan baru.
- Halaman anggota `/bantuan`: list ticket sendiri + form buat ticket + thread chat.
- Halaman pengurus `/admin/support`: inbox, filter status/prioritas, assign, balas, tutup.
- Notifikasi WA opsional saat ticket baru.

### 3.2 PWA Push Notifications
- Tambah `public/sw.js` service worker + `public/manifest.json` (icon, theme color koperasi).
- Hook `src/hooks/use-push-subscription.ts`: minta permission, subscribe pakai VAPID, simpan ke tabel `push_subscriptions` (user_id, endpoint, p256dh, auth, ua, created_at).
- Server fn `sendPush(userIds, payload)` pakai `web-push` (Worker-compatible: pakai HTTP API VAPID langsung tanpa lib node, atau library `web-push-libs` jika ada build edge).
- Trigger push dari event: angsuran jatuh tempo, ticket support, approval pending.
- Tombol "Aktifkan notifikasi" di `/profil`.
- Secrets baru: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (mailto).

### 3.3 E-Voting RAT
- Tabel `votings`: judul, deskripsi, mulai, selesai, status (draft/open/closed), quorum_persen, created_by.
- Tabel `voting_options`: voting_id, label, urutan.
- Tabel `voting_ballots`: voting_id, user_id (unique), option_id, voted_at, ip, ua.
- Halaman anggota `/rapat` (sudah ada) → tambah section "Voting Aktif": list voting open, halaman detail untuk memilih (1 user 1 suara, anonim opsional dgn flag).
- Halaman pengurus `/admin/voting`: CRUD voting, lihat hasil real-time (chart), tutup voting, export hasil PDF.
- RLS: anggota hanya bisa insert ballot sekali per voting; hasil hanya muncul setelah voting closed (atau realtime untuk pengurus).

### 3.4 Survei Kepuasan
- Tabel `surveys`: judul, deskripsi, mulai, selesai, status, target_role (semua/anggota/pengurus).
- Tabel `survey_questions`: survey_id, urutan, tipe (rating_5/skala_10/pilihan/teks), pertanyaan, opsi (jsonb), wajib.
- Tabel `survey_responses`: survey_id, user_id (nullable kalau anonim), jawaban (jsonb), submitted_at.
- Halaman anggota `/survei`: list aktif + form isian.
- Halaman pengurus `/admin/survei`: builder pertanyaan, ringkasan agregat (rata-rata rating, distribusi, wordcloud teks), export CSV.

## Skema akses
- Semua tabel pengurus: RLS `is_pengurus(auth.uid())`.
- Chat support, voting, survei: anggota CRUD baris miliknya sendiri, pengurus lihat semua.
- Tabel push_subscriptions: user_id = auth.uid().

## Urutan eksekusi

1. **2.1 WA reminder cron** (perluas hook existing + tabel log + jadwalkan cron)
2. **2.2 Auto-debet simpanan wajib** (RPC + cron + tombol manual)
3. **2.3 Dana cadangan & sosial** (tabel + halaman + integrasi SHU)
4. **2.4 RAPB** (tabel + halaman + RPC realisasi)
5. **3.1 Chat support** (tabel + 2 halaman + realtime)
6. **3.2 Push notification PWA** (sw + manifest + subscription + trigger)
7. **3.3 E-voting** (tabel + halaman anggota + halaman pengurus)
8. **3.4 Survei kepuasan** (tabel + builder + ringkasan)

Modul 2 dulu (4 langkah), commit/review, lalu Modul 3.

## Modul yang ditangguhkan (untuk remix berikutnya)
- 4. Analitik & AI (dashboard prediktif, credit scoring AI)
- 5. Marketplace lanjutan (rating/review, kupon, laporan komisi)
- 6. Legal & Dokumen (generator AD/ART, template surat)
