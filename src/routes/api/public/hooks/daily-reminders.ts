import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyCronAuth } from "@/lib/cron-auth";

// Daily follow-up reminders.
// - In-app notifications (table: notifications) — always
// - WhatsApp queue (table: notification_log channel=whatsapp) — added per item bila
//   anggota punya nomor telepon. Pengurus tinggal klik "Kirim" di /admin/notifikasi-wa
//   untuk membuka WA dengan pesan otomatis.
// Triggered by pg_cron once a day. Idempotent: skips if a notification with the
// same ref_table/ref_id was already created today.

type NotifInsert = {
  user_id: string;
  judul: string;
  pesan: string;
  kategori: "info" | "peringatan" | "approval" | "sistem";
  url?: string | null;
  ref_table?: string | null;
  ref_id?: string | null;
};

type WaInsert = {
  user_id: string;
  template: string;
  pesan: string;
  ref_table: string;
  ref_id: string;
};

function normalizePhone(raw?: string | null): string | null {
  if (!raw) return null;
  let s = raw.replace(/[^0-9+]/g, "");
  if (s.startsWith("+")) s = s.slice(1);
  if (s.startsWith("0")) s = "62" + s.slice(1);
  if (s.startsWith("8")) s = "62" + s;
  if (!/^\d{8,15}$/.test(s)) return null;
  return s;
}

async function alreadySentToday(user_id: string, ref_table: string, ref_id: string) {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const { data } = await supabaseAdmin
    .from("notifications")
    .select("id")
    .eq("user_id", user_id)
    .eq("ref_table", ref_table)
    .eq("ref_id", ref_id)
    .gte("created_at", since.toISOString())
    .limit(1)
    .maybeSingle();
  return !!data;
}

async function enqueue(items: NotifInsert[]) {
  const fresh: NotifInsert[] = [];
  for (const n of items) {
    if (n.ref_table && n.ref_id && (await alreadySentToday(n.user_id, n.ref_table, n.ref_id))) continue;
    fresh.push(n);
  }
  if (!fresh.length) return 0;
  const { error } = await supabaseAdmin.from("notifications").insert(fresh);
  if (error) {
    console.error("notif insert error", error);
    return 0;
  }
  return fresh.length;
}

async function enqueueWa(items: WaInsert[]) {
  if (!items.length) return 0;
  // Lookup phones in batch
  const userIds = Array.from(new Set(items.map((i) => i.user_id)));
  const { data: profs } = await supabaseAdmin
    .from("profiles")
    .select("id, nama_lengkap, no_telepon")
    .in("id", userIds);
  const profMap = new Map((profs ?? []).map((p: any) => [p.id, p]));

  // Dedup vs existing same-day same-ref entries to avoid double queueing
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const rows: any[] = [];
  for (const it of items) {
    const p = profMap.get(it.user_id);
    if (!p) continue;
    const phone = normalizePhone((p as any).no_telepon);
    if (!phone) continue;
    const dedupKey = `${it.ref_table}:${it.ref_id}:wa:${new Date().toISOString().slice(0, 10)}`;
    const { data: exists } = await supabaseAdmin
      .from("notification_log")
      .select("id")
      .eq("dedup_key", dedupKey)
      .limit(1)
      .maybeSingle();
    if (exists) continue;
    rows.push({
      target_user: it.user_id,
      target_address: phone,
      channel: "whatsapp",
      template: it.template,
      payload: { nama: (p as any).nama_lengkap ?? "", pesan: it.pesan },
      status: "queued",
      ref_table: it.ref_table,
      ref_id: it.ref_id,
      dedup_key: dedupKey,
    });
  }
  if (!rows.length) return 0;
  const { error } = await supabaseAdmin.from("notification_log").insert(rows);
  if (error) {
    console.error("wa enqueue error", error);
    return 0;
  }
  return rows.length;
}


export const Route = createFileRoute("/api/public/hooks/daily-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = verifyCronAuth(request);
        if (unauth) return unauth;
        const summary = { simpanan_pokok: 0, h3: 0, overdue: 0, meeting: 0, pending_verifikasi: 0, iuran_wajib: 0, iuran_late: 0, wa_queued: 0 };

        // ===== Iuran wajib bulanan =====
        // - Tanggal 25 / 28 / akhir bulan → reminder kalau belum setor iuran wajib bulan berjalan
        // - Tanggal 1-3 bulan berikutnya → notifikasi keterlambatan bulan sebelumnya
        const nowD = new Date();
        const todayDay = nowD.getUTCDate();
        const lastDayOfMonth = new Date(Date.UTC(nowD.getUTCFullYear(), nowD.getUTCMonth() + 1, 0)).getUTCDate();
        const startThisMonth = new Date(Date.UTC(nowD.getUTCFullYear(), nowD.getUTCMonth(), 1));
        const startNextMonth = new Date(Date.UTC(nowD.getUTCFullYear(), nowD.getUTCMonth() + 1, 1));
        const startPrevMonth = new Date(Date.UTC(nowD.getUTCFullYear(), nowD.getUTCMonth() - 1, 1));
        const thisMonthKey = `${nowD.getUTCFullYear()}-${String(nowD.getUTCMonth() + 1).padStart(2, "0")}`;
        const prevDate = new Date(Date.UTC(nowD.getUTCFullYear(), nowD.getUTCMonth() - 1, 1));
        const prevMonthKey = `${prevDate.getUTCFullYear()}-${String(prevDate.getUTCMonth() + 1).padStart(2, "0")}`;

        const isReminderDay = todayDay === 25 || todayDay === lastDayOfMonth - 1 || todayDay === lastDayOfMonth;
        const isLateDay = todayDay >= 1 && todayDay <= 3;

        if (isReminderDay || isLateDay) {
          const { data: activeMembers } = await supabaseAdmin
            .from("profiles")
            .select("id, nama_lengkap")
            .eq("status", "active")
            .is("deleted_at", null);

          if (activeMembers?.length) {
            const ids = activeMembers.map((m) => m.id);

            if (isReminderDay) {
              const { data: paidThis } = await supabaseAdmin
                .from("simpanan")
                .select("user_id")
                .in("user_id", ids)
                .eq("jenis", "wajib")
                .in("status", ["pending", "verified"])
                .gte("created_at", startThisMonth.toISOString())
                .lt("created_at", startNextMonth.toISOString())
                .is("deleted_at", null);
              const paidSet = new Set((paidThis ?? []).map((r) => r.user_id));
              const targets = activeMembers.filter((m) => !paidSet.has(m.id));
              const daysLeft = lastDayOfMonth - todayDay;
              const labelWaktu = daysLeft <= 0 ? "hari ini" : `${daysLeft} hari lagi`;
              summary.iuran_wajib = await enqueue(
                targets.map((m) => ({
                  user_id: m.id,
                  judul: "Iuran Wajib Bulan Ini",
                  pesan: `Iuran wajib bulan ${thisMonthKey} jatuh tempo ${labelWaktu}. Mohon segera setor untuk menjaga keanggotaan aktif.`,
                  kategori: "peringatan",
                  url: "/simpanan",
                  ref_table: `simpanan:wajib:${thisMonthKey}`,
                  ref_id: m.id,
                })),
              );
              summary.wa_queued += await enqueueWa(
                targets.map((m) => ({
                  user_id: m.id,
                  template: "simpanan",
                  pesan: `Halo ${m.nama_lengkap}, mengingatkan setoran simpanan wajib bulan ${thisMonthKey} di Koperasi T-COOL — jatuh tempo ${labelWaktu}. Terima kasih 🌱`,
                  ref_table: `simpanan:wajib:${thisMonthKey}`,
                  ref_id: m.id,
                })),
              );
            }

            if (isLateDay) {
              const { data: paidPrev } = await supabaseAdmin
                .from("simpanan")
                .select("user_id")
                .in("user_id", ids)
                .eq("jenis", "wajib")
                .in("status", ["pending", "verified"])
                .gte("created_at", startPrevMonth.toISOString())
                .lt("created_at", startThisMonth.toISOString())
                .is("deleted_at", null);
              const paidSet = new Set((paidPrev ?? []).map((r) => r.user_id));
              const targets = activeMembers.filter((m) => !paidSet.has(m.id));
              summary.iuran_late = await enqueue(
                targets.map((m) => ({
                  user_id: m.id,
                  judul: "Iuran Wajib Terlambat",
                  pesan: `Iuran wajib bulan ${prevMonthKey} belum tercatat. Tunggakan dapat memengaruhi eligibility & skor kredit Anda.`,
                  kategori: "peringatan",
                  url: "/simpanan",
                  ref_table: `simpanan:wajib-late:${prevMonthKey}`,
                  ref_id: m.id,
                })),
              );
            }
          }
        }

        // 1) Anggota baru aktif tapi belum setor simpanan pokok (>= 3 hari sejak joined_at)
        const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
        const { data: newMembers } = await supabaseAdmin
          .from("profiles")
          .select("id, nama_lengkap, joined_at")
          .eq("status", "active")
          .lte("joined_at", threeDaysAgo)
          .is("deleted_at", null);

        if (newMembers?.length) {
          const ids = newMembers.map((m) => m.id);
          const { data: pokok } = await supabaseAdmin
            .from("simpanan")
            .select("user_id")
            .in("user_id", ids)
            .eq("jenis", "pokok")
            .in("status", ["pending", "verified"])
            .is("deleted_at", null);
          const haveSet = new Set((pokok ?? []).map((p) => p.user_id));
          const targets = newMembers.filter((m) => !haveSet.has(m.id));
          summary.simpanan_pokok = await enqueue(
            targets.map((m) => ({
              user_id: m.id,
              judul: "Setor Simpanan Pokok",
              pesan: "Anda belum menyetor simpanan pokok. Mohon segera lakukan setoran untuk mengaktifkan keanggotaan penuh.",
              kategori: "peringatan",
              url: "/simpanan",
              ref_table: "profiles:simpanan_pokok",
              ref_id: m.id,
            })),
          );
        }

        // 2) Angsuran H-3 (jatuh_tempo dalam 3 hari ke depan)
        const today = new Date(); today.setUTCHours(0, 0, 0, 0);
        const h3 = new Date(today.getTime() + 3 * 86400000);
        const { data: dueSoon } = await supabaseAdmin
          .from("angsuran")
          .select("id, user_id, cicilan_ke, nominal, jatuh_tempo")
          .eq("status", "unpaid")
          .eq("jatuh_tempo", h3.toISOString().slice(0, 10))
          .is("deleted_at", null);
        if (dueSoon?.length) {
          summary.h3 = await enqueue(
            dueSoon.map((a) => ({
              user_id: a.user_id,
              judul: "Angsuran Jatuh Tempo 3 Hari Lagi",
              pesan: `Cicilan ke-${a.cicilan_ke} sebesar Rp ${Number(a.nominal).toLocaleString("id-ID")} jatuh tempo ${a.jatuh_tempo}.`,
              kategori: "peringatan",
              url: "/angsuran",
              ref_table: "angsuran:h3",
              ref_id: a.id,
            })),
          );
          summary.wa_queued += await enqueueWa(
            dueSoon.map((a) => ({
              user_id: a.user_id,
              template: "angsuran",
              pesan: `Halo, mengingatkan jatuh tempo angsuran cicilan ke-${a.cicilan_ke} sebesar Rp ${Number(a.nominal).toLocaleString("id-ID")} pada ${a.jatuh_tempo} di Koperasi T-COOL. Mohon segera diselesaikan 🙏`,
              ref_table: "angsuran:h3",
              ref_id: a.id,
            })),
          );
        }

        // 3) Angsuran overdue (jatuh_tempo < hari ini, masih unpaid)
        const { data: overdue } = await supabaseAdmin
          .from("angsuran")
          .select("id, user_id, cicilan_ke, nominal, jatuh_tempo")
          .eq("status", "unpaid")
          .lt("jatuh_tempo", today.toISOString().slice(0, 10))
          .is("deleted_at", null);
        if (overdue?.length) {
          summary.overdue = await enqueue(
            overdue.map((a) => ({
              user_id: a.user_id,
              judul: "Angsuran Terlambat",
              pesan: `Cicilan ke-${a.cicilan_ke} (Rp ${Number(a.nominal).toLocaleString("id-ID")}) telah lewat jatuh tempo ${a.jatuh_tempo}. Mohon segera lakukan pembayaran.`,
              kategori: "peringatan",
              url: "/angsuran",
              ref_table: "angsuran:overdue",
              ref_id: a.id,
            })),
          );
          summary.wa_queued += await enqueueWa(
            overdue.map((a) => ({
              user_id: a.user_id,
              template: "angsuran",
              pesan: `Halo, cicilan ke-${a.cicilan_ke} sebesar Rp ${Number(a.nominal).toLocaleString("id-ID")} telah TERLAMBAT (jatuh tempo ${a.jatuh_tempo}). Mohon segera lakukan pembayaran ke Koperasi T-COOL untuk menghindari denda lanjutan 🙏`,
              ref_table: "angsuran:overdue",
              ref_id: a.id,
            })),
          );
          // mark overdue
          await supabaseAdmin
            .from("angsuran")
            .update({ status: "overdue" })
            .in("id", overdue.map((a) => a.id));
        }

        // 4) Rapat H-1 (mulai antara besok 00:00 dan besok 23:59 UTC)
        const tomorrow = new Date(today.getTime() + 86400000);
        const dayAfter = new Date(today.getTime() + 2 * 86400000);
        const { data: meetings } = await supabaseAdmin
          .from("meetings")
          .select("id, judul, mulai, lokasi")
          .gte("mulai", tomorrow.toISOString())
          .lt("mulai", dayAfter.toISOString())
          .eq("status", "scheduled")
          .is("deleted_at", null);
        if (meetings?.length) {
          for (const m of meetings) {
            const { data: atts } = await supabaseAdmin
              .from("meeting_attendances")
              .select("user_id")
              .eq("meeting_id", m.id);
            const targets = atts ?? [];
            summary.meeting += await enqueue(
              targets.map((a) => ({
                user_id: a.user_id,
                judul: `Rapat Besok: ${m.judul}`,
                pesan: `Pengingat: rapat "${m.judul}" akan diadakan besok ${new Date(m.mulai).toLocaleString("id-ID")}${m.lokasi ? ` di ${m.lokasi}` : ""}.`,
                kategori: "info",
                url: "/rapat",
                ref_table: "meetings:h1",
                ref_id: m.id,
              })),
            );
          }
        }

        // 5) Anggota pending verifikasi > 3 hari → notif ke pengurus
        const { data: pendings } = await supabaseAdmin
          .from("profiles")
          .select("id, nama_lengkap, created_at")
          .eq("status", "pending")
          .lte("created_at", threeDaysAgo)
          .is("deleted_at", null);
        if (pendings?.length) {
          const { data: pengurus } = await supabaseAdmin
            .from("user_roles")
            .select("user_id")
            .in("role", ["super_admin", "ketua", "sekretaris", "bendahara"])
            .is("deleted_at", null);
          const recipients = Array.from(new Set((pengurus ?? []).map((r) => r.user_id)));
          const items: NotifInsert[] = [];
          for (const p of pendings) {
            for (const uid of recipients) {
              items.push({
                user_id: uid,
                judul: "Anggota Menunggu Verifikasi",
                pesan: `${p.nama_lengkap} mendaftar sejak ${new Date(p.created_at).toLocaleDateString("id-ID")} dan belum diverifikasi.`,
                kategori: "approval",
                url: "/admin/anggota",
                ref_table: "profiles:pending_verifikasi",
                ref_id: p.id,
              });
            }
          }
          summary.pending_verifikasi = await enqueue(items);
        }

        return Response.json({ ok: true, summary, ts: new Date().toISOString() });
      },
    },
  },
});
