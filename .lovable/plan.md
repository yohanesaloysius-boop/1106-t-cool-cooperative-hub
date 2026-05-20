# Plan: 5 Modul Tata Kelola Koperasi

Menambahkan 5 modul besar: Aset & Inventaris, Laporan Keuangan SAK ETAP, Manajemen Pajak, OPEX, dan Penagihan. Semua menu baru hanya muncul untuk pengurus (super_admin, ketua, sekretaris, bendahara). Menu di beranda anggota tidak diubah.

## Urutan implementasi (batch)

Saya kerjakan bertahap supaya tiap modul bisa dites. Saran urutan:

1. **Aset & Inventaris** (mandiri, paling sederhana)
2. **OPEX / Pengeluaran Operasional** (fondasi buku besar)
3. **Manajemen Pajak** (lanjutan OPEX)
4. **Modul Penagihan** (pakai data `angsuran` yang sudah ada)
5. **Laporan Keuangan SAK ETAP** (paling akhir — agregasi semua di atas)

## Ringkasan tiap modul

### 1. Aset & Inventaris
- Tabel `assets`: nama, kategori (kendaraan/properti/peralatan/lainnya), nomor_aset, tanggal_perolehan, harga_perolehan, umur_ekonomis_bulan, nilai_residu, lokasi, kondisi, status (aktif/dijual/rusak/dihapus), penanggung_jawab, foto, dokumen.
- Tabel `asset_depreciations`: snapshot bulanan (asset_id, bulan, beban_bulan, akumulasi, nilai_buku) — di-generate via tombol admin atau cron.
- Halaman `/admin/aset`: list, filter kategori, CRUD, hitung penyusutan garis lurus.
- Halaman detail aset: riwayat penyusutan + dokumen.

### 2. OPEX (Pengeluaran Operasional)
- Tabel `opex_categories`: nama, kode (gaji/sewa/listrik/atk/lainnya).
- Tabel `opex_expenses`: kategori_id, tanggal, deskripsi, nominal, penerima, metode_bayar, status (draft/pending/approved/rejected/paid), bukti_url, created_by, approved_by, paid_at, pajak_terkait (jsonb untuk PPh 21/23).
- Halaman `/admin/opex`: list + filter periode + kategori, form pengajuan, approval (ketua/super_admin), tandai paid (bendahara), upload bukti.
- Workflow approval pakai pola yang ada (`approvals` table sudah ada).

### 3. Manajemen Pajak
- Tabel `tax_records`: jenis (pph21/pph23/ppn/spt_tahunan), periode_bulan, periode_tahun, dasar_pengenaan, tarif_persen, nominal_pajak, status (draft/dilaporkan/dibayar), bukti_lapor_url, bukti_bayar_url, ref_opex_id (nullable), catatan.
- Auto-create record PPh 21 dari OPEX kategori "gaji" & PPh 23 dari kategori "jasa".
- Halaman `/admin/pajak`: list per jenis, ringkasan tahunan, generate laporan SPT (export CSV/PDF sederhana).

### 4. Modul Penagihan
- Tabel `collection_logs`: angsuran_id, user_id, jenis_kontak (telepon/wa/sms/kunjungan/email), tanggal, hasil (janji_bayar/tidak_diangkat/menolak/sudah_bayar/restrukturisasi), catatan, follow_up_date, created_by.
- Tabel `loan_restructures`: pinjaman_id, alasan, tenor_baru, bunga_baru, cicilan_baru, status (pending/approved/rejected), approved_by, dokumen_url.
- Halaman `/admin/penagihan`: 
  - Tab "Tunggakan" — list angsuran `overdue/unpaid` + jatuh tempo lewat, urut by hari tunggakan, tombol "Log kontak" & "Ajukan restrukturisasi".
  - Tab "Riwayat kontak" — semua log.
  - Tab "Restrukturisasi" — pengajuan & approval, kalau approved bikin angsuran baru.

### 5. Laporan Keuangan SAK ETAP
- View/RPC SQL untuk agregasi:
  - `get_neraca(_tanggal)` — aset (kas/bank/piutang/aset tetap-akum.penyusutan) vs kewajiban (simpanan anggota) + ekuitas (modal/SHU ditahan).
  - `get_laba_rugi(_from, _to)` — pendapatan (bunga pinjaman, fee marketplace, denda) - beban (OPEX, penyusutan, pajak).
  - `get_arus_kas(_from, _to)` — operasi/investasi/pendanaan dari wallet_transactions + opex + assets.
  - `get_perubahan_ekuitas(_tahun)` — saldo awal, +SHU, -pembagian, saldo akhir.
- Halaman `/admin/laporan-keuangan`: 4 tab (Neraca, Laba Rugi, Arus Kas, Perubahan Ekuitas), filter periode, export PDF/Excel (pakai `jspdf` & `xlsx` yang sudah ada atau install).

## Akses & keamanan

- Semua tabel RLS: hanya `is_pengurus(auth.uid())` boleh CRUD, anggota tidak akses (kecuali laporan tertentu kalau diminta).
- Approval workflow OPEX pakai pola `approvals` table existing.
- Notifikasi (`notifications`) ke pengurus saat OPEX butuh approval, restrukturisasi diajukan, tunggakan jatuh tempo.

## Catatan UI

- Tambah menu pengurus di `src/routes/_authenticated/admin.tsx` (sidebar/grid pengurus) — Aset, OPEX, Pajak, Penagihan, Laporan Keuangan.
- Menu beranda anggota TIDAK diubah.
- Pakai komponen yang sudah ada (shadcn Table, Card, Dialog, Tabs).

## Estimasi

Tiap modul = 1–2 migrasi DB + 1–3 route file. Total ~5 migrasi + ~10 file route + update menu admin. Saya kerjakan modul **1 dulu (Aset & Inventaris)** dan minta review sebelum lanjut modul berikutnya — supaya tidak menumpuk error dan Anda bisa cek arah desainnya.
