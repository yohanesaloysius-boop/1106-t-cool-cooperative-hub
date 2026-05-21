import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { CheckCircle2, Circle, ArrowRight, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

type Step = {
  key: string;
  label: string;
  hint: string;
  done: boolean;
  to: string;
  cta: string;
};

export function OnboardingChecklist() {
  const { user, profile } = useAuth();

  const { data } = useQuery({
    queryKey: ["onboarding-status", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [pokokRes, wajibRes, walletRes] = await Promise.all([
        supabase
          .from("simpanan")
          .select("id,status")
          .eq("user_id", user!.id)
          .eq("jenis", "pokok")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(1),
        supabase
          .from("simpanan")
          .select("id,status,created_at")
          .eq("user_id", user!.id)
          .eq("jenis", "wajib")
          .is("deleted_at", null)
          .gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
          .order("created_at", { ascending: false })
          .limit(1),
        supabase.from("wallets").select("id").eq("user_id", user!.id).maybeSingle(),
      ]);
      const pokok = pokokRes.data?.[0];
      const wajib = wajibRes.data?.[0];
      return {
        pokokVerified: pokok?.status === "verified",
        pokokPending: pokok?.status === "pending",
        wajibThisMonth: !!wajib && (wajib.status === "verified" || wajib.status === "pending"),
        walletReady: !!walletRes.data,
      };
    },
  });

  if (!profile) return null;

  const profilLengkap = !!(profile.nama_lengkap && profile.no_hp && profile.alamat && profile.nik);
  const akunAktif = profile.status === "active";

  const steps: Step[] = [
    {
      key: "profil",
      label: "Lengkapi profil",
      hint: "Nama, NIK, alamat, no HP",
      done: profilLengkap,
      to: "/profil",
      cta: "Lengkapi",
    },
    {
      key: "aktif",
      label: "Akun diverifikasi pengurus",
      hint: akunAktif ? "Sudah aktif" : "Menunggu pengurus mengaktifkan akun Anda",
      done: akunAktif,
      to: "/profil",
      cta: "Cek status",
    },
    {
      key: "pokok",
      label: "Bayar simpanan pokok",
      hint: data?.pokokPending
        ? "Tagihan sudah dibuat — segera bayar"
        : data?.pokokVerified
          ? "Sudah lunas"
          : "Belum ada tagihan",
      done: !!data?.pokokVerified,
      to: "/simpanan",
      cta: data?.pokokPending ? "Bayar Sekarang" : "Setor",
    },
    {
      key: "wajib",
      label: "Setor simpanan wajib bulan ini",
      hint: data?.wajibThisMonth ? "Sudah disetor bulan ini" : "Setor minimal sekali per bulan",
      done: !!data?.wajibThisMonth,
      to: "/simpanan",
      cta: "Setor",
    },
    {
      key: "wallet",
      label: "Dompet koperasi aktif",
      hint: data?.walletReady ? "Dompet siap dipakai" : "Akan otomatis aktif setelah aktivasi",
      done: !!data?.walletReady,
      to: "/saldo",
      cta: "Buka",
    },
  ];

  const completed = steps.filter((s) => s.done).length;
  const progress = (completed / steps.length) * 100;

  // Hidden when fully complete
  if (completed === steps.length) return null;

  const nextStep = steps.find((s) => !s.done);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
    >
      <Card className="overflow-hidden border-primary/20" style={{ boxShadow: "var(--shadow-card)" }}>
        <CardHeader className="bg-gradient-to-br from-primary/5 to-transparent">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" />
                Onboarding Anggota
              </CardTitle>
              <CardDescription className="mt-1">
                {completed} dari {steps.length} langkah selesai · ayo lengkapi agar bisa pakai semua fitur koperasi.
              </CardDescription>
            </div>
            {nextStep && (
              <Button asChild size="sm" className="shrink-0 rounded-full">
                <Link to={nextStep.to}>
                  {nextStep.cta} <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            )}
          </div>
          <Progress value={progress} className="mt-3 h-2" />
        </CardHeader>
        <CardContent className="grid gap-2 pt-4 sm:grid-cols-2 lg:grid-cols-3">
          {steps.map((s) => (
            <Link
              key={s.key}
              to={s.to}
              className={`group flex items-start gap-3 rounded-xl border p-3 transition-all hover:border-primary/40 hover:bg-accent/40 ${
                s.done ? "border-success/30 bg-success/5" : "border-border"
              }`}
            >
              {s.done ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
              ) : (
                <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
              )}
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${s.done ? "text-foreground/70 line-through decoration-success/40" : "text-foreground"}`}>
                  {s.label}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{s.hint}</p>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </motion.div>
  );
}
