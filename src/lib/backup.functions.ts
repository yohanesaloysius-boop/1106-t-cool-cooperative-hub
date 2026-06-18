import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { supabaseAdmin as SupabaseAdmin } from "@/integrations/supabase/client.server";

// Tabel yang boleh diekspor untuk backup. Whitelist eksplisit demi keamanan.
export const BACKUP_TABLES = [
  "profiles", "user_roles",
  "simpanan", "pinjaman", "angsuran", "shu", "shu_rewards",
  "wallets", "wallet_transactions", "transaksi",
  "tabungan_berjangka", "reserve_funds", "reserve_fund_movements",
  "approvals", "approval_histories", "audit_logs",
  "marketplace_stores", "marketplace_products", "marketplace_transactions",
  "marketplace_complaints", "marketplace_coupons", "marketplace_favorites",
  "marketplace_reviews", "marketplace_withdrawals",
  "loan_agreements", "loan_guarantors", "loan_verifications", "loan_restructures",
  "collection_cases", "collection_logs",
  "documents", "official_letters", "signatures", "member_cards",
  "meetings", "meeting_notes", "meeting_attendances",
  "surveys", "survey_questions", "survey_responses",
  "rat_votings", "rat_votes",
  "assets", "asset_depreciations", "opex_categories", "opex_expenses",
  "budget_plans", "budget_items", "bank_mutations", "qris_payments",
  "notifications", "notification_log", "pengumuman", "pending_iuran",
  "support_tickets", "support_messages",
  "lowongan_kerja", "permissions", "role_permissions", "settings",
  "church_divisions", "church_requesters", "church_vendors",
  "church_purchase_requests", "church_pr_items", "church_purchase_orders",
  "church_pr_payments", "church_pr_receipts", "church_pr_audit",
  "school_divisions", "school_requesters", "school_vendors",
  "school_purchase_requests", "school_pr_items", "school_purchase_orders",
  "school_pr_payments", "school_pr_receipts", "school_pr_audit",
] as const;

async function assertSuperAdmin(supabaseAdmin: typeof SupabaseAdmin, userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error(error.message);
  const ok = (data ?? []).some((r) => r.role === "super_admin");
  if (!ok) throw new Error("Hanya Super Admin yang boleh ekspor backup.");
}

const inputSchema = z.object({
  tables: z.array(z.enum(BACKUP_TABLES)).min(1).max(BACKUP_TABLES.length),
});

export const exportBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertSuperAdmin(supabaseAdmin, context.userId);
    const results: { table: string; rows: any[]; error: string | null; count: number }[] = [];
    for (const t of data.tables) {
      const { data: rows, error } = await supabaseAdmin.from(t as any).select("*").limit(50000);
      results.push({
        table: t,
        rows: rows ?? [],
        error: error?.message ?? null,
        count: rows?.length ?? 0,
      });
    }
    return {
      generated_at: new Date().toISOString(),
      tables: results,
    };
  });

export const listBackupTables = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertSuperAdmin(supabaseAdmin, context.userId);
    return { tables: BACKUP_TABLES as readonly string[] };
  });
