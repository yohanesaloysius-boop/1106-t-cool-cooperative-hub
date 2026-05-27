import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Backup harian: dipanggil pg_cron tiap hari jam 02:00 WIB.
// Export semua tabel public ke satu JSON, upload ke storage bucket `backups`,
// lalu hapus backup yang lebih lama dari 7 hari.

export const Route = createFileRoute("/api/public/hooks/daily-backup")({
  server: {
    handlers: {
      POST: async () => {
        try {
          // 1. Ambil daftar semua tabel public
          const { data: tablesData, error: tablesErr } = await supabaseAdmin.rpc(
            "pg_catalog_list_public_tables" as any,
          );

          let tables: string[] = [];
          if (tablesErr || !tablesData) {
            // fallback: query langsung lewat REST tidak bisa pada information_schema,
            // jadi pakai daftar tabel via select dari pg_tables menggunakan SQL function
            // gagal? pakai daftar statis terbatas
            tables = [];
          } else {
            tables = (tablesData as any[]).map((r) => r.table_name);
          }

          // Fallback: hardcoded list (semua tabel utama)
          if (tables.length === 0) {
            const known = await supabaseAdmin
              .from("settings")
              .select("key")
              .limit(1);
            // Kalau bahkan settings tidak terbaca, batal.
            if (known.error) throw known.error;
            tables = KNOWN_TABLES;
          }

          // 2. Export tiap tabel
          const dump: Record<string, unknown> = {};
          const stats: Record<string, number> = {};
          for (const t of tables) {
            const { data, error } = await supabaseAdmin
              .from(t as any)
              .select("*");
            if (error) {
              dump[t] = { error: error.message };
              stats[t] = -1;
              continue;
            }
            dump[t] = data;
            stats[t] = data?.length ?? 0;
          }

          // 3. Upload JSON ke storage
          const now = new Date();
          const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, "-");
          const path = `${now.toISOString().slice(0, 10)}/backup-${stamp}.json`;
          const body = JSON.stringify(
            { generated_at: now.toISOString(), stats, data: dump },
            null,
            2,
          );

          const { error: upErr } = await supabaseAdmin.storage
            .from("backups")
            .upload(path, body, {
              contentType: "application/json",
              upsert: true,
            });
          if (upErr) throw upErr;

          // 4. Hapus backup lama (>7 hari) berdasarkan nama folder tanggal
          const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          const cutoffStr = cutoff.toISOString().slice(0, 10);
          const { data: folders } = await supabaseAdmin.storage
            .from("backups")
            .list("", { limit: 1000 });
          let deleted = 0;
          if (folders) {
            for (const f of folders) {
              if (f.name < cutoffStr) {
                const { data: files } = await supabaseAdmin.storage
                  .from("backups")
                  .list(f.name, { limit: 1000 });
                if (files && files.length > 0) {
                  const paths = files.map((x) => `${f.name}/${x.name}`);
                  await supabaseAdmin.storage.from("backups").remove(paths);
                  deleted += paths.length;
                }
              }
            }
          }

          return Response.json({
            ok: true,
            path,
            tables: tables.length,
            total_rows: Object.values(stats).reduce(
              (a, b) => a + Math.max(0, b),
              0,
            ),
            deleted_old: deleted,
            ts: now.toISOString(),
          });
        } catch (e: any) {
          console.error("daily-backup error", e);
          return Response.json(
            { ok: false, error: e?.message ?? String(e) },
            { status: 500 },
          );
        }
      },
    },
  },
});

// Daftar tabel utama (fallback). Dipakai kalau RPC list table tidak tersedia.
const KNOWN_TABLES: string[] = [
  "profiles",
  "user_roles",
  "settings",
  "notifications",
  "simpanan",
  "pinjaman",
  "angsuran",
  "shu",
  "wallets",
  "wallet_transactions",
  "marketplace_stores",
  "marketplace_products",
  "marketplace_transactions",
  "marketplace_complaints",
  "marketplace_withdrawals",
  "loan_guarantors",
  "loan_verifications",
  "verification_logs",
  "opex_expenses",
  "opex_categories",
  "budget_plans",
  "budget_items",
  "reserve_funds",
  "transaksi",
  "qris_payments",
  "church_purchase_requests",
  "school_purchase_requests",
  "school_requesters",
  "church_requesters",
  "rat_votings",
  "rat_votes",
  "audit_logs",
];