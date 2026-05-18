import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Phone, Mail } from "lucide-react";
import { FileUpload } from "@/components/file-upload";
import { isPhoneLike, isValidIndonesianPhone, normalizePhoneId } from "@/lib/phone";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    mode: (s.mode as string) === "register" ? "register" : "login",
  }),
  head: () => ({ meta: [{ title: "Masuk / Daftar — T-COOL Koperasi" }] }),
  component: AuthPage,
});

const loginSchema = z
  .object({
    identifier: z.string().trim().min(3, "Masukkan nomor HP atau email").max(255),
    password: z.string().min(6, "Password minimal 6 karakter").max(72),
  })
  .superRefine((val, ctx) => {
    const v = val.identifier;
    const looksPhone = isPhoneLike(v);
    if (looksPhone && !isValidIndonesianPhone(v)) {
      ctx.addIssue({ code: "custom", path: ["identifier"], message: "Nomor HP tidak valid (contoh: 0812xxxx)" });
    }
    if (!looksPhone && !/^\S+@\S+\.\S+$/.test(v)) {
      ctx.addIssue({ code: "custom", path: ["identifier"], message: "Format email/nomor HP tidak valid" });
    }
  });

const registerSchema = z.object({
  nama_lengkap: z.string().trim().min(2, "Nama minimal 2 karakter").max(100),
  nik: z.string().trim().regex(/^\d{16}$/, "NIK harus 16 digit"),
  email: z.string().trim().email("Email tidak valid").max(255),
  no_hp: z.string().trim().refine(isValidIndonesianPhone, "Nomor HP Indonesia tidak valid (contoh: 0812xxxxxxxx)"),
  alamat: z.string().trim().min(5, "Alamat minimal 5 karakter").max(500),
  password: z.string().min(8, "Password minimal 8 karakter").max(72),
});


function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-10 text-foreground" style={{ background: "var(--gradient-hero)" }}>
        <Link to="/" className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-foreground/10 backdrop-blur ring-1 ring-foreground/20" />
          <span className="text-lg font-bold text-foreground">T-COOL Koperasi</span>
        </Link>
        <div>
          <h2 className="text-4xl font-bold leading-tight text-foreground">Koperasi modern di genggaman Anda.</h2>
          <p className="mt-4 text-foreground/75 max-w-md">
            Pantau simpanan, ajukan pinjaman, dan lihat SHU Anda kapan saja — semua transparan dan realtime.
          </p>
        </div>
        <p className="text-sm text-foreground/60">© {new Date().getFullYear()} T-COOL Koperasi</p>
      </div>
      <div className="flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md">
          <Link to="/" className="lg:hidden mb-8 inline-flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg" style={{ background: "var(--gradient-primary)" }} />
            <span className="font-bold">T-COOL Koperasi</span>
          </Link>
          <h1 className="text-2xl font-bold">Selamat datang</h1>
          <p className="mt-1 text-sm text-muted-foreground">Masuk atau daftar sebagai anggota baru.</p>

          <Tabs defaultValue={mode} className="mt-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Masuk</TabsTrigger>
              <TabsTrigger value="register">Daftar</TabsTrigger>
            </TabsList>
            <TabsContent value="login" className="mt-6"><LoginForm /></TabsContent>
            <TabsContent value="register" className="mt-6"><RegisterForm /></TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function LoginForm() {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ identifier: "", password: "" });
  const inputRef = useRef<HTMLInputElement>(null);
  const attemptsRef = useRef<{ count: number; until: number }>({ count: 0, until: 0 });

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const looksPhone = isPhoneLike(form.identifier);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Soft client-side brute-force guard (server-side rate limit still applies)
    const now = Date.now();
    if (attemptsRef.current.until > now) {
      const sec = Math.ceil((attemptsRef.current.until - now) / 1000);
      return toast.error(`Terlalu banyak percobaan. Coba lagi dalam ${sec}s.`);
    }

    const parsed = loginSchema.safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.errors[0].message);
    setBusy(true);

    let email = parsed.data.identifier;
    if (isPhoneLike(email)) {
      const phone = normalizePhoneId(email);
      if (!phone) {
        setBusy(false);
        return toast.error("Nomor HP tidak valid");
      }
      const { data: lookup, error: lookupErr } = await supabase.rpc("get_email_by_phone", { _phone: phone });
      if (lookupErr) {
        setBusy(false);
        return toast.error("Gagal memverifikasi nomor HP");
      }
      if (!lookup) {
        setBusy(false);
        attemptsRef.current.count += 1;
        if (attemptsRef.current.count >= 5) attemptsRef.current.until = Date.now() + 30_000;
        return toast.error("Nomor HP belum terdaftar");
      }
      email = lookup as string;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password: parsed.data.password });
    setBusy(false);
    if (error) {
      attemptsRef.current.count += 1;
      if (attemptsRef.current.count >= 5) attemptsRef.current.until = Date.now() + 30_000;
      return toast.error(error.message === "Invalid login credentials" ? "Email/Nomor HP atau password salah" : error.message);
    }
    attemptsRef.current = { count: 0, until: 0 };
    if (data.user) {
      await supabase.from("profiles").update({ last_login: new Date().toISOString() }).eq("id", data.user.id);
    }
    toast.success("Berhasil masuk");
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="li-id">Nomor HP atau Email</Label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {looksPhone ? <Phone className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
          </span>
          <Input
            id="li-id"
            ref={inputRef}
            inputMode={looksPhone ? "tel" : "email"}
            autoComplete="username"
            placeholder="Masukkan Nomor HP"
            className="pl-9"
            value={form.identifier}
            onChange={(e) => setForm({ ...form, identifier: e.target.value })}
            required
          />
        </div>
        {looksPhone && form.identifier && (
          <p className="text-[11px] text-muted-foreground">
            Akan dikirim sebagai: <span className="font-mono">{normalizePhoneId(form.identifier) ?? "-"}</span>
          </p>
        )}
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="li-pw">Password</Label>
          <Link to="/forgot-password" className="text-xs text-primary hover:underline">Lupa password?</Link>
        </div>
        <PasswordInput id="li-pw" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Masuk
      </Button>
    </form>
  );
}

function RegisterForm() {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ nama_lengkap: "", nik: "", email: "", no_hp: "", alamat: "", password: "" });
  const ktpRef = useRef<{ path: string } | null>(null);
  const avatarRef = useRef<{ path: string; publicUrl?: string } | null>(null);
  const [tempUserId, setTempUserId] = useState<string | null>(null);

  // To enable file upload before final profile write, we sign up first (session created),
  // then upload files using the new uid, then patch profile with file URLs.
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = registerSchema.safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.errors[0].message);
    const normalizedPhone = normalizePhoneId(parsed.data.no_hp)!;
    setBusy(true);
    try {
      // Cek nomor HP unik sebelum signup
      const { data: existing, error: lookupErr } = await supabase.rpc("get_email_by_phone", { _phone: normalizedPhone });
      if (lookupErr) throw lookupErr;
      if (existing) {
        setBusy(false);
        return toast.error("Nomor HP sudah terdaftar. Silakan login.");
      }

      const redirectUrl = `${window.location.origin}/dashboard`;
      const { data, error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            nama_lengkap: parsed.data.nama_lengkap,
            no_hp: normalizedPhone,
            nik: parsed.data.nik,
            alamat: parsed.data.alamat,
          },
        },
      });
      if (error) throw error;
      const uid = data.user?.id;
      if (uid) {
        setTempUserId(uid);
        const updates: { ktp_url?: string; foto_url?: string } = {};
        if (ktpRef.current) updates.ktp_url = supabase.storage.from("ktp").getPublicUrl(ktpRef.current.path).data.publicUrl;
        if (avatarRef.current?.publicUrl) updates.foto_url = avatarRef.current.publicUrl;
        if (Object.keys(updates).length > 0) {
          await supabase.from("profiles").update(updates).eq("id", uid);
        }
      }
      toast.success("Pendaftaran berhasil. Menunggu verifikasi pengurus.");
    } catch (err) {
      const msg = (err as Error).message || "Gagal mendaftar";
      toast.error(msg.includes("profiles_no_hp_unique") ? "Nomor HP sudah terdaftar" : msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="r-nama">Nama Lengkap</Label>
          <Input id="r-nama" value={form.nama_lengkap} onChange={(e) => setForm({ ...form, nama_lengkap: e.target.value })} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="r-nik">NIK (16 digit)</Label>
          <Input id="r-nik" inputMode="numeric" maxLength={16} value={form.nik} onChange={(e) => setForm({ ...form, nik: e.target.value.replace(/\D/g, "") })} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="r-hp">Nomor HP</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <Phone className="h-4 w-4" />
            </span>
            <Input id="r-hp" inputMode="tel" placeholder="0812xxxxxxxx" className="pl-9" value={form.no_hp} onChange={(e) => setForm({ ...form, no_hp: e.target.value })} required />
          </div>
          {form.no_hp && (
            <p className="text-[11px] text-muted-foreground">
              Tersimpan sebagai: <span className="font-mono">{normalizePhoneId(form.no_hp) ?? "-"}</span>
            </p>
          )}
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="r-email">Email</Label>
          <Input id="r-email" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="r-alamat">Alamat</Label>
          <Textarea id="r-alamat" rows={2} value={form.alamat} onChange={(e) => setForm({ ...form, alamat: e.target.value })} required />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="r-pw">Password</Label>
          <PasswordInput id="r-pw" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          <p className="text-[11px] text-muted-foreground">Minimal 8 karakter. Akan dicek terhadap database password bocor.</p>
        </div>
      </div>

      {tempUserId && (
        <div className="grid gap-3 sm:grid-cols-2 rounded-lg border border-success/30 bg-success/5 p-3">
          <FileUpload bucket="ktp" userId={tempUserId} label="Upload KTP" hint="JPG/PNG/PDF, max 4MB" accept="image/*,.pdf" onUploaded={(r) => { ktpRef.current = { path: r.path }; }} />
          <FileUpload bucket="avatars" userId={tempUserId} publicBucket label="Foto Profil" hint="JPG/PNG, max 2MB" maxMB={2} onUploaded={(r) => { avatarRef.current = r; }} />
          <p className="sm:col-span-2 text-[11px] text-muted-foreground">
            Anda dapat mengunggah berkas sekarang atau nanti dari halaman profil.
          </p>
        </div>
      )}

      <Button type="submit" className="w-full" disabled={busy}>
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {tempUserId ? "Selesai" : "Daftar Anggota"}
      </Button>
      <p className="text-xs text-muted-foreground text-center">
        Pendaftaran akan diverifikasi pengurus sebelum akun aktif penuh.
      </p>
    </form>
  );
}