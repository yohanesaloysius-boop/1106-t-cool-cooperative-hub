import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { RequiredMark } from "@/components/ui/required-mark";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset Password — T-COOL Koperasi" }] }),
  component: ResetPasswordPage,
});

const schema = z.object({
  password: z
    .string()
    .min(8, "Password minimal 8 karakter")
    .max(72)
    .regex(/[a-z]/, "Password wajib mengandung huruf kecil")
    .regex(/[A-Z]/, "Password wajib mengandung huruf besar")
    .regex(/\d/, "Password wajib mengandung angka"),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, { message: "Konfirmasi password tidak cocok", path: ["confirm"] });

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ password: "", confirm: "" });

  useEffect(() => {
    // Supabase puts the recovery session in the URL hash; the client picks it up automatically.
    const sub = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    return () => sub.data.subscription.unsubscribe();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.errors[0].message);
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password berhasil diperbarui. Silakan masuk kembali.");
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold">Reset Password</h1>
        <p className="mt-1 text-sm text-muted-foreground">Buat password baru untuk akun Anda.</p>

        {!ready ? (
          <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Memverifikasi tautan...
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rp-pw">Password Baru<RequiredMark /></Label>
              <PasswordInput id="rp-pw" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
              <p className="text-[11px] text-muted-foreground">Minimal 8 karakter, wajib mengandung huruf besar, huruf kecil, dan angka.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rp-cf">Konfirmasi Password<RequiredMark /></Label>
              <PasswordInput id="rp-cf" autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} required />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Perbarui Password
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
