# Marketplace Komunitas — Struktur Dasar

Fokus tahap ini: **UI, routing, layout**. Belum bikin tabel database / transaksi / upload produk real — semua pakai data dummy supaya bisa cepat di-review.

## 1. Routing baru (TanStack file routes)

Halaman publik (tanpa login):
- `src/routes/marketplace.tsx` — Home Marketplace (hero, produk unggulan slider, toko pilihan, kategori, CTA gabung)
- `src/routes/marketplace.produk.$id.tsx` — Detail Produk
- `src/routes/marketplace.toko.$slug.tsx` — Detail Toko

Halaman anggota (di dalam `_authenticated`):
- `src/routes/_authenticated/marketplace-saya.tsx` — Dashboard Seller (toko saya + daftar produk saya, tombol tambah produk — placeholder)

Halaman admin (di dalam `_authenticated`, role `is_pengurus`):
- `src/routes/_authenticated/admin.marketplace.tsx` — Manajemen Marketplace (tab: Produk, Toko, Kategori, Laporan — placeholder tabel dummy)

## 2. Update navigasi

- **Header publik** (`site-header.tsx`): tambah link "Marketplace" ke nav utama.
- **Sidebar anggota** (`_authenticated.tsx`): tambah menu "Marketplace" + "Marketplace Saya".
- **Sidebar admin**: tambah menu "Manajemen Marketplace".

## 3. Update homepage (`src/routes/index.tsx`)

Placeholder "Marketplace Komunitas — Segera Hadir" di kolom kanan hero diganti jadi **preview card aktif** yang menampilkan:
- Mini hero
- 4 produk unggulan dummy (carousel auto-scroll horizontal)
- Tombol "Jelajahi Marketplace" → `/marketplace`

## 4. Komponen marketplace baru

`src/components/marketplace/`:
- `product-card.tsx` — kartu produk (gambar, nama, harga, toko, rating)
- `store-card.tsx` — kartu toko (logo, nama, kota, jumlah produk)
- `category-pill.tsx` — chip kategori
- `product-carousel.tsx` — slider auto-scroll horizontal pakai CSS marquee (re-use pola `animate-marquee-y`, dibuat varian horizontal)
- `marketplace-hero.tsx` — hero banner gradient + CTA

## 5. Data dummy

`src/lib/marketplace-mock.ts`:
- 12 produk dummy (nama Indonesia, harga rupiah, kategori, toko, rating, gambar dari Unsplash)
- 6 toko anggota
- 8 kategori (Kuliner, Fashion, Elektronik, Pertanian, Jasa, Kerajinan, Kesehatan, Lainnya)

Gambar pakai URL `https://images.unsplash.com/...` (tidak generate file lokal).

## 6. Role marketplace

Tambah field klien-side `is_seller` di `use-auth` (default `false`, toggle manual lewat tombol "Buka Toko" di halaman Marketplace Saya — UI only, belum simpan ke DB). Role admin pakai `is_pengurus` yang sudah ada.

## 7. Desain

- Token warna & shadow dari `styles.css` yang sudah ada (jangan hardcode).
- Style premium-modern (gaya Tokopedia/Shopee): kartu rounded-2xl, shadow halus, hover lift, badge diskon merah, harga primary, rating bintang amber.
- Responsive: grid 2 kolom mobile → 4 kolom desktop.
- Dark mode mengikuti theme yang sudah ada.

## Yang TIDAK dikerjakan tahap ini

- Tabel database produk/toko/transaksi
- Upload gambar produk
- Sistem pesan/chat
- Checkout/pembayaran
- Approval produk oleh admin (UI ada, tombol no-op)
- Persistensi role `seller`

Lanjut implementasi?