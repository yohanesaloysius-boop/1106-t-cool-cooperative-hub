import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyCronAuth } from "@/lib/cron-auth";

// Auto-debet simpanan wajib bulanan.
// Dijalankan via pg_cron tanggal 1 setiap bulan jam 03:00 WIB.
// Idempotent: RPC akan skip user yang sudah punya simpanan wajib di periode tsb.

export const Route = createFileRoute("/api/public/hooks/auto-debet-wajib")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = verifyCronAuth(request);
        if (unauth) return unauth;
        let periode: string | null = null;
        try {
          const body = (await request.json()) as { periode?: string };
          periode = body?.periode ?? null;
        } catch {
          // empty body is fine
        }

        // Default: bulan berjalan (tanggal 1)
        if (!periode) {
          const d = new Date();
          periode = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
        }

        const { data, error } = await supabaseAdmin.rpc("auto_debet_simpanan_wajib", { _periode: periode });

        if (error) {
          console.error("auto_debet error", error);
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }

        const summary = Array.isArray(data) ? data[0] : data;
        return Response.json({ ok: true, periode, summary });
      },
    },
  },
});
