# Framework: Pengadaan Barang Gereja via Koperasi

Modul baru untuk menangani permintaan pengadaan dari divisi/pelayanan gereja, dengan koperasi sebagai jasa pengadaan (fee 2%). Belum dieksekusi — minta persetujuan dulu.

## Alur Bisnis (9 langkah)

```text
[Divisi]                [Keuangan Gereja]        [Koperasi]              [Vendor]
   │                          │                       │                      │
1. Butuh barang               │                       │                      │
   │                          │                       │                      │
2. Buat PR ──────────────────►│                       │                      │
   (item, qty, est harga,     │                       │                      │
    tujuan, urgensi)          │                       │                      │
   │                     3. Cek budget                │                      │
   │                        approve/reject            │                      │
   │                          │                       │                      │
   │                     4. Sistem hitung fee 2%      │                      │
   │                        (auto, locked)            │                      │
   │                          │                       │                      │
   │                     5. PR approved ─────────────►│                      │
   │                          │                  6. Cari/pilih vendor        │
   │                          │                     (saran sistem +          │
   │                          │                      vendor tersimpan)       │
   │                          │                       │                      │
   │                          │                  Buat PO ───────────────────►│
   │                          │                       │                      │
   │                     7. Bayar langsung ──────────────────────────────────►│
   │                        ke vendor                 │                      │
   │                          │                       │                      │
   │                     8. Bayar fee 2% ────────────►│                      │
   │                        ke koperasi               │                      │
   │                          │                       │                      │
   │◄──────────────── 9. Barang diterima ◄────────────┴──────────────────────│
   │                     (langsung / via koperasi)                           │
   │                                                                         │
   └──► Histori: PR, approval, vendor, PO, nota, pembayaran, fee, serah-terima
```

## Status PR (Purchase Request)

`draft → submitted → approved_finance → forwarded_to_koperasi → vendor_selected → po_issued → paid_vendor → fee_paid → received → closed`

Cabang: `rejected` (oleh keuangan), `cancelled` (oleh pemohon).

## Entitas Data (rancangan tabel)

1. **church_divisions** — divisi/pelayanan (nama, PIC, kontak)
2. **church_vendors** — master vendor (nama, kategori, kontak, rekening, rating, catatan)
3. **church_purchase_requests** (PR)
   - division_id, requester_id, judul, tujuan, urgensi, status, est_total, fee_persen (default 2), fee_nominal, approved_by, approved_at, rejected_reason, koperasi_handler_id, timestamps
4. **church_pr_items** — pr_id, nama_barang, qty, satuan, est_harga_satuan, est_subtotal, harga_aktual, catatan
5. **church_purchase_orders** (PO) — pr_id, vendor_id, no_po, total_nilai, tanggal_po, status (issued/paid/delivered), file_po
6. **church_pr_payments** — pr_id, tipe (`to_vendor` | `fee_koperasi`), nominal, tanggal, metode, bukti_url, verified_by
7. **church_pr_receipts** — pr_id, tanggal_terima, penerima_id, kondisi, foto_url, catatan
8. **church_pr_audit** — pr_id, actor_id, action, from_status, to_status, payload jsonb, created_at

Fee 2% di-generate trigger saat status pindah ke `approved_finance` dan **locked** (tidak bisa diubah pemohon).

## Peran & Akses (RLS)

| Peran | Akses |
|---|---|
| **Anggota divisi (pemohon)** | CRUD PR miliknya (draft/submitted), lihat status & histori PR sendiri |
| **Keuangan gereja** | Lihat semua PR, approve/reject, verifikasi bukti bayar vendor & fee |
| **Koperasi (pengurus)** | Lihat PR `forwarded_to_koperasi`+, pilih vendor, buat PO, catat serah terima |
| **Ketua/Super admin** | Read-only semua + laporan |

## Halaman yang dibuat

**Sisi Gereja:**
- `/gereja/pengadaan` — list PR divisi, tombol "Ajukan PR Baru"
- `/gereja/pengadaan/$id` — detail PR + timeline status + dokumen
- `/admin/gereja/keuangan` — antrian approval keuangan gereja, tombol approve/reject, lihat budget tersisa
- `/admin/gereja/vendor` — master vendor gereja

**Sisi Koperasi:**
- `/admin/gereja/pengadaan` — PR yang masuk ke koperasi (tab: butuh vendor / PO aktif / menunggu serah terima / selesai)
- Action: pilih vendor → terbitkan PO → catat pembayaran vendor (oleh gereja) → catat fee diterima → catat serah terima

**Laporan:**
- `/admin/gereja/laporan-pengadaan` — rekap per periode: total PR, nilai pengadaan, fee koperasi, top vendor, top divisi, rata-rata lead time, export PDF/CSV

## Otomatisasi

- **Auto fee 2%**: trigger SQL saat `status='approved_finance'` → `fee_nominal = ROUND(est_total * fee_persen/100)`.
- **Notifikasi WA** (pakai pipeline `notification_log` yang sudah ada):
  - Keuangan: PR baru menunggu approval
  - Koperasi: PR baru masuk
  - Pemohon: status berubah (approved / vendor dipilih / barang siap)
- **Audit log**: setiap perubahan status masuk `church_pr_audit` (immutable).
- **Bukti wajib**: status `paid_vendor` & `fee_paid` butuh upload bukti transfer; status `received` butuh foto + tanda tangan PIC.

## Yang Belum Diputuskan (mohon konfirmasi)

1. **Budget gereja**: apakah perlu tabel `church_budgets` (per divisi per tahun) supaya keuangan bisa cek sisa otomatis, atau cek manual saja dulu?
2. **Fee 2%**: tetap fixed 2% atau bisa per-kategori (mis. jasa 2%, barang 1.5%)?
3. **Pembayaran fee**: dipotong dari pembayaran vendor (koperasi yang teruskan ke vendor) **atau** gereja bayar 2 transaksi terpisah (vendor + fee koperasi)? Alur kamu = terpisah, saya ikuti itu.
4. **Multi-vendor per PR**: 1 PR = 1 vendor, atau boleh split ke beberapa vendor?
5. **Approval bertingkat**: cukup keuangan saja (sesuai keputusan sebelumnya), tidak ada ketua yayasan — confirmed?

Setelah ini di-approve & 5 poin di atas dijawab, saya kerjakan migration + UI bertahap (Modul Gereja saja, sekolah ditangguhkan).
