// Marketplace Komunitas — Supabase data layer
// Semua query terpusat di sini. Komponen tinggal panggil fungsi-fungsi ini.
import { supabase } from "@/integrations/supabase/client";

export type StoreStatus = "active" | "inactive" | "suspended";
export type ProductStatus = "draft" | "active" | "out_of_stock" | "archived";
export type TrxStatus =
  | "pending"
  | "confirmed"
  | "paid"
  | "shipped"
  | "completed"
  | "cancelled";

export type DbCategory = {
  id: string;
  nama_kategori: string;
  slug: string;
  icon: string | null;
};

export type DbStore = {
  id: string;
  member_id: string;
  nama_toko: string;
  slug: string;
  logo: string | null;
  banner: string | null;
  deskripsi: string | null;
  whatsapp: string | null;
  alamat: string | null;
  status_toko: StoreStatus;
  created_at: string;
  instagram?: string | null;
  facebook?: string | null;
  tiktok?: string | null;
  shopee?: string | null;
  promo_banner?: string | null;
  promo_text?: string | null;
};

export type DbProduct = {
  id: string;
  store_id: string;
  category_id: string | null;
  nama_produk: string;
  slug: string;
  harga: number;
  stok: number;
  deskripsi: string | null;
  gambar_produk: string[];
  status_produk: ProductStatus;
  created_at: string;
  view_count?: number;
  diskon_persen?: number;
  is_featured?: boolean;
};

export type DbTransaction = {
  id: string;
  buyer_id: string;
  seller_id: string;
  product_id: string;
  store_id: string;
  qty: number;
  harga_satuan: number;
  total: number;
  status: TrxStatus;
  catatan: string | null;
  created_at: string;
};

// ---------- helpers ----------
export const fmtIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
}

// ---------- CATEGORIES ----------
export async function listCategories() {
  const { data, error } = await supabase
    .from("marketplace_categories")
    .select("*")
    .order("nama_kategori");
  if (error) throw error;
  return data as DbCategory[];
}

// ---------- STORES ----------
export async function listStores(status: StoreStatus = "active") {
  const { data, error } = await supabase
    .from("marketplace_stores")
    .select("*")
    .eq("status_toko", status)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as DbStore[];
}

export async function getStoreBySlug(slug: string) {
  const { data, error } = await supabase
    .from("marketplace_stores")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data as DbStore | null;
}

export async function getMyStore(memberId: string) {
  const { data, error } = await supabase
    .from("marketplace_stores")
    .select("*")
    .eq("member_id", memberId)
    .maybeSingle();
  if (error) throw error;
  return data as DbStore | null;
}

export async function createMyStore(input: {
  member_id: string;
  nama_toko: string;
  whatsapp?: string;
  alamat?: string;
  deskripsi?: string;
  logo?: string;
  banner?: string;
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  shopee?: string;
}) {
  const base = slugify(input.nama_toko) || `toko-${Date.now()}`;
  const slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  const { data, error } = await supabase
    .from("marketplace_stores")
    .insert({ ...input, slug })
    .select()
    .single();
  if (error) throw error;
  return data as DbStore;
}

export async function updateStore(id: string, patch: Partial<DbStore>) {
  const { data, error } = await supabase
    .from("marketplace_stores")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as DbStore;
}

// ---------- PRODUCTS ----------
export async function listProductsPage(opts: {
  categorySlug?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(0, opts.page ?? 0);
  const pageSize = opts.pageSize ?? 12;
  const from = page * pageSize;
  const to = from + pageSize - 1;
  let q = supabase
    .from("marketplace_products")
    .select(
      "*, marketplace_categories!inner(slug, nama_kategori), marketplace_stores!inner(slug, nama_toko, status_toko)",
      { count: "exact" },
    )
    .eq("status_produk", "active")
    .eq("marketplace_stores.status_toko", "active")
    .order("created_at", { ascending: false })
    .range(from, to);
  if (opts.search) q = q.ilike("nama_produk", `%${opts.search}%`);
  if (opts.categorySlug) q = q.eq("marketplace_categories.slug", opts.categorySlug);
  const { data, error, count } = await q;
  if (error) throw error;
  return { rows: (data ?? []) as any[], count: count ?? 0, page, pageSize };
}

export async function listProducts(opts?: {
  categorySlug?: string;
  search?: string;
  limit?: number;
}) {
  let q = supabase
    .from("marketplace_products")
    .select("*, marketplace_categories(slug, nama_kategori), marketplace_stores!inner(slug, nama_toko, status_toko)")
    .eq("status_produk", "active")
    .eq("marketplace_stores.status_toko", "active")
    .order("created_at", { ascending: false });

  if (opts?.search) q = q.ilike("nama_produk", `%${opts.search}%`);
  if (opts?.limit) q = q.limit(opts.limit);

  const { data, error } = await q;
  if (error) throw error;
  let rows = (data ?? []) as any[];
  if (opts?.categorySlug) {
    rows = rows.filter((r) => r.marketplace_categories?.slug === opts.categorySlug);
  }
  return rows;
}

export async function getProductById(id: string) {
  const { data, error } = await supabase
    .from("marketplace_products")
    .select("*, marketplace_categories(slug, nama_kategori), marketplace_stores(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listStoreProducts(storeId: string) {
  const { data, error } = await supabase
    .from("marketplace_products")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as DbProduct[];
}

export async function createProduct(input: {
  store_id: string;
  nama_produk: string;
  category_id?: string | null;
  harga: number;
  stok: number;
  deskripsi?: string;
  gambar_produk?: string[];
  status_produk?: ProductStatus;
}) {
  const slug = `${slugify(input.nama_produk)}-${Math.random().toString(36).slice(2, 6)}`;
  const { data, error } = await supabase
    .from("marketplace_products")
    .insert({
      ...input,
      slug,
      gambar_produk: input.gambar_produk ?? [],
      status_produk: input.status_produk ?? "active",
    })
    .select()
    .single();
  if (error) throw error;
  return data as DbProduct;
}

export async function updateProduct(id: string, patch: Partial<DbProduct>) {
  const { data, error } = await supabase
    .from("marketplace_products")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as DbProduct;
}

export async function incrementProductView(productId: string) {
  // Best-effort; ignore errors
  try {
    await supabase.rpc("increment_product_view" as any, { _product_id: productId });
  } catch {}
}

export async function deleteProduct(id: string) {
  const { error } = await supabase.from("marketplace_products").delete().eq("id", id);
  if (error) throw error;
}

// ---------- TRANSACTIONS ----------
export async function createTransaction(input: {
  buyer_id: string;
  product_id: string;
  qty: number;
  catatan?: string;
}) {
  // Ambil data produk & seller dari DB (tidak percaya client untuk harga/seller)
  const { data: prod, error: prodErr } = await supabase
    .from("marketplace_products")
    .select("id, harga, store_id, marketplace_stores!inner(id, member_id)")
    .eq("id", input.product_id)
    .single();
  if (prodErr) throw prodErr;
  const seller_id = (prod as any).marketplace_stores.member_id as string;
  const store_id = (prod as any).store_id as string;
  const harga_satuan = Number((prod as any).harga);

  const { data, error } = await supabase
    .from("marketplace_transactions")
    .insert({
      buyer_id: input.buyer_id,
      seller_id,
      product_id: input.product_id,
      store_id,
      qty: input.qty,
      harga_satuan,
      total: harga_satuan * input.qty,
      catatan: input.catatan ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as DbTransaction;
}

export async function listMyPurchases(buyerId: string) {
  const { data, error } = await supabase
    .from("marketplace_transactions")
    .select("*, marketplace_products(nama_produk, gambar_produk)")
    .eq("buyer_id", buyerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listMySales(sellerId: string) {
  const { data, error } = await supabase
    .from("marketplace_transactions")
    .select("*, marketplace_products(nama_produk, gambar_produk)")
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function updateTransactionStatus(id: string, status: TrxStatus) {
  const { data, error } = await supabase
    .from("marketplace_transactions")
    .update({ status })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as DbTransaction;
}

// ---------- COUPONS ----------
export type DbCoupon = {
  id: string;
  code: string;
  deskripsi: string | null;
  tipe: "percent" | "fixed";
  nilai: number;
  min_belanja: number;
  max_diskon: number | null;
  store_id: string | null;
  kuota: number | null;
  used_count: number;
  berlaku_dari: string;
  berlaku_sampai: string | null;
  is_active: boolean;
};

export async function validateCoupon(code: string): Promise<DbCoupon> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("marketplace_coupons")
    .select("*")
    .eq("code", code.trim().toUpperCase())
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Kode kupon tidak ditemukan");
  const c = data as DbCoupon;
  if (c.berlaku_dari > today) throw new Error("Kupon belum berlaku");
  if (c.berlaku_sampai && c.berlaku_sampai < today) throw new Error("Kupon sudah kedaluwarsa");
  if (c.kuota !== null && c.used_count >= c.kuota) throw new Error("Kuota kupon habis");
  return c;
}

export function calcCouponDiscount(c: DbCoupon, subtotal: number): number {
  if (subtotal < Number(c.min_belanja)) return 0;
  let disc = c.tipe === "percent" ? (subtotal * Number(c.nilai)) / 100 : Number(c.nilai);
  if (c.max_diskon && disc > Number(c.max_diskon)) disc = Number(c.max_diskon);
  if (disc > subtotal) disc = subtotal;
  return Math.round(disc);
}

export async function consumeCoupon(id: string, currentUsed: number) {
  await supabase.from("marketplace_coupons").update({ used_count: currentUsed + 1 }).eq("id", id);
}

// ---------- REVIEWS ----------
export async function listProductReviews(productId: string) {
  const { data, error } = await supabase
    .from("marketplace_reviews")
    .select("*, profiles(nama_lengkap, foto_url)")
    .eq("product_id", productId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function upsertReview(input: {
  product_id: string;
  member_id: string;
  rating: number;
  komentar?: string;
}) {
  const { data, error } = await supabase
    .from("marketplace_reviews")
    .upsert(input, { onConflict: "product_id,member_id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---------- FAVORITES ----------
export async function listMyFavorites(memberId: string) {
  const { data, error } = await supabase
    .from("marketplace_favorites")
    .select("product_id, marketplace_products(*)")
    .eq("member_id", memberId);
  if (error) throw error;
  return data ?? [];
}

export async function addFavorite(memberId: string, productId: string) {
  const { error } = await supabase
    .from("marketplace_favorites")
    .insert({ member_id: memberId, product_id: productId });
  if (error) throw error;
}

export async function removeFavorite(memberId: string, productId: string) {
  const { error } = await supabase
    .from("marketplace_favorites")
    .delete()
    .eq("member_id", memberId)
    .eq("product_id", productId);
  if (error) throw error;
}

// ---------- STORAGE ----------
/** Upload file ke bucket `marketplace`. Path harus diawali userId (RLS). */
export async function uploadMarketplaceFile(
  userId: string,
  file: File,
  folder: "logo" | "banner" | "produk",
) {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${userId}/${folder}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from("marketplace")
    .upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from("marketplace").getPublicUrl(path);
  return data.publicUrl;
}
