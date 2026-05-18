import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type LoanEligibility = {
  eligible: boolean;
  monthsAsMember: number;
  membershipOk: boolean;
  statusActive: boolean;
  iuranPaidCount: number; // jumlah bulan dari 6 bulan terakhir yang sudah dibayar (verified)
  iuranRequired: number; // 6
  missingMonths: string[]; // label bulan yang belum dibayar (YYYY-MM)
  monthsUntilEligible: number;
  reason: string | null;
};

function ymKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function ymLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("id-ID", { month: "short", year: "numeric" });
}

export function useLoanEligibility() {
  const { user, profile } = useAuth();

  return useQuery<LoanEligibility>({
    queryKey: ["loan-eligibility", user?.id],
    enabled: !!user && !!profile,
    queryFn: async () => {
      const required = 6;
      const now = new Date();
      const joined = profile?.joined_at ? new Date((profile as any).joined_at) : new Date((profile as any)?.created_at ?? now);
      const monthsAsMember = Math.max(
        0,
        (now.getFullYear() - joined.getFullYear()) * 12 + (now.getMonth() - joined.getMonth())
      );
      const membershipOk = monthsAsMember >= required;
      const statusActive = profile?.status === "active";

      // Ambil 6 bulan terakhir (termasuk bulan berjalan)
      const windowKeys: string[] = [];
      for (let i = required - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        windowKeys.push(ymKey(d));
      }
      const earliest = new Date(now.getFullYear(), now.getMonth() - (required - 1), 1);

      const { data: simp } = await supabase
        .from("simpanan")
        .select("created_at,status,jenis")
        .eq("user_id", user!.id)
        .eq("jenis", "wajib")
        .eq("status", "verified")
        .gte("created_at", earliest.toISOString());

      const paidSet = new Set<string>();
      for (const r of simp ?? []) {
        paidSet.add(ymKey(new Date((r as any).created_at)));
      }
      const paidWithin = windowKeys.filter((k) => paidSet.has(k));
      const missing = windowKeys.filter((k) => !paidSet.has(k));
      const iuranPaidCount = paidWithin.length;

      const monthsUntilByMembership = Math.max(0, required - monthsAsMember);
      const monthsUntilByIuran = Math.max(0, required - iuranPaidCount);
      const monthsUntilEligible = Math.max(monthsUntilByMembership, monthsUntilByIuran);

      const eligible = membershipOk && statusActive && iuranPaidCount >= required;

      let reason: string | null = null;
      if (!statusActive) reason = "Status keanggotaan Anda belum aktif.";
      else if (!membershipOk) reason = `Keanggotaan baru ${monthsAsMember} bulan, minimal ${required} bulan.`;
      else if (iuranPaidCount < required) reason = `Iuran wajib baru ${iuranPaidCount}/${required} bulan terakhir terbayar.`;

      return {
        eligible,
        monthsAsMember,
        membershipOk,
        statusActive,
        iuranPaidCount,
        iuranRequired: required,
        missingMonths: missing.map(ymLabel),
        monthsUntilEligible,
        reason,
      };
    },
  });
}
