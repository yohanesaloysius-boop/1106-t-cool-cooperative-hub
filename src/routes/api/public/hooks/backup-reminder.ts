import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyCronAuth } from "@/lib/cron-auth";

// Reminder backup harian untuk Super Admin.
// Dipanggil pg_cron sekali sehari. Idempotent: lewati jika notifikasi backup
// dengan ref yang sama sudah dibuat hari ini.
export const Route = createFileRoute("/api/public/hooks/backup-reminder")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = verifyCronAuth(request);
        if (unauth) return unauth;

        // Ambil semua Super Admin aktif
        const { data: roles } = await supabaseAdmin
          .from("user_roles")
          .select("user_id")
          .eq("role", "super_admin")
          .is("deleted_at", null);
        const recipients = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
        if (!recipients.length) return Response.json({ ok: true, sent: 0 });

        const dateKey = new Date().toISOString().slice(0, 10);
        const refTable = "backup:reminder";

        // Idempotent: skip penerima yang sudah dapat reminder hari ini
        const since = new Date();
        since.setUTCHours(0, 0, 0, 0);
        const { data: existing } = await supabaseAdmin
          .from("notifications")
          .select("user_id")
          .eq("ref_table", refTable)
          .eq("ref_id", dateKey)
          .gte("created_at", since.toISOString());
        const done = new Set((existing ?? []).map((r) => r.user_id));
        const targets = recipients.filter((id) => !done.has(id));
        if (!targets.length) return Response.json({ ok: true, sent: 0 });

        const rows = targets.map((uid) => ({
          user_id: uid,
          judul: "🗄️ Pengingat Backup Harian",
          pesan:
            "Jangan lupa backup data koperasi hari ini. Buka menu Backup untuk mengunduh snapshot (ZIP/Excel/JSON) dan simpan ke penyimpanan eksternal.",
          kategori: "sistem" as const,
          url: "/admin/backup",
          ref_table: refTable,
          ref_id: dateKey,
        }));
        const { error } = await supabaseAdmin.from("notifications").insert(rows);
        if (error) {
          console.error("backup reminder insert error", error);
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }
        return Response.json({ ok: true, sent: rows.length });
      },
    },
  },
});