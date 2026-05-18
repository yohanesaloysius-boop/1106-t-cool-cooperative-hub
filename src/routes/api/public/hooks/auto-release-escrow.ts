import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Auto-release escrow: dipanggil pg_cron harian.
// Membaca setting `marketplace_auto_release_days` (default 7), lalu melepas
// dana escrow ke saldo penjual untuk semua pesanan "shipped" yang sudah lewat
// batas tersebut tapi belum dikonfirmasi pembeli.

export const Route = createFileRoute("/api/public/hooks/auto-release-escrow")({
  server: {
    handlers: {
      POST: async () => {
        // Ambil hari dari settings
        const { data: setting } = await supabaseAdmin
          .from("settings")
          .select("value")
          .eq("key", "marketplace_auto_release_days")
          .maybeSingle();

        let days = 7;
        const raw = setting?.value as unknown;
        if (typeof raw === "number") days = raw;
        else if (typeof raw === "string" && !isNaN(Number(raw))) days = Number(raw);

        const { data, error } = await supabaseAdmin.rpc(
          "mp_auto_release_escrow" as any,
          { _days: days },
        );

        if (error) {
          console.error("auto_release_escrow error", error);
          return Response.json(
            { ok: false, error: error.message },
            { status: 500 },
          );
        }

        const row = Array.isArray(data) ? (data[0] as any) : (data as any);
        return Response.json({
          ok: true,
          days,
          released_count: row?.released_count ?? 0,
          total_released: row?.total_released ?? 0,
          ts: new Date().toISOString(),
        });
      },
    },
  },
});
