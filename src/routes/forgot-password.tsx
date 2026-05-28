import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ArrowLeft, Phone, Mail, MessageCircle } from "lucide-react";
import { isValidIndonesianPhone, normalizePhoneId } from "@/lib/phone";
import { RequiredMark } from "@/components/ui/required-mark";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Lupa Password — T-COOL Koperasi" }] }),
  component: ForgotPasswordPage,
});

const emailSchema = z.object({ email: z.string().trim().email("Email tidak valid").max(255) });
const phoneSchema = z.object({ phone: z.string().trim().refine(isValidIndonesianPhone, "Nomor HP tidak valid") });

function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <Link to="/auth" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Kembali
        </Link>
        <h1 className="mt-4 text-2xl font-bold">Lupa Password</h1>
        <p className="mt-1 text-sm text-muted-foreground">Pulihkan akses akun Anda via nomor HP atau email.</p>

        <Tabs defaultValue="phone" className="mt-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="phone"><Phone className="mr-2 h-4 w-4" /> Nomor HP</TabsTrigger>
            <TabsTrigger value="email"><Mail className="mr-2 h-4 w-4" /> Email</TabsTrigger>
          </TabsList>
          <TabsContent value="phone" className="mt-6"><PhoneReset /></TabsContent>
          <TabsContent value="email" className="mt-6"><EmailReset /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function PhoneReset() {
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [channel, setChannel] = useState<"wa" | "sms">("wa");
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = phoneSchema.safeParse({ phone });
    if (!parsed.success) return toast.error(parsed.error.errors[0].message);
    const normalized = normalizePhoneId(parsed.data.phone)!;
    setBusy(true);
    try {
      const { data: email } = await supabase.rpc("get_email_by_phone", { _phone: normalized });
      if (!email) {
        toast.error("Nomor HP belum terdaftar");
        return;
      }
      // Placeholder: integrasi OTP WhatsApp / SMS belum aktif.
      // Untuk saat ini kirim tautan reset ke email yang terhubung.
      await supabase.auth.resetPasswordForEmail(email as string, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setSent(true);
      toast.success(`Kode OTP via ${channel === "wa" ? "WhatsApp" : "SMS"} akan dikirim ke ${normalized} (segera tersedia).`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="rounded-xl border border-success/30 bg-success/10 p-4 text-sm">
        <p>OTP placeholder untuk <strong>{normalizePhoneId(phone)}</strong> via {channel === "wa" ? "WhatsApp" : "SMS"} sedang dalam pengembangan.</p>
        <p className="mt-2 text-muted-foreground">Sementara, tautan reset password sudah dikirim ke email yang terhubung dengan nomor ini.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="fp-phone">Nomor HP terdaftar<RequiredMark /></Label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            <Phone className="h-4 w-4" />
          </span>
          <Input id="fp-phone" inputMode="tel" autoFocus placeholder="0812xxxxxxxx" className="pl-9" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Kirim OTP melalui</Label>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setChannel("wa")}
            className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${channel === "wa" ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent"}`}>
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </button>
          <button type="button" onClick={() => setChannel("sms")}
            className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${channel === "sms" ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent"}`}>
            <Phone className="h-4 w-4" /> SMS
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground">Integrasi OTP WhatsApp/SMS akan segera tersedia.</p>
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Kirim OTP
      </Button>
    </form>
  );
}

function EmailReset() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = emailSchema.safeParse({ email });
    if (!parsed.success) return toast.error(parsed.error.errors[0].message);
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setSent(true);
    toast.success("Tautan reset terkirim. Cek inbox email Anda.");
  };

  if (sent) {
    return (
      <div className="rounded-xl border border-success/30 bg-success/10 p-4 text-sm">
        Tautan reset password sudah dikirim ke <strong>{email}</strong>.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="fp-email">Email<RequiredMark /></Label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            <Mail className="h-4 w-4" />
          </span>
          <Input id="fp-email" type="email" autoComplete="email" autoFocus className="pl-9" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Kirim Tautan Reset
      </Button>
    </form>
  );
}
