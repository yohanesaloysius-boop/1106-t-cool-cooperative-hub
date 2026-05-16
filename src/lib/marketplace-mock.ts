// Data dummy untuk Marketplace Komunitas
// Belum tersambung database — pakai gambar dari Unsplash

export type MarketplaceCategory = {
  slug: string;
  label: string;
  emoji: string;
};

export type MarketplaceStore = {
  slug: string;
  nama: string;
  pemilik: string;
  kota: string;
  logo: string;
  cover: string;
  rating: number;
  produk_count: number;
  bergabung: string; // ISO date
  deskripsi: string;
};

export type MarketplaceProduct = {
  id: string;
  nama: string;
  harga: number;
  harga_coret?: number;
  gambar: string;
  kategori: string; // category slug
  toko_slug: string;
  rating: number;
  terjual: number;
  lokasi: string;
  deskripsi: string;
  stok: number;
};

export const CATEGORIES: MarketplaceCategory[] = [
  { slug: "kuliner", label: "Kuliner", emoji: "🍱" },
  { slug: "fashion", label: "Fashion", emoji: "👕" },
  { slug: "elektronik", label: "Elektronik", emoji: "📱" },
  { slug: "pertanian", label: "Pertanian", emoji: "🌾" },
  { slug: "jasa", label: "Jasa", emoji: "🛠️" },
  { slug: "kerajinan", label: "Kerajinan", emoji: "🧵" },
  { slug: "kesehatan", label: "Kesehatan", emoji: "💊" },
  { slug: "lainnya", label: "Lainnya", emoji: "📦" },
];

export const STORES: MarketplaceStore[] = [
  {
    slug: "dapur-bu-sari",
    nama: "Dapur Bu Sari",
    pemilik: "Sari Wulandari",
    kota: "Batam",
    logo: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=200&h=200&fit=crop",
    cover: "https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=1200&h=400&fit=crop",
    rating: 4.9,
    produk_count: 18,
    bergabung: "2024-03-12",
    deskripsi: "Makanan rumahan halal, fresh setiap hari. Pesan H-1 untuk catering.",
  },
  {
    slug: "batik-nusantara",
    nama: "Batik Nusantara",
    pemilik: "Ahmad Fauzi",
    kota: "Solo",
    logo: "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=200&h=200&fit=crop",
    cover: "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=1200&h=400&fit=crop",
    rating: 4.8,
    produk_count: 32,
    bergabung: "2024-01-20",
    deskripsi: "Batik tulis & cap khas Solo. Kualitas ekspor, harga komunitas.",
  },
  {
    slug: "tani-makmur",
    nama: "Tani Makmur",
    pemilik: "Pak Sutrisno",
    kota: "Malang",
    logo: "https://images.unsplash.com/photo-1500595046743-cd271d694d30?w=200&h=200&fit=crop",
    cover: "https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=1200&h=400&fit=crop",
    rating: 4.7,
    produk_count: 24,
    bergabung: "2023-11-05",
    deskripsi: "Hasil panen segar langsung dari kebun. Sayur, buah, dan rempah organik.",
  },
  {
    slug: "kriya-handmade",
    nama: "Kriya Handmade",
    pemilik: "Dewi Anggraeni",
    kota: "Yogyakarta",
    logo: "https://images.unsplash.com/photo-1528459801416-a9e53bbf4e17?w=200&h=200&fit=crop",
    cover: "https://images.unsplash.com/photo-1607344645866-009c320b63e0?w=1200&h=400&fit=crop",
    rating: 4.9,
    produk_count: 14,
    bergabung: "2024-05-08",
    deskripsi: "Kerajinan tangan custom: tas rajut, dompet kulit, aksesoris unik.",
  },
  {
    slug: "gadget-store",
    nama: "T-Cool Gadget",
    pemilik: "Rizky Pratama",
    kota: "Jakarta",
    logo: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=200&h=200&fit=crop",
    cover: "https://images.unsplash.com/photo-1468495244123-6c6c332eeece?w=1200&h=400&fit=crop",
    rating: 4.6,
    produk_count: 41,
    bergabung: "2023-09-14",
    deskripsi: "Aksesoris HP, charger, earphone berkualitas dengan garansi komunitas.",
  },
  {
    slug: "herbal-sehat",
    nama: "Herbal Sehat",
    pemilik: "Bu Ratna",
    kota: "Bandung",
    logo: "https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=200&h=200&fit=crop",
    cover: "https://images.unsplash.com/photo-1471193945509-9ad0617afabf?w=1200&h=400&fit=crop",
    rating: 4.8,
    produk_count: 22,
    bergabung: "2024-02-28",
    deskripsi: "Jamu tradisional & herbal racikan tangan. BPOM terdaftar.",
  },
];

export const PRODUCTS: MarketplaceProduct[] = [
  {
    id: "p1",
    nama: "Nasi Box Ayam Bakar Madu",
    harga: 25000,
    harga_coret: 30000,
    gambar: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&h=600&fit=crop",
    kategori: "kuliner",
    toko_slug: "dapur-bu-sari",
    rating: 4.9,
    terjual: 320,
    lokasi: "Batam",
    deskripsi: "Nasi box komplit: ayam bakar madu, lalapan, sambal, dan kerupuk. Min order 5 box.",
    stok: 50,
  },
  {
    id: "p2",
    nama: "Kemeja Batik Pria Premium",
    harga: 185000,
    harga_coret: 250000,
    gambar: "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=600&h=600&fit=crop",
    kategori: "fashion",
    toko_slug: "batik-nusantara",
    rating: 4.8,
    terjual: 156,
    lokasi: "Solo",
    deskripsi: "Bahan katun halus, motif klasik Solo. Tersedia ukuran M, L, XL, XXL.",
    stok: 30,
  },
  {
    id: "p3",
    nama: "Sayur Organik Mix 1kg",
    harga: 35000,
    gambar: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&h=600&fit=crop",
    kategori: "pertanian",
    toko_slug: "tani-makmur",
    rating: 4.7,
    terjual: 89,
    lokasi: "Malang",
    deskripsi: "Paket sayur organik segar: bayam, kangkung, sawi, brokoli. Panen pagi.",
    stok: 100,
  },
  {
    id: "p4",
    nama: "Tas Rajut Handmade",
    harga: 145000,
    harga_coret: 175000,
    gambar: "https://images.unsplash.com/photo-1591561954557-26941169b49e?w=600&h=600&fit=crop",
    kategori: "kerajinan",
    toko_slug: "kriya-handmade",
    rating: 5.0,
    terjual: 78,
    lokasi: "Yogyakarta",
    deskripsi: "Tas rajut tangan dengan benang katun premium. Custom warna tersedia.",
    stok: 12,
  },
  {
    id: "p5",
    nama: "Earphone Bluetooth TWS",
    harga: 89000,
    harga_coret: 120000,
    gambar: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&h=600&fit=crop",
    kategori: "elektronik",
    toko_slug: "gadget-store",
    rating: 4.5,
    terjual: 412,
    lokasi: "Jakarta",
    deskripsi: "Earphone wireless Bluetooth 5.3, noise cancelling, baterai tahan 24 jam.",
    stok: 80,
  },
  {
    id: "p6",
    nama: "Jamu Kunyit Asam 250ml",
    harga: 15000,
    gambar: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600&h=600&fit=crop",
    kategori: "kesehatan",
    toko_slug: "herbal-sehat",
    rating: 4.9,
    terjual: 234,
    lokasi: "Bandung",
    deskripsi: "Jamu tradisional racikan keluarga, tanpa pengawet. Diminum dingin lebih segar.",
    stok: 60,
  },
  {
    id: "p7",
    nama: "Catering Harian 1 Bulan",
    harga: 750000,
    harga_coret: 900000,
    gambar: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=600&h=600&fit=crop",
    kategori: "jasa",
    toko_slug: "dapur-bu-sari",
    rating: 4.8,
    terjual: 45,
    lokasi: "Batam",
    deskripsi: "Paket catering 1 bulan (25 hari kerja). Menu variatif, diantar setiap hari.",
    stok: 10,
  },
  {
    id: "p8",
    nama: "Selendang Batik Cap",
    harga: 95000,
    gambar: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600&h=600&fit=crop",
    kategori: "fashion",
    toko_slug: "batik-nusantara",
    rating: 4.7,
    terjual: 67,
    lokasi: "Solo",
    deskripsi: "Selendang batik cap motif parang, cocok untuk acara formal & kondangan.",
    stok: 25,
  },
  {
    id: "p9",
    nama: "Madu Hutan Murni 500ml",
    harga: 125000,
    gambar: "https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=600&h=600&fit=crop",
    kategori: "pertanian",
    toko_slug: "tani-makmur",
    rating: 4.9,
    terjual: 198,
    lokasi: "Malang",
    deskripsi: "Madu hutan asli dari peternak lokal. Tidak dicampur gula, lulus uji lab.",
    stok: 40,
  },
  {
    id: "p10",
    nama: "Dompet Kulit Custom Nama",
    harga: 165000,
    harga_coret: 200000,
    gambar: "https://images.unsplash.com/photo-1627123424574-724758594e93?w=600&h=600&fit=crop",
    kategori: "kerajinan",
    toko_slug: "kriya-handmade",
    rating: 4.9,
    terjual: 102,
    lokasi: "Yogyakarta",
    deskripsi: "Dompet kulit sapi asli, bisa diukir nama gratis. Tahan lama, makin tua makin keren.",
    stok: 18,
  },
  {
    id: "p11",
    nama: "Powerbank 20000mAh Fast Charge",
    harga: 215000,
    harga_coret: 275000,
    gambar: "https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=600&h=600&fit=crop",
    kategori: "elektronik",
    toko_slug: "gadget-store",
    rating: 4.6,
    terjual: 287,
    lokasi: "Jakarta",
    deskripsi: "Powerbank PD 22.5W, 3 port output, bisa charge laptop. Garansi 1 tahun.",
    stok: 55,
  },
  {
    id: "p12",
    nama: "Minyak Telon Herbal 100ml",
    harga: 38000,
    gambar: "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=600&h=600&fit=crop",
    kategori: "kesehatan",
    toko_slug: "herbal-sehat",
    rating: 4.8,
    terjual: 521,
    lokasi: "Bandung",
    deskripsi: "Minyak telon plus chamomile, aman untuk bayi & balita. Wangi lembut.",
    stok: 90,
  },
];

export const fmtIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

export function getProduct(id: string) {
  return PRODUCTS.find((p) => p.id === id);
}

export function getStore(slug: string) {
  return STORES.find((s) => s.slug === slug);
}

export function getStoreProducts(slug: string) {
  return PRODUCTS.filter((p) => p.toko_slug === slug);
}

export function getCategory(slug: string) {
  return CATEGORIES.find((c) => c.slug === slug);
}
