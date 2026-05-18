import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Hitung denda harian untuk angsuran yang lewat jatuh tempo.
// Idempotent: dipanggil setiap hari oleh pg_cron, selalu menghasilkan nilai
// denda terkini berdasarkan jumlah hari keterlambatan.
//
// Formula:
//   denda = MIN(nominal * (persen_per_hari/100) * days_late, nominal * (max_persen/100))

export const Route = createFileRoute("/api/public/hooks/accrue-fees")({
  server: {
    handlers: {
      POST: async () => {
        const out = { angsuran_updated: 0, total_denda: 0, notif: 0 };

        // Ambil setting
        const { data: settings } = await supabaseAdmin
          .from("settings")
          .select("key,value")
          .in("key", ["denda_persen_per_hari", "denda_max_persen"]);
        const map = new Map((settings ?? []).map((s) => [s.key, s.value as unknown]));
        const persen = Number(map.get("denda_persen_per_hari") ?? 0.1);
        const maxPersen = Number(map.get("denda_max_persen") ?? 30);

        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        const todayStr = today.toISOString().slice(0, 10);

        // Semua angsuran belum lunas yang sudah lewat jatuh tempo
        const { data: rows } = await supabaseAdmin
          .from("angsuran")
          .select("id, user_id, cicilan_ke, nominal, jatuh_tempo, denda")
          .in("status", ["unpaid", "overdue"])
          .lt("jatuh_tempo", todayStr)
          .is("deleted_at", null);

        if (!rows?.length) {
          return Response.json({ ok: true, ...out, persen, maxPersen, ts: new Date().toISOString() });
        }

        for (const r of rows) {
          const jt = new Date(r.jatuh_tempo);
          jt.setUTCHours(0, 0, 0, 0);
          const daysLate = Math.max(0, Math.floor((today.getTime() - jt.getTime()) / 86400000));
          if (daysLate <= 0) continue;
          const nominal = Number(r.nominal);
          const rawDenda = nominal * (persen / 100) * daysLate;
          const cap = nominal * (maxPersen / 100);
          const newDenda = Math.round(Math.min(rawDenda, cap));
          const prevDenda = Number(r.denda ?? 0);
          if (newDenda === prevDenda) continue;

          const { error } = await supabaseAdmin
            .from("angsuran")
            .update({ denda: newDenda, denda_updated_at: new Date().toISOString() })
            .eq("id", r.id);
          if (error) {
            console.error("update denda error", error);
            continue;
          }
          out.angsuran_updated += 1;
          out.total_denda += newDenda;
        }

        return Response.json({ ok: true, ...out, persen, maxPersen, ts: new Date().toISOString() });
      },
    },
  },
});
