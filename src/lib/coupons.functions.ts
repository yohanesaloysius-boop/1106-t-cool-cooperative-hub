import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

// Validate a coupon by its exact code. Runs server-side with the service-role
// client so that the coupons table is NOT broadly readable by clients
// (prevents enumeration of all coupon codes). Only an exact code match is
// returned, and only to authenticated users.
export const validateCouponFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ code: z.string().trim().min(1).max(64) }).parse(data),
  )
  .handler(async ({ data }): Promise<DbCoupon> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const today = new Date().toISOString().slice(0, 10);
    const { data: row, error } = await supabaseAdmin
      .from("marketplace_coupons")
      .select("*")
      .eq("code", data.code.trim().toUpperCase())
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw new Error("Gagal memvalidasi kupon");
    if (!row) throw new Error("Kode kupon tidak ditemukan");
    const c = row as DbCoupon;
    if (c.berlaku_dari > today) throw new Error("Kupon belum berlaku");
    if (c.berlaku_sampai && c.berlaku_sampai < today) throw new Error("Kupon sudah kedaluwarsa");
    if (c.kuota !== null && c.used_count >= c.kuota) throw new Error("Kuota kupon habis");
    return c;
  });

// Increment a coupon's usage counter server-side.
export const consumeCouponFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error: readErr } = await supabaseAdmin
      .from("marketplace_coupons")
      .select("used_count")
      .eq("id", data.id)
      .maybeSingle();
    if (readErr || !row) throw new Error("Kupon tidak ditemukan");
    const { error } = await supabaseAdmin
      .from("marketplace_coupons")
      .update({ used_count: (row.used_count ?? 0) + 1 })
      .eq("id", data.id);
    if (error) throw new Error("Gagal memperbarui kupon");
    return { ok: true };
  });
