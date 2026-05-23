import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type MonthBucket = { month: string; inflow: number; outflow: number; net: number };

/**
 * Mengambil metrik analitik koperasi (12 bulan terakhir): arus kas, tren angsuran macet,
 * sebaran kredit skor, dan forecast sederhana untuk 3 bulan ke depan menggunakan
 * moving-average. Hanya pengurus yang dapat memanggil ini.
 */
export const getKoperasiAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Pastikan pengurus
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isPengurus = (roles ?? []).some((r: any) =>
      ["super_admin", "ketua", "sekretaris", "bendahara"].includes(r.role),
    );
    if (!isPengurus) throw new Error("Forbidden");

    const now = new Date();
    const since = new Date(now.getFullYear(), now.getMonth() - 11, 1)
      .toISOString()
      .slice(0, 10);

    const [simpRes, pinjRes, angRes, opexRes, profRes] = await Promise.all([
      supabase.from("simpanan").select("nominal,created_at,status").gte("created_at", since),
      supabase.from("pinjaman").select("nominal,created_at,status").gte("created_at", since),
      supabase
        .from("angsuran")
        .select("nominal,jatuh_tempo,status,user_id")
        .gte("jatuh_tempo", since),
      supabase.from("opex_expenses").select("nominal,tanggal").gte("tanggal", since),
      supabase.from("profiles").select("id,created_at"),
    ]);

    // 12 monthly buckets
    const buckets: Record<string, MonthBucket> = {};
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      buckets[key] = { month: key, inflow: 0, outflow: 0, net: 0 };
    }
    const addTo = (key: string, field: "inflow" | "outflow", n: number) => {
      if (!buckets[key]) return;
      buckets[key][field] += Number(n || 0);
    };
    const k = (iso: string) => iso.slice(0, 7);

    for (const s of simpRes.data ?? []) {
      if (s.status === "verified") addTo(k(s.created_at), "inflow", Number(s.nominal));
    }
    for (const a of angRes.data ?? []) {
      if (a.status === "paid") addTo(k(a.jatuh_tempo), "inflow", Number(a.nominal));
    }
    for (const p of pinjRes.data ?? []) {
      if (["disbursed", "approved", "active", "completed"].includes(String(p.status))) {
        addTo(k(p.created_at), "outflow", Number(p.nominal));
      }
    }
    for (const o of opexRes.data ?? []) {
      addTo(k(o.tanggal), "outflow", Number(o.nominal));
    }

    const series = Object.values(buckets).map((b) => ({
      ...b,
      net: b.inflow - b.outflow,
    }));

    // 3-month forecast: simple weighted moving average over last 6 months
    const last6 = series.slice(-6);
    const avgIn = last6.reduce((s, x) => s + x.inflow, 0) / Math.max(1, last6.length);
    const avgOut = last6.reduce((s, x) => s + x.outflow, 0) / Math.max(1, last6.length);
    const forecast: MonthBucket[] = [];
    for (let i = 1; i <= 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      forecast.push({
        month: key,
        inflow: Math.round(avgIn),
        outflow: Math.round(avgOut),
        net: Math.round(avgIn - avgOut),
      });
    }

    // Overdue trend
    const today = now.toISOString().slice(0, 10);
    const overdueRows = (angRes.data ?? []).filter(
      (a: any) =>
        a.status === "overdue" || (a.status === "unpaid" && a.jatuh_tempo < today),
    );
    const overdueByMonth: Record<string, number> = {};
    for (const a of overdueRows) {
      const key = k(a.jatuh_tempo);
      overdueByMonth[key] = (overdueByMonth[key] ?? 0) + 1;
    }

    // High-risk members: jumlah angsuran overdue per user_id
    const overdueByUser: Record<string, number> = {};
    for (const a of overdueRows) {
      overdueByUser[a.user_id] = (overdueByUser[a.user_id] ?? 0) + 1;
    }
    const topRiskIds = Object.entries(overdueByUser)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id);

    let topRisk: { id: string; nama: string; count: number }[] = [];
    if (topRiskIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,nama_lengkap")
        .in("id", topRiskIds);
      topRisk = topRiskIds.map((id) => ({
        id,
        nama: profs?.find((p: any) => p.id === id)?.nama_lengkap ?? "Anggota",
        count: overdueByUser[id],
      }));
    }

    return {
      series,
      forecast,
      overdueTrend: Object.entries(overdueByMonth)
        .map(([month, count]) => ({ month, count }))
        .sort((a, b) => a.month.localeCompare(b.month)),
      topRisk,
      totals: {
        inflow12m: series.reduce((s, x) => s + x.inflow, 0),
        outflow12m: series.reduce((s, x) => s + x.outflow, 0),
        members: (profRes.data ?? []).length,
        overdueCount: overdueRows.length,
        overdueNominal: overdueRows.reduce((s, a: any) => s + Number(a.nominal || 0), 0),
      },
    };
  });

/**
 * AI narrative: meringkas insight dan rekomendasi tindakan dari data analitik.
 */
export const getAiInsight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { summary: string }) => {
    if (!input || typeof input.summary !== "string" || input.summary.length > 4000) {
      throw new Error("Invalid input");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isPengurus = (roles ?? []).some((r: any) =>
      ["super_admin", "ketua", "sekretaris", "bendahara"].includes(r.role),
    );
    if (!isPengurus) throw new Error("Forbidden");

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { insight: "AI belum terkonfigurasi.", error: true as const };

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content:
                "Kamu adalah analis keuangan koperasi. Berikan ringkasan singkat (4-6 bullet) dan 3 rekomendasi tindakan konkret berdasarkan data yang diberikan. Gunakan bahasa Indonesia. Jangan mengarang angka.",
            },
            { role: "user", content: data.summary },
          ],
        }),
      });
      if (res.status === 429)
        return { insight: "Rate limit AI. Coba lagi sebentar.", error: true as const };
      if (res.status === 402)
        return { insight: "Kuota AI habis. Top-up di pengaturan.", error: true as const };
      if (!res.ok) {
        console.error("AI gateway", res.status, await res.text());
        return { insight: "Layanan AI gagal merespons.", error: true as const };
      }
      const json = await res.json();
      const insight = json?.choices?.[0]?.message?.content ?? "Tidak ada insight.";
      return { insight: String(insight), error: false as const };
    } catch (err) {
      console.error("getAiInsight failed", err);
      return { insight: "Tidak dapat terhubung ke AI.", error: true as const };
    }
  });
