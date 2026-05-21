import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { GuarantorPicker, type GuarantorSelection } from "@/components/guarantor-picker";

type BungaJenis = "flat" | "efektif" | "menurun";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  plafonMax?: number;
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
  { id: 2, title: "Penjamin", icon: ShieldCheck },
  { id: 3, title: "Verifikasi Identitas", icon: ScanFace },
  { id: 4, title: "Review & Submit", icon: CheckCircle2 },
];

export function LoanApplicationWizard({ open, onOpenChange, initial, plafonMax }: Props) {
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
  const [selfie2, setSelfie2] = useState<{ path: string; preview: string } | null>(null);
  const [openCam, setOpenCam] = useState<"ktp" | "selfie" | "selfie2" | null>(null);
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
  const [guarantors, setGuarantors] = useState<GuarantorSelection[]>([]);

  // Load guarantor settings
  const settingsQ = useQuery({
    queryKey: ["guarantor-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("settings")
        .select("key,value")
        .in("key", ["guarantor_threshold_1", "guarantor_required_1", "guarantor_threshold_2", "guarantor_required_2"]);
      if (error) throw error;
      const map: Record<string, number> = {};
      (data ?? []).forEach((r: any) => { map[r.key] = Number(r.value); });
      return {
        t1: map.guarantor_threshold_1 ?? 5_000_000,
        r1: map.guarantor_required_1 ?? 2,
        t2: map.guarantor_threshold_2 ?? 10_000_000,
        r2: map.guarantor_required_2 ?? 4,
      };
    },
  });

  const nominalNum = Number(form.nominal) || 0;
  const guarantorsRequired = (() => {
    const s = settingsQ.data;
    if (!s) return 0;
    if (nominalNum >= s.t2) return s.r2;
    if (nominalNum >= s.t1) return s.r1;
    return 0;
  })();
  const perGuarantorAmount = guarantorsRequired > 0 ? Math.ceil(nominalNum / guarantorsRequired) : 0;

  const sim = useMemo(() => {
    const n = Number(form.nominal) || 0;
    const t = Number(form.tenor_bulan) || 1;
    const b = Number(form.bunga_persen) || 0;
    if (n <= 0) return null;
    return calcLoan(n, t, b, form.bunga_jenis);
  }, [form]);

  const reset = () => {
    setStep(1); setKtp(null); setSelfie(null); setSelfie2(null); setPrivy(null); setPrivyErr(null); setGuarantors([]);
    setForm({ nominal: "", tenor_bulan: "12", bunga_persen: "1.5", bunga_jenis: "flat", tujuan: "", agree: false });
  };

  const runPrivy = async () => {
    if (!ktp || !selfie) return;
    setPrivyBusy(true); setPrivyErr(null);
    try {
      const res = await verifyPrivyFn({ data: {
        ktpPath: ktp.path,
        selfiePath: selfie.path,
        selfie2Path: selfie2?.path,
        bucket: "verifikasi-pinjaman",
      } });
      if (!res.ok) { setPrivyErr(res.error ?? "Verifikasi gagal"); setPrivy(null); }
      else {
        const r = res.result;
        setPrivy({
          mode: res.mode, nik: r.nik, nama: r.nama, tgl_lahir: r.tgl_lahir, alamat: r.alamat,
          face_match_score: r.face_match_score, liveness: r.liveness, status: r.status, referenceId: r.referenceId,
        });
        if (r.face_match_score < 0.80) setPrivyErr(`Skor wajah ${(r.face_match_score * 100).toFixed(1)}% (min 80%). Ulangi selfie dengan pencahayaan lebih baik.`);
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
      if (guarantorsRequired > 0 && guarantors.length < guarantorsRequired) {
        throw new Error(`Pinjaman ini wajib memiliki ${guarantorsRequired} penjamin`);
      }
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
            provider: "ai-gemini",
            mode: privy?.mode ?? null,
            nik: privy?.nik ?? (profile as any)?.nik ?? null,
            nama: privy?.nama ?? profile?.nama_lengkap ?? null,
            tempat_lahir: (privy as any)?.tempat_lahir ?? null,
            tgl_lahir: privy?.tgl_lahir ?? null,
            jenis_kelamin: (privy as any)?.jenis_kelamin ?? null,
            alamat: privy?.alamat ?? null,
            liveness: privy?.liveness ?? null,
            ktp_quality: (privy as any)?.ktp_quality ?? null,
            nik_format_valid: (privy as any)?.nik_format_valid ?? null,
            ai_status: privy?.status ?? null,
            ai_notes: (privy as any)?.notes ?? null,
            reference: privy?.referenceId ?? null,
          },
          face_match_score: privy?.face_match_score ?? null,
          location,
          user_agent: navigator.userAgent,
        })
        .select("id")
        .single();
      if (vErr) throw vErr;

      const { data: pinjamanRow, error: pErr } = await supabase.from("pinjaman").insert({
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
      }).select("id").single();
      if (pErr) throw pErr;

      // Insert guarantor requests + notifications
      if (guarantors.length > 0 && pinjamanRow) {
        const { error: gErr } = await supabase.from("loan_guarantors").insert(
          guarantors.map((g) => ({
            pinjaman_id: pinjamanRow.id,
            borrower_id: user!.id,
            guarantor_id: g.user_id,
            guarantee_amount: g.guarantee_amount,
            status: "pending" as const,
          })),
        );
        if (gErr) throw gErr;

        await supabase.from("notifications").insert(
          guarantors.map((g) => ({
            user_id: g.user_id,
            judul: "🤝 Permintaan menjadi penjamin",
            pesan: `${profile?.nama_lengkap ?? "Anggota"} meminta Anda menjadi penjamin pinjaman ${fmt.format(parsed.nominal)}. Klik untuk menyetujui atau menolak.`,
            kategori: "approval" as const,
            url: "/penjamin",
            ref_table: "loan_guarantors",
          })),
        );
      }

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

  const exceedsPlafon = typeof plafonMax === "number" && Number(form.nominal) > plafonMax;
  const canNext1 = (() => {
    try { schema.parse(form); return form.agree && !exceedsPlafon; } catch { return false; }
  })();
  const canNext2 = guarantorsRequired === 0 || guarantors.length >= guarantorsRequired;
  // Boleh lanjut jika AI memverifikasi langsung ATAU butuh review manual admin (skor rendah / NIK tidak terbaca).
  const canNext3 = !!ktp && !!selfie && !!privy && (privy.status === "verified" || privy.status === "pending_review");

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
              {typeof plafonMax === "number" && (
                <div className={`rounded-lg border p-2 text-xs ${exceedsPlafon ? "border-destructive/40 bg-destructive/5 text-destructive" : "border-border text-muted-foreground"}`}>
                  Plafon disetujui sistem: <strong>{fmt.format(plafonMax)}</strong>
                  {exceedsPlafon && <span> · Nominal melebihi plafon Anda</span>}
                </div>
              )}
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
              {guarantorsRequired === 0 ? (
                <Card className="p-6 text-center">
                  <ShieldCheck className="mx-auto h-10 w-10 text-success" />
                  <p className="mt-3 font-semibold">Tidak perlu penjamin</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Nominal pinjaman Anda di bawah ambang batas penjamin koperasi.
                  </p>
                </Card>
              ) : (
                <GuarantorPicker
                  required={guarantorsRequired}
                  perGuarantorAmount={perGuarantorAmount}
                  selected={guarantors}
                  onChange={setGuarantors}
                />
              )}
            </div>
          )}

          {step === 3 && (
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
                      <p className="font-semibold">Selfie #1 — Wajah Netral</p>
                      <p className="text-xs text-muted-foreground">Lihat ke kamera, ekspresi datar, tanpa masker/kacamata gelap.</p>
                    </div>
                  </div>
                  {selfie ? <CheckCircle2 className="h-5 w-5 text-success" /> : <Camera className="h-5 w-5 text-muted-foreground" />}
                </div>
                {selfie && <img src={selfie.preview} alt="Selfie" className="max-h-56 w-full object-contain bg-muted" />}
                <div className="border-t p-3">
                  <Button variant={selfie ? "outline" : "default"} size="sm" className="w-full gap-2" onClick={() => setOpenCam("selfie")}>
                    <Camera className="h-4 w-4" /> {selfie ? "Ambil ulang Selfie #1" : "Ambil Selfie #1 (Netral)"}
                  </Button>
                </div>
              </Card>

              <Card className="overflow-hidden">
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-primary/10 p-2 text-primary"><ScanFace className="h-5 w-5" /></div>
                    <div>
                      <p className="font-semibold">Selfie #2 — Tersenyum <Badge variant="outline" className="ml-1 text-[9px]">Anti-replay</Badge></p>
                      <p className="text-xs text-muted-foreground">Foto kedua dgn ekspresi berbeda. Mencegah screenshot/cetakan dipakai ulang.</p>
                    </div>
                  </div>
                  {selfie2 ? <CheckCircle2 className="h-5 w-5 text-success" /> : <Camera className="h-5 w-5 text-muted-foreground" />}
                </div>
                {selfie2 && <img src={selfie2.preview} alt="Selfie 2" className="max-h-56 w-full object-contain bg-muted" />}
                <div className="border-t p-3">
                  <Button variant={selfie2 ? "outline" : "secondary"} size="sm" className="w-full gap-2" onClick={() => setOpenCam("selfie2")}>
                    <Camera className="h-4 w-4" /> {selfie2 ? "Ambil ulang Selfie #2" : "Ambil Selfie #2 (Tersenyum)"}
                  </Button>
                </div>
              </Card>

              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                🔒 Foto Anda disimpan secara privat dengan watermark nama & waktu. Akses hanya untuk pengurus koperasi terverifikasi.
              </div>

              {/* e-KYC Privy */}
              <Card className="overflow-hidden border-primary/30">
                <div className="flex items-start justify-between gap-3 p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-primary/10 p-2 text-primary"><ShieldCheck className="h-5 w-5" /></div>
                    <div>
                      <p className="font-semibold flex items-center gap-2">
                        Verifikasi AI (OCR + Face Match)
                        {privy?.status === "verified" && <Badge className="text-[10px] bg-success text-success-foreground">Terverifikasi</Badge>}
                        {privy?.status === "pending_review" && <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-600">Review Manual</Badge>}
                        {privy?.status === "rejected" && <Badge variant="destructive" className="text-[10px]">Ditolak</Badge>}
                      </p>
                      <p className="text-xs text-muted-foreground">OCR KTP otomatis + cocokkan wajah selfie. Skor rendah akan diverifikasi pengurus secara manual.</p>
                    </div>
                  </div>
                  {privy?.status === "verified" && <CheckCircle2 className="h-5 w-5 text-success" />}
                </div>

                {privy ? (
                  <div className="space-y-2 border-t bg-muted/30 p-4 text-xs">
                    <div className="grid grid-cols-2 gap-y-1">
                      <span className="text-muted-foreground">NIK</span>
                      <span className={`text-right font-mono ${(privy as any).nik_format_valid === false ? "text-destructive" : ""}`}>
                        {privy.nik || "—"}
                      </span>
                      <span className="text-muted-foreground">Nama</span><span className="text-right font-medium">{privy.nama || "—"}</span>
                      <span className="text-muted-foreground">Tgl Lahir</span><span className="text-right">{privy.tgl_lahir || "—"}</span>
                      <span className="text-muted-foreground">Liveness</span><span className="text-right">{privy.liveness}</span>
                      <span className="text-muted-foreground">Kualitas KTP</span><span className="text-right">{(privy as any).ktp_quality ?? "—"}</span>
                      <span className="text-muted-foreground">Face Match</span>
                      <span className={`text-right font-semibold ${privy.face_match_score >= 0.80 ? "text-success" : "text-amber-600"}`}>
                        {(privy.face_match_score * 100).toFixed(1)}% <span className="text-[10px] font-normal text-muted-foreground">(min 80%)</span>
                      </span>
                      <span className="text-muted-foreground">Ref</span><span className="text-right font-mono text-[10px]">{privy.referenceId}</span>
                    </div>
                    {(privy as any).notes && (
                      <p className="rounded bg-background/60 p-2 text-[11px] text-muted-foreground">📝 {(privy as any).notes}</p>
                    )}
                    {privy.status === "pending_review" && (
                      <div className="rounded bg-amber-500/10 p-2 text-[11px] text-amber-700 dark:text-amber-300">
                        ℹ Skor verifikasi belum maksimal. Pengajuan tetap bisa dilanjutkan — pengurus akan memverifikasi identitas Anda secara manual.
                      </div>
                    )}
                    {privy.status === "rejected" && (
                      <div className="rounded bg-destructive/10 p-2 text-[11px] text-destructive">
                        ✗ KTP tidak terbaca atau selfie tidak valid. Mohon ambil ulang foto.
                      </div>
                    )}
                  </div>
                ) : null}

                {privyErr && (
                  <div className="border-t bg-destructive/10 p-3 text-xs text-destructive">⚠ {privyErr}</div>
                )}

                <div className="border-t p-3">
                  <Button
                    onClick={runPrivy}
                    disabled={!ktp || !selfie || privyBusy}
                    variant={privy?.status === "verified" ? "outline" : "default"}
                    size="sm"
                    className="w-full gap-2"
                  >
                    {privyBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                    {privy ? "Verifikasi ulang" : "Mulai Verifikasi AI"}
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {step === 4 && (
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
              {guarantors.length > 0 && (
                <Card className="p-4">
                  <p className="text-xs font-medium text-muted-foreground">Penjamin ({guarantors.length})</p>
                  <div className="mt-2 space-y-1">
                    {guarantors.map((g) => (
                      <div key={g.user_id} className="flex justify-between text-sm">
                        <span>{g.nama}</span>
                        <span className="font-mono">{fmt.format(g.guarantee_amount)}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
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
          {step < 4 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={(step === 1 && !canNext1) || (step === 2 && !canNext2) || (step === 3 && !canNext3)}
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
              watermark={profile?.nama_lengkap ?? undefined}
              onUploaded={(path, preview) => setKtp({ path, preview })}
            />
            <CameraCapture
              open={openCam === "selfie"}
              onOpenChange={(v) => !v && setOpenCam(null)}
              facingMode="user"
              title="Ambil Selfie #1 (Netral)"
              hint="Lihat ke kamera, wajah dalam lingkaran, ekspresi datar."
              guide="face"
              bucket="verifikasi-pinjaman"
              userId={user.id}
              watermark={profile?.nama_lengkap ?? undefined}
              onUploaded={(path, preview) => setSelfie({ path, preview })}
            />
            <CameraCapture
              open={openCam === "selfie2"}
              onOpenChange={(v) => !v && setOpenCam(null)}
              facingMode="user"
              title="Ambil Selfie #2 (Tersenyum)"
              hint="Tersenyum / ekspresi berbeda. Anti screenshot."
              guide="face"
              bucket="verifikasi-pinjaman"
              userId={user.id}
              watermark={profile?.nama_lengkap ?? undefined}
              onUploaded={(path, preview) => setSelfie2({ path, preview })}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
