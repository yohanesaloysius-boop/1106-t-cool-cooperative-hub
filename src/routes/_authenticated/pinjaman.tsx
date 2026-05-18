import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, HandCoins, Loader2, Calculator, Eye, Download, ShieldCheck, Lock, CheckCircle2 } from "lucide-react";
import { EmptyState, StatusBadge } from "@/components/empty-state";
import { LoanDetailDialog } from "@/components/loan-detail-dialog";
import { downloadSuratPinjaman } from "@/lib/bukti-pdf";
import { LoanApplicationWizard } from "@/components/loan-application-wizard";
import { Progress } from "@/components/ui/progress";
import { useLoanEligibility } from "@/hooks/use-loan-eligibility";
import { useLoanScoring } from "@/hooks/use-loan-scoring";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingUp } from "lucide-react";

type BungaJenis = "flat" | "efektif" | "menurun";

export const Route = createFileRoute("/_authenticated/pinjaman")({
  validateSearch: (s: Record<string, unknown>) => ({
    nominal: typeof s.nominal === "number" ? s.nominal : undefined,
    tenor: typeof s.tenor === "number" ? s.tenor : undefined,
    bunga: typeof s.bunga === "number" ? s.bunga : undefined,
    jenis: typeof s.jenis === "string" ? (s.jenis as BungaJenis) : undefined,
  }),
  head: () => ({ meta: [{ title: "Pinjaman Saya — T-COOL Koperasi" }] }),
  component: PinjamanPage,
});

const fmt = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

function PinjamanPage() {
  const { user, profile } = useAuth();
  const search = Route.useSearch();
  const [open, setOpen] = useState(false);
  const { data: elig, isLoading: eligLoading } = useLoanEligibility();
  const { data: score, isLoading: scoreLoading } = useLoanScoring();

  const fullyEligible = !!elig?.eligible && !!score?.canApply;

  useEffect(() => {
    if (search.nominal && fullyEligible) setOpen(true);
  }, [search.nominal, fullyEligible]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["pinjaman", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pinjaman").select("*, loan_verifications:verification_id(status, rejected_reason)")
        .eq("user_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pinjaman Saya</h1>
          <p className="text-sm text-muted-foreground">Pengajuan dengan verifikasi identitas anggota.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link to="/kalkulator"><Calculator className="mr-2 h-4 w-4" />Kalkulator</Link></Button>
          <Button
            onClick={() => setOpen(true)}
            disabled={eligLoading || scoreLoading || !fullyEligible}
            title={elig?.reason ?? score?.blockReason ?? undefined}
          >
            {!fullyEligible && !eligLoading && !scoreLoading ? (
              <Lock className="mr-2 h-4 w-4" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Ajukan Pinjaman
          </Button>
        </div>
      </div>

      {elig && (
        <Card style={{ boxShadow: "var(--shadow-card)" }} className={elig.eligible ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"}>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-start gap-3">
              {elig.eligible ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              ) : (
                <Lock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              )}
              <div className="flex-1 space-y-1">
                <p className="text-sm font-semibold">
                  {elig.eligible
                    ? "Anda memenuhi syarat untuk mengajukan pinjaman."
                    : "Pinjaman hanya tersedia untuk anggota aktif minimal 6 bulan dan rutin membayar iuran wajib."}
                </p>
                {!elig.eligible && elig.monthsUntilEligible > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Anda dapat mengajukan pinjaman dalam <strong>{elig.monthsUntilEligible} bulan lagi</strong>.
                  </p>
                )}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Lama keanggotaan</span>
                  <span className="font-medium">{elig.monthsAsMember}/{elig.iuranRequired} bulan</span>
                </div>
                <Progress value={Math.min(100, (elig.monthsAsMember / elig.iuranRequired) * 100)} />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Iuran wajib aktif (6 bulan terakhir)</span>
                  <span className="font-medium">{elig.iuranPaidCount}/{elig.iuranRequired} bulan</span>
                </div>
                <Progress value={(elig.iuranPaidCount / elig.iuranRequired) * 100} />
              </div>
            </div>
            {!elig.eligible && elig.missingMonths.length > 0 && (
              <p className="text-xs text-amber-700">
                Bulan belum terbayar/terverifikasi: {elig.missingMonths.join(", ")}.{" "}
                <Link to="/simpanan" className="underline">Setor iuran wajib →</Link>
              </p>
            )}
            {!elig.statusActive && (
              <p className="text-xs text-amber-700">Status keanggotaan: {profile?.status ?? "—"}. Hubungi pengurus untuk aktivasi.</p>
            )}
          </CardContent>
        </Card>
      )}

      {score && (
        <Card style={{ boxShadow: "var(--shadow-card)" }} className={score.overdueCount > 0 ? "border-destructive/30 bg-destructive/5" : "border-primary/20"}>
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-primary/10 p-2 text-primary"><TrendingUp className="h-5 w-5" /></div>
                <div>
                  <p className="text-sm font-semibold">Skor Kredit Anda</p>
                  <p className="text-xs text-muted-foreground">Otomatis dihitung dari aktivitas keanggotaan</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-2xl font-bold leading-none">{score.score}<span className="text-sm text-muted-foreground">/100</span></p>
                  <p className="text-[11px] text-muted-foreground">Grade {score.grade}</p>
                </div>
                <Badge variant={score.canApply ? "default" : "destructive"}>{score.canApply ? "Layak" : "Diblokir"}</Badge>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Plafon tersedia</p>
                <p className="mt-1 text-xl font-bold tracking-tight">{fmt.format(score.plafonMax)}</p>
                <p className="text-[11px] text-muted-foreground">Berdasarkan {score.multiplier}× total simpanan ({fmt.format(score.totalSimpanan)})</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Status</p>
                <p className="mt-1 text-sm">Pinjaman aktif: <strong>{score.activeLoans}</strong> · Lunas: <strong>{score.completedLoans}</strong></p>
                <p className={`text-xs ${score.overdueCount > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                  Tunggakan: <strong>{score.overdueCount}</strong>{score.overdueCount > 0 && ` (${fmt.format(score.overdueNominal)})`}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {score.breakdown.map((b) => (
                <div key={b.label}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{b.label}</span>
                    <span className="font-medium">{b.value}/{b.max}</span>
                  </div>
                  <Progress value={(b.value / b.max) * 100} className="h-1.5" />
                </div>
              ))}
            </div>

            {score.blockReason && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold">Pengajuan diblokir</p>
                  <p>{score.blockReason}</p>
                  {score.overdueCount > 0 && (
                    <Link to="/angsuran" className="mt-1 inline-block underline">Lihat tunggakan →</Link>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-primary">
        <ShieldCheck className="h-4 w-4 shrink-0" />
        <span>Setiap pengajuan wajib melewati verifikasi identitas (foto KTP + selfie) untuk mencegah penyalahgunaan.</span>
      </div>

      <LoanApplicationWizard
        open={open}
        onOpenChange={setOpen}
        plafonMax={score?.plafonMax}
        initial={{ nominal: search.nominal, tenor: search.tenor, bunga: search.bunga, jenis: search.jenis }}
      />

      <Card style={{ boxShadow: "var(--shadow-card)" }}>
        <CardHeader><CardTitle>Daftar Pinjaman</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : rows.length === 0 ? (
            <EmptyState icon={HandCoins} title="Belum ada pinjaman" desc="Ajukan pinjaman pertama Anda. Workflow approval bertingkat: Sekretaris → Bendahara → Ketua." />
          ) : (
            <div className="space-y-3">
              {rows.map((r: any) => (
                <div key={r.id} className="rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-bold tracking-tight">{fmt.format(Number(r.nominal))}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.tenor_bulan} bulan · Bunga {Number(r.bunga_persen)}% ({r.bunga_jenis}) · Cicilan {fmt.format(Number(r.cicilan_per_bulan ?? 0))}/bulan
                      </p>
                      {r.tujuan && <p className="mt-2 text-sm">{r.tujuan}</p>}
                      {r.loan_verifications && (
                        <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px]">
                          <ShieldCheck className="h-3 w-3" />
                          Verifikasi: {r.loan_verifications.status}
                          {r.loan_verifications.status === "rejected" && r.loan_verifications.rejected_reason && (
                            <span className="ml-1 text-destructive">· {r.loan_verifications.rejected_reason}</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <StatusBadge status={r.status} />
                      <p className="mt-1 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</p>
                      <LoanDetailDialog
                        pinjamanId={r.id}
                        trigger={<Button size="sm" variant="ghost" className="mt-1 h-7 gap-1 text-xs"><Eye className="h-3 w-3" /> Detail</Button>}
                      />
                      {["approved", "disbursed", "active", "completed"].includes(String(r.status)) && (
                        <Button
                          size="sm" variant="ghost" className="mt-1 h-7 gap-1 text-xs"
                          onClick={() =>
                            downloadSuratPinjaman({
                              id: r.id, nominal: Number(r.nominal), tenor_bulan: Number(r.tenor_bulan),
                              bunga_persen: Number(r.bunga_persen), cicilan_per_bulan: r.cicilan_per_bulan as any,
                              total_bayar: r.total_bayar as any, status: String(r.status),
                              approved_at: (r as any).approved_at ?? null, disbursed_at: (r as any).disbursed_at ?? null,
                              tujuan: r.tujuan ?? null,
                              anggota: {
                                nama: profile?.nama_lengkap ?? "—",
                                nomor: profile?.nomor_anggota ?? null,
                                email: profile?.email ?? null,
                                alamat: (profile as any)?.alamat ?? null,
                              },
                            })
                          }
                        >
                          <Download className="h-3 w-3" /> Surat
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

