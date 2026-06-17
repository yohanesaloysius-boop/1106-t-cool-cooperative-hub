-- Seed marketplace data: kategori, toko "Palugada", dan 12 produk di bawahnya.
-- Idempotent: aman dijalankan ulang (ON CONFLICT DO NOTHING / fixed UUID).

-- 1) Kategori marketplace
INSERT INTO public.marketplace_categories (id, nama_kategori, slug, icon) VALUES
  ('c1000000-0000-4000-8000-000000000001', 'Kuliner',    'kuliner',    '🍱'),
  ('c1000000-0000-4000-8000-000000000002', 'Fashion',    'fashion',    '👕'),
  ('c1000000-0000-4000-8000-000000000003', 'Elektronik', 'elektronik', '📱'),
  ('c1000000-0000-4000-8000-000000000004', 'Pertanian',  'pertanian',  '🌾'),
  ('c1000000-0000-4000-8000-000000000005', 'Jasa',       'jasa',       '🛠️'),
  ('c1000000-0000-4000-8000-000000000006', 'Kerajinan',  'kerajinan',  '🧵'),
  ('c1000000-0000-4000-8000-000000000007', 'Kesehatan',  'kesehatan',  '💊'),
  ('c1000000-0000-4000-8000-000000000008', 'Lainnya',    'lainnya',    '📦')
ON CONFLICT (slug) DO UPDATE SET nama_kategori = EXCLUDED.nama_kategori, icon = EXCLUDED.icon;

-- 2) Toko "Palugada" (dimiliki Super Admin agar dapat dikelola)
INSERT INTO public.marketplace_stores
  (id, member_id, nama_toko, slug, logo, banner, deskripsi, whatsapp, alamat, status_toko)
VALUES (
  'a1000000-0000-4000-8000-0000000000a1',
  '56ac3eeb-1ced-4a1a-bad9-4b442d41b1ff',
  'Palugada',
  'palugada',
  'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=200&h=200&fit=crop',
  'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&h=400&fit=crop',
  'Palugada — "Apa Lu Mau Gua Ada". Toko serba ada milik komunitas koperasi: kuliner, fashion, elektronik, pertanian, kerajinan, kesehatan, hingga jasa.',
  '6281372776788',
  'Batam, Kepulauan Riau',
  'active'
)
ON CONFLICT (id) DO UPDATE SET
  nama_toko = EXCLUDED.nama_toko,
  status_toko = 'active',
  member_id = EXCLUDED.member_id;

-- 3) Produk (semua di bawah toko Palugada)
INSERT INTO public.marketplace_products
  (id, store_id, category_id, nama_produk, slug, harga, stok, deskripsi, gambar_produk, status_produk, diskon_persen, is_featured)
VALUES
  ('b1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-0000000000a1',(SELECT id FROM public.marketplace_categories WHERE slug='kuliner'),
   'Nasi Box Ayam Bakar Madu','nasi-box-ayam-bakar-madu',25000,50,
   'Nasi box komplit: ayam bakar madu, lalapan, sambal, dan kerupuk. Min order 5 box.',
   ARRAY['https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&h=600&fit=crop'],'active',17,true),

  ('b1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-0000000000a1',(SELECT id FROM public.marketplace_categories WHERE slug='fashion'),
   'Kemeja Batik Pria Premium','kemeja-batik-pria-premium',185000,30,
   'Bahan katun halus, motif klasik Solo. Tersedia ukuran M, L, XL, XXL.',
   ARRAY['https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=600&h=600&fit=crop'],'active',26,true),

  ('b1000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-0000000000a1',(SELECT id FROM public.marketplace_categories WHERE slug='pertanian'),
   'Sayur Organik Mix 1kg','sayur-organik-mix-1kg',35000,100,
   'Paket sayur organik segar: bayam, kangkung, sawi, brokoli. Panen pagi.',
   ARRAY['https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&h=600&fit=crop'],'active',0,false),

  ('b1000000-0000-4000-8000-000000000004','a1000000-0000-4000-8000-0000000000a1',(SELECT id FROM public.marketplace_categories WHERE slug='kerajinan'),
   'Tas Rajut Handmade','tas-rajut-handmade',145000,12,
   'Tas rajut tangan dengan benang katun premium. Custom warna tersedia.',
   ARRAY['https://images.unsplash.com/photo-1591561954557-26941169b49e?w=600&h=600&fit=crop'],'active',17,true),

  ('b1000000-0000-4000-8000-000000000005','a1000000-0000-4000-8000-0000000000a1',(SELECT id FROM public.marketplace_categories WHERE slug='elektronik'),
   'Earphone Bluetooth TWS','earphone-bluetooth-tws',89000,80,
   'Earphone wireless Bluetooth 5.3, noise cancelling, baterai tahan 24 jam.',
   ARRAY['https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&h=600&fit=crop'],'active',26,true),

  ('b1000000-0000-4000-8000-000000000006','a1000000-0000-4000-8000-0000000000a1',(SELECT id FROM public.marketplace_categories WHERE slug='kesehatan'),
   'Jamu Kunyit Asam 250ml','jamu-kunyit-asam-250ml',15000,60,
   'Jamu tradisional racikan keluarga, tanpa pengawet. Diminum dingin lebih segar.',
   ARRAY['https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600&h=600&fit=crop'],'active',0,false),

  ('b1000000-0000-4000-8000-000000000007','a1000000-0000-4000-8000-0000000000a1',(SELECT id FROM public.marketplace_categories WHERE slug='jasa'),
   'Catering Harian 1 Bulan','catering-harian-1-bulan',750000,10,
   'Paket catering 1 bulan (25 hari kerja). Menu variatif, diantar setiap hari.',
   ARRAY['https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=600&h=600&fit=crop'],'active',17,false),

  ('b1000000-0000-4000-8000-000000000008','a1000000-0000-4000-8000-0000000000a1',(SELECT id FROM public.marketplace_categories WHERE slug='fashion'),
   'Selendang Batik Cap','selendang-batik-cap',95000,25,
   'Selendang batik cap motif parang, cocok untuk acara formal & kondangan.',
   ARRAY['https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600&h=600&fit=crop'],'active',0,false),

  ('b1000000-0000-4000-8000-000000000009','a1000000-0000-4000-8000-0000000000a1',(SELECT id FROM public.marketplace_categories WHERE slug='pertanian'),
   'Madu Hutan Murni 500ml','madu-hutan-murni-500ml',125000,40,
   'Madu hutan asli dari peternak lokal. Tidak dicampur gula, lulus uji lab.',
   ARRAY['https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=600&h=600&fit=crop'],'active',0,true),

  ('b1000000-0000-4000-8000-000000000010','a1000000-0000-4000-8000-0000000000a1',(SELECT id FROM public.marketplace_categories WHERE slug='kerajinan'),
   'Dompet Kulit Custom Nama','dompet-kulit-custom-nama',165000,18,
   'Dompet kulit sapi asli, bisa diukir nama gratis. Tahan lama, makin tua makin keren.',
   ARRAY['https://images.unsplash.com/photo-1627123424574-724758594e93?w=600&h=600&fit=crop'],'active',18,false),

  ('b1000000-0000-4000-8000-000000000011','a1000000-0000-4000-8000-0000000000a1',(SELECT id FROM public.marketplace_categories WHERE slug='elektronik'),
   'Powerbank 20000mAh Fast Charge','powerbank-20000mah-fast-charge',215000,55,
   'Powerbank PD 22.5W, 3 port output, bisa charge laptop. Garansi 1 tahun.',
   ARRAY['https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=600&h=600&fit=crop'],'active',22,true),

  ('b1000000-0000-4000-8000-000000000012','a1000000-0000-4000-8000-0000000000a1',(SELECT id FROM public.marketplace_categories WHERE slug='kesehatan'),
   'Minyak Telon Herbal 100ml','minyak-telon-herbal-100ml',38000,90,
   'Minyak telon plus chamomile, aman untuk bayi & balita. Wangi lembut.',
   ARRAY['https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=600&h=600&fit=crop'],'active',0,false)
ON CONFLICT (id) DO UPDATE SET
  store_id = EXCLUDED.store_id,
  nama_produk = EXCLUDED.nama_produk,
  harga = EXCLUDED.harga,
  status_produk = 'active';