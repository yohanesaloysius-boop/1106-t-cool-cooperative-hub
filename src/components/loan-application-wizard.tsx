import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import {
  ShieldCheck, FileText, ScanFace, CheckCircle2, Camera, IdCard,
  Loader2, ChevronLeft, ChevronRight, Sparkles,
} from "lucide-react";
import { calcLoan } from "@/components/dashboard/loan-calculator";
import { CameraCapture } from "@/components/camera-capture";
import { useServerFn } from "@tanstack/react-start";
import { verifyWithPrivy } from "@/lib/privy.functions";
import { Badge } from "@/components/ui/badge";

type BungaJenis = "flat" | "efektif" | "menurun";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: { nominal?: number; tenor?: number; bunga?: number; jenis?: BungaJenis };
}

const fmt = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

const schema = z.object({
  nominal: z.coerce.number().min(500_000, "Minimal Rp 500.000").max(500_000_000),
  tenor_bulan: z.coerce.number().int().min(3).max(60),
  bunga_persen: z.coerce.number().min(0).max(20),
  bunga_jenis: z.enum(["flat", "efektif", "menurun"]),
  tujuan: z.string().trim().min(5, "Tujuan minimal 5 karakter").max(500),
});

const steps = [
  { id: 1, title: "Data Pinjaman", icon: FileText },
  { id: 2, title: "Verifikasi Identitas", icon: ScanFace },
  { id: 3, title: "Review & Submit", icon: CheckCircle2 },
];

export function LoanApplicationWizard({ open, onOpenChange, initial }: Props) {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    nominal: initial?.nominal?.toString() ?? "",
    tenor_bulan: initial?.tenor?.toString() ?? "12",
    bunga_persen: initial?.bunga?.toString() ?? "1.5",
    bunga_jenis: (initial?.jenis ?? "flat") as BungaJenis,
    tujuan: "",
    agree: false,
  });
  const [ktp, setKtp] = useState<{ path: string; preview: string } | null>(null);
  const [selfie, setSelfie] = useState<{ path: string; preview: string } | null>(null);
  const [openCam, setOpenCam] = useState<"ktp" | "selfie" | null>(null);
  const verifyPrivyFn = useServerFn(verifyWithPrivy);
  const [privy, setPrivy] = useState<
    | null
    | {
        mode: "mock" | "live";
        nik: string; nama: string; tgl_lahir: string; alamat: string;
        face_match_score: number; liveness: string; status: string; referenceId: string;
      }
  >(null);
  const [privyBusy, setPrivyBusy] = useState(false);
  const [privyErr, setPrivyErr] = useState<string | null>(null);

  const sim = useMemo(() => {
    const n = Number(form.nominal) || 0;
    const t = Number(form.tenor_bulan) || 1;
    const b = Number(form.bunga_persen) || 0;
    if (n <= 0) return null;
    return calcLoan(n, t, b, form.bunga_jenis);
  }, [form]);

  const reset = () => {
    setStep(1); setKtp(null); setSelfie(null); setPrivy(null); setPrivyErr(null);
    setForm({ nominal: "", tenor_bulan: "12", bunga_persen: "1.5", bunga_jenis: "flat", tujuan: "", agree: false });
  };

  const runPrivy = async () => {
    if (!ktp || !selfie) return;
    setPrivyBusy(true); setPrivyErr(null);
    try {
      const res = await verifyPrivyFn({ data: { ktpPath: ktp.path, selfiePath: selfie.path, bucket: "verifikasi-pinjaman" } });
      if (!res.ok) { setPrivyErr(res.error ?? "Verifikasi gagal"); setPrivy(null); }
      else {
        const r = res.result;
        setPrivy({
          mode: res.mode, nik: r.nik, nama: r.nama, tgl_lahir: r.tgl_lahir, alamat: r.alamat,
          face_match_score: r.face_match_score, liveness: r.liveness, status: r.status, referenceId: r.referenceId,
        });
        if (r.face_match_score < 0.75) setPrivyErr(`Skor wajah rendah (${(r.face_match_score * 100).toFixed(1)}%). Ulangi selfie.`);
      }
    } catch (e) {
      setPrivyErr((e as Error).message);
    } finally { setPrivyBusy(false); }
  };

  const submit = useMutation({
    mutationFn: async () => {
      const parsed = schema.parse(form);
      if (!form.agree) throw new Error("Anda harus menyetujui syarat & ketentuan");
      if (!ktp || !selfie) throw new Error("Foto KTP dan selfie wajib diisi");
      const result = calcLoan(parsed.nominal, parsed.tenor_bulan, parsed.bunga_persen, parsed.bunga_jenis);

      // Capture metadata
      let location: { lat?: number; lng?: number } | null = null;
      try {
        const pos = await new Promise<GeolocationPosition | null>((resolve) => {
          if (!("geolocation" in navigator)) return resolve(null);
          navigator.geolocation.getCurrentPosition((p) => resolve(p), () => resolve(null), { timeout: 4000 });
        });
        if (pos) location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      } catch { /* ignore */ }

      // Create verification record
      const { data: verif, error: vErr } = await supabase
        .from("loan_verifications")
        .insert({
          user_id: user!.id,
          ktp_image_path: ktp.path,
          selfie_image_path: selfie.path,
          status: "pending",
          ocr_data: {
            provider: "privy",
            mode: privy?.mode ?? null,
            nik: privy?.nik ?? (profile as any)?.nik ?? null,
            nama: privy?.nama ?? profile?.nama_lengkap ?? null,
            tgl_lahir: privy?.tgl_lahir ?? null,
            alamat: privy?.alamat ?? null,
            liveness: privy?.liveness ?? null,
            privy_status: privy?.status ?? null,
            privy_reference: privy?.referenceId ?? null,
          },
          face_match_score: privy?.face_match_score ?? null,
          location,
          user_agent: navigator.userAgent,
        })
          face_match_score: null,
          location,
          user_agent: navigator.userAgent,
        })
        .select("id")
        .single();
      if (vErr) throw vErr;

      const { error: pErr } = await supabase.from("pinjaman").insert({
        user_id: user!.id,
        nominal: parsed.nominal,
        tenor_bulan: parsed.tenor_bulan,
        bunga_persen: parsed.bunga_persen,
        bunga_jenis: parsed.bunga_jenis,
        tujuan: parsed.tujuan,
        cicilan_per_bulan: Math.round(result.cicilan),
        total_bayar: Math.round(result.totalBayar),
        status: "pending_sekretaris",
        verification_id: verif.id,
      });
      if (pErr) throw pErr;

      await supabase.from("verification_logs").insert({
        verification_id: verif.id,
        actor_id: user!.id,
        action: "submitted",
        meta: { source: "loan-wizard" },
      });
    },
    onSuccess: () => {
      toast.success("Pengajuan terkirim", { description: "Verifikasi identitas & pinjaman akan ditinjau pengurus." });
      qc.invalidateQueries({ queryKey: ["pinjaman"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      onOpenChange(false);
      reset();
    },
    onError: (e: unknown) => {
      const msg = e instanceof z.ZodError ? e.issues[0]?.message : (e as Error).message;
      toast.error("Gagal", { description: msg });
    },
  });

  const canNext1 = (() => {
    try { schema.parse(form); return form.agree; } catch { return false; }
  })();
  const canNext2 = !!ktp && !!selfie;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl p-0 sm:rounded-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader className="border-b p-4 sm:p-6">
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Pengajuan Pinjaman Aman
          </DialogTitle>
          {/* Stepper */}
          <div className="mt-4 flex items-center gap-2">
            {steps.map((s, i) => {
              const active = step === s.id;
              const done = step > s.id;
              const Icon = s.icon;
              return (
                <div key={s.id} className="flex flex-1 items-center gap-2">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition ${done ? "border-success bg-success text-success-foreground" : active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted text-muted-foreground"}`}>
                    {done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <div className="hidden sm:block">
                    <p className={`text-xs font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}>Langkah {s.id}</p>
                    <p className="text-[11px] text-muted-foreground">{s.title}</p>
                  </div>
                  {i < steps.length - 1 && <div className={`h-0.5 flex-1 ${done ? "bg-success" : "bg-border"}`} />}
                </div>
              );
            })}
          </div>
        </DialogHeader>

        <div className="p-4 sm:p-6">
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Nominal Pinjaman</Label>
                  <Input type="number" inputMode="numeric" className="mt-2" placeholder="500.000" value={form.nominal} onChange={(e) => setForm({ ...form, nominal: e.target.value })} />
                </div>
                <div>
                  <Label>Tenor (bulan)</Label>
                  <Input type="number" min={3} max={60} className="mt-2" value={form.tenor_bulan} onChange={(e) => setForm({ ...form, tenor_bulan: e.target.value })} />
                </div>
                <div>
                  <Label>Bunga / bulan (%)</Label>
                  <Input type="number" step="0.1" className="mt-2" value={form.bunga_persen} onChange={(e) => setForm({ ...form, bunga_persen: e.target.value })} />
                </div>
                <div>
                  <Label>Jenis Bunga</Label>
                  <Select value={form.bunga_jenis} onValueChange={(v) => setForm({ ...form, bunga_jenis: v as BungaJenis })}>
                    <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="flat">Flat</SelectItem>
                      <SelectItem value="efektif">Efektif</SelectItem>
                      <SelectItem value="menurun">Menurun</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Tujuan Pinjaman</Label>
                <Textarea rows={3} maxLength={500} className="mt-2" placeholder="Contoh: Modal usaha warung kelontong" value={form.tujuan} onChange={(e) => setForm({ ...form, tujuan: e.target.value })} />
              </div>
              {sim && (
                <div className="rounded-2xl p-4 text-primary-foreground" style={{ background: "var(--gradient-primary)" }}>
                  <div className="flex items-center gap-2 text-xs opacity-80"><Sparkles className="h-3 w-3" /> Simulasi Otomatis</div>
                  <p className="mt-1 text-2xl font-bold">{fmt.format(Math.round(sim.cicilan))}</p>
                  <p className="text-xs opacity-80">/bulan · Total bayar {fmt.format(Math.round(sim.totalBayar))}</p>
                </div>
              )}
              <label className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3">
                <Checkbox checked={form.agree} onCheckedChange={(v) => setForm({ ...form, agree: !!v })} className="mt-0.5" />
                <span className="text-xs text-muted-foreground">
                  Saya menyetujui <strong>syarat & ketentuan</strong> pinjaman koperasi, bersedia identitas saya diverifikasi, dan menyatakan data yang saya berikan adalah benar.
                </span>
              </label>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Untuk keamanan, kami perlu memverifikasi identitas Anda. Data hanya dipakai oleh pengurus koperasi.
              </p>

              <Card className="overflow-hidden">
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-primary/10 p-2 text-primary"><IdCard className="h-5 w-5" /></div>
                    <div>
                      <p className="font-semibold">Foto KTP</p>
                      <p className="text-xs text-muted-foreground">Pastikan tulisan jelas, tidak silau.</p>
                    </div>
                  </div>
                  {ktp ? <CheckCircle2 className="h-5 w-5 text-success" /> : <Camera className="h-5 w-5 text-muted-foreground" />}
                </div>
                {ktp && <img src={ktp.preview} alt="KTP" className="max-h-56 w-full object-contain bg-muted" />}
                <div className="border-t p-3">
                  <Button variant={ktp ? "outline" : "default"} size="sm" className="w-full gap-2" onClick={() => setOpenCam("ktp")}>
                    <Camera className="h-4 w-4" /> {ktp ? "Ambil ulang KTP" : "Ambil Foto KTP"}
                  </Button>
                </div>
              </Card>

              <Card className="overflow-hidden">
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-primary/10 p-2 text-primary"><ScanFace className="h-5 w-5" /></div>
                    <div>
                      <p className="font-semibold">Selfie Wajah</p>
                      <p className="text-xs text-muted-foreground">Lihat ke kamera, tanpa masker/kacamata gelap.</p>
                    </div>
                  </div>
                  {selfie ? <CheckCircle2 className="h-5 w-5 text-success" /> : <Camera className="h-5 w-5 text-muted-foreground" />}
                </div>
                {selfie && <img src={selfie.preview} alt="Selfie" className="max-h-56 w-full object-contain bg-muted" />}
                <div className="border-t p-3">
                  <Button variant={selfie ? "outline" : "default"} size="sm" className="w-full gap-2" onClick={() => setOpenCam("selfie")}>
                    <Camera className="h-4 w-4" /> {selfie ? "Ambil ulang Selfie" : "Ambil Selfie"}
                  </Button>
                </div>
              </Card>

              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                🔒 Foto Anda disimpan secara privat. Akses hanya untuk pengurus koperasi terverifikasi.
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <Card className="p-4">
                <p className="text-xs font-medium text-muted-foreground">Ringkasan Pinjaman</p>
                <div className="mt-2 grid grid-cols-2 gap-y-2 text-sm">
                  <span className="text-muted-foreground">Nominal</span><span className="text-right font-semibold">{fmt.format(Number(form.nominal))}</span>
                  <span className="text-muted-foreground">Tenor</span><span className="text-right font-semibold">{form.tenor_bulan} bulan</span>
                  <span className="text-muted-foreground">Bunga</span><span className="text-right font-semibold">{form.bunga_persen}% / bulan ({form.bunga_jenis})</span>
                  <span className="text-muted-foreground">Cicilan</span><span className="text-right font-bold text-primary">{sim && fmt.format(Math.round(sim.cicilan))}/bln</span>
                  <span className="text-muted-foreground">Total Bayar</span><span className="text-right font-semibold">{sim && fmt.format(Math.round(sim.totalBayar))}</span>
                </div>
                <div className="mt-3 rounded-lg bg-muted p-2 text-xs">
                  <span className="font-medium">Tujuan:</span> {form.tujuan}
                </div>
              </Card>
              <Card className="p-4">
                <p className="text-xs font-medium text-muted-foreground">Identitas</p>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <div>
                    <p className="mb-1 text-[11px] text-muted-foreground">KTP</p>
                    {ktp && <img src={ktp.preview} className="aspect-video w-full rounded-lg border object-cover" alt="KTP" />}
                  </div>
                  <div>
                    <p className="mb-1 text-[11px] text-muted-foreground">Selfie</p>
                    {selfie && <img src={selfie.preview} className="aspect-video w-full rounded-lg border object-cover" alt="Selfie" />}
                  </div>
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  <p><strong>Nama:</strong> {profile?.nama_lengkap}</p>
                  <p><strong>Nomor Anggota:</strong> {profile?.nomor_anggota ?? "-"}</p>
                </div>
              </Card>
              <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
                Dengan menekan <strong>Kirim Pengajuan</strong>, identitas akan diverifikasi pengurus terlebih dahulu sebelum pinjaman diproses.
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t bg-background/95 p-4 backdrop-blur">
          <Button variant="ghost" size="sm" disabled={step === 1} onClick={() => setStep(step - 1)}>
            <ChevronLeft className="mr-1 h-4 w-4" /> Kembali
          </Button>
          {step < 3 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={(step === 1 && !canNext1) || (step === 2 && !canNext2)}
            >
              Lanjut <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={() => submit.mutate()} disabled={submit.isPending} className="gap-2">
              {submit.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Kirim Pengajuan
            </Button>
          )}
        </div>

        {user && (
          <>
            <CameraCapture
              open={openCam === "ktp"}
              onOpenChange={(v) => !v && setOpenCam(null)}
              facingMode="environment"
              title="Ambil Foto KTP"
              hint="Pegang HP stabil, hindari pantulan cahaya."
              guide="ktp"
              bucket="verifikasi-pinjaman"
              userId={user.id}
              onUploaded={(path, preview) => setKtp({ path, preview })}
            />
            <CameraCapture
              open={openCam === "selfie"}
              onOpenChange={(v) => !v && setOpenCam(null)}
              facingMode="user"
              title="Ambil Selfie"
              hint="Lihat ke kamera, wajah dalam lingkaran, pencahayaan cukup."
              guide="face"
              bucket="verifikasi-pinjaman"
              userId={user.id}
              onUploaded={(path, preview) => setSelfie({ path, preview })}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
