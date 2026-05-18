import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useLoanEligibility } from "@/hooks/use-loan-eligibility";

export type LoanScoring = {
  score: number; // 0-100
  grade: "A" | "B" | "C" | "D" | "E";
  totalSimpanan: number;
  monthsAsMember: number;
  iuranRate: number; // 0..1 (6 bln terakhir)
  completedLoans: number;
  activeLoans: number;
  overdueCount: number;
  overdueNominal: number;
  plafonMax: number; // batas pinjaman yang disetujui sistem
  multiplier: number;
  canApply: boolean;
  blockReason: string | null;
  breakdown: { label: string; value: number; max: number }[];
};

const PLAFON_HARD_CAP = 50_000_000;

function gradeOf(s: number): LoanScoring["grade"] {
  if (s >= 85) return "A";
  if (s >= 70) return "B";
  if (s >= 55) return "C";
  if (s >= 40) return "D";
  return "E";
}

export function useLoanScoring() {
  const { user } = useAuth();
  const { data: elig } = useLoanEligibility();

  return useQuery<LoanScoring>({
    queryKey: ["loan-scoring", user?.id, elig?.monthsAsMember, elig?.iuranPaidCount],
    enabled: !!user && !!elig,
    queryFn: async () => {
      const uid = user!.id;

      const [{ data: simp }, { data: loans }, { data: ang }] = await Promise.all([
        supabase.from("simpanan").select("nominal,jenis,status").eq("user_id", uid).eq("status", "verified"),
        supabase.from("pinjaman").select("id,status").eq("user_id", uid).is("deleted_at", null),
        supabase
          .from("angsuran")
          .select("id,nominal,status,jatuh_tempo")
          .eq("user_id", uid)
          .in("status", ["unpaid", "overdue"])
          .is("deleted_at", null),
      ]);

      const totalSimpanan = (simp ?? []).reduce((s, r: any) => s + Number(r.nominal || 0), 0);
      const completedLoans = (loans ?? []).filter((l: any) => l.status === "completed").length;
      const activeLoans = (loans ?? []).filter((l: any) =>
        ["approved", "disbursed", "active"].includes(String(l.status)),
      ).length;
      const today = new Date().toISOString().slice(0, 10);
      const overdueRows = (ang ?? []).filter(
        (a: any) => a.status === "overdue" || (a.status === "unpaid" && a.jatuh_tempo < today),
      );
      const overdueCount = overdueRows.length;
      const overdueNominal = overdueRows.reduce((s, a: any) => s + Number(a.nominal || 0), 0);

      const monthsAsMember = elig?.monthsAsMember ?? 0;
      const iuranRate = (elig?.iuranPaidCount ?? 0) / (elig?.iuranRequired ?? 6);

      // ---- scoring (max 100) ----
      const sMembership = Math.min(monthsAsMember / 12, 1) * 20; // 20
      const sIuran = Math.min(iuranRate, 1) * 25; // 25
      const sSimpanan = Math.min(totalSimpanan / 5_000_000, 1) * 25; // 25
      const sPelunasan = Math.min(completedLoans / 3, 1) * 15; // 15
      const sBersihTunggakan = overdueCount === 0 ? 15 : 0; // 15
      const score = Math.round(sMembership + sIuran + sSimpanan + sPelunasan + sBersihTunggakan);
      const grade = gradeOf(score);

      // ---- plafon ----
      let multiplier = 2;
      if (score >= 85) multiplier = 5;
      else if (score >= 70) multiplier = 4;
      else if (score >= 55) multiplier = 3;
      const plafonRaw = Math.max(0, totalSimpanan * multiplier - activeLoans * 2_000_000);
      const plafonMax = Math.min(PLAFON_HARD_CAP, Math.floor(plafonRaw / 100_000) * 100_000);

      let blockReason: string | null = null;
      if (overdueCount > 0)
        blockReason = `Anda masih memiliki ${overdueCount} tunggakan angsuran. Lunasi terlebih dahulu sebelum mengajukan pinjaman baru.`;
      else if (score < 40) blockReason = "Skor kredit Anda terlalu rendah. Tingkatkan simpanan & rutin bayar iuran.";
      else if (plafonMax < 500_000) blockReason = "Plafon yang tersedia di bawah minimum pinjaman (Rp 500.000).";

      const canApply = !blockReason;

      return {
        score,
        grade,
        totalSimpanan,
        monthsAsMember,
        iuranRate,
        completedLoans,
        activeLoans,
        overdueCount,
        overdueNominal,
        plafonMax,
        multiplier,
        canApply,
        blockReason,
        breakdown: [
          { label: "Lama keanggotaan", value: Math.round(sMembership), max: 20 },
          { label: "Iuran wajib (6 bln)", value: Math.round(sIuran), max: 25 },
          { label: "Total simpanan", value: Math.round(sSimpanan), max: 25 },
          { label: "Riwayat pelunasan", value: Math.round(sPelunasan), max: 15 },
          { label: "Bebas tunggakan", value: Math.round(sBersihTunggakan), max: 15 },
        ],
      };
    },
  });
}
