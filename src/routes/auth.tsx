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

import { isPhoneLike, isValidIndonesianPhone, normalizePhoneId } from "@/lib/phone";
import { SignaturePadDialog } from "@/components/signature-pad";
import { buildAdartPdf, type AdartContent, type KoperasiInfo } from "@/lib/adart-pdf";
import { CheckCircle2, FileText, Download } from "lucide-react";
import { RequiredMark } from "@/components/ui/required-mark";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    mode: (s.mode as string) === "register" ? "register" : "login",
  }),
  head: () => ({ meta: [{ title: "Masuk / Daftar — T-COOL Koperasi" }] }),
  component: AuthPage,
});

const passwordPolicy = z
  .string()
  .max(72)
  .regex(/[a-z]/, "Password wajib mengandung huruf kecil")
  .regex(/[A-Z]/, "Password wajib mengandung huruf besar")
  .regex(/\d/, "Password wajib mengandung angka");

const loginSchema = z
  .object({
    identifier: z.string().trim().min(3, "Masukkan nomor HP atau email").max(255),
    password: z.string().min(1, "Password wajib diisi").max(72),
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
  password: passwordPolicy,
});


function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const { user, loading, roles, viewAsMember } = useAuth();
  const hasAdminRole = roles.some((role) => ["super_admin", "ketua", "sekretaris", "bendahara"].includes(role));

  useEffect(() => {
    if (!loading && user) {
      navigate({ to: hasAdminRole && !viewAsMember ? "/admin" : "/dashboard" });
    }
  }, [user, loading, hasAdminRole, viewAsMember, navigate]);

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
        return toast.error("Email/Nomor HP atau password salah");
      }
      if (!lookup) {
        setBusy(false);
        attemptsRef.current.count += 1;
        if (attemptsRef.current.count >= 5) attemptsRef.current.until = Date.now() + 30_000;
        return toast.error("Email/Nomor HP atau password salah");
      }
      email = lookup as string;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password: parsed.data.password });
    setBusy(false);
    if (error) {
      attemptsRef.current.count += 1;
      if (attemptsRef.current.count >= 5) attemptsRef.current.until = Date.now() + 30_000;
      return toast.error("Email/Nomor HP atau password salah");
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
        <Label htmlFor="li-id">Nomor HP atau Email<RequiredMark /></Label>
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
          <Label htmlFor="li-pw">Password<RequiredMark /></Label>
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

const DEFAULT_ADART: AdartContent = {
  version: "1.0",
  pasal: [
    { bab: "Pasal 1 — Keanggotaan", isi: "Anggota wajib mematuhi seluruh ketentuan koperasi, membayar simpanan pokok, simpanan wajib, dan ikut serta dalam kegiatan koperasi." },
    { bab: "Pasal 2 — Hak & Kewajiban", isi: "Setiap anggota berhak menerima SHU, mengikuti RAT, dan menggunakan layanan koperasi sesuai ketentuan yang berlaku." },
    { bab: "Pasal 3 — Persetujuan", isi: "Dengan menandatangani dokumen ini, anggota menyatakan telah membaca, memahami, dan menyetujui seluruh isi AD/ART Koperasi T-COOL." },
  ],
};

const DEFAULT_KOPERASI: KoperasiInfo = {
  nama: "Koperasi T-COOL",
  alamat: "Center Park Blok 3 No. 3, Simpang Kara, Batam",
  telepon: "0819 5917 1997",
  email: "t-coolkoperasi@gmail.com",
};

interface PendingSig {
  dataUrl: string;
  hash: string;
  fullName: string;
  version: string;
}

function RegisterForm() {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ nama_lengkap: "", nik: "", email: "", no_hp: "", alamat: "", password: "" });
  const [ktpFile, setKtpFile] = useState<File | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [signature, setSignature] = useState<PendingSig | null>(null);
  const [adart, setAdart] = useState<AdartContent>(DEFAULT_ADART);
  const [koperasi, setKoperasi] = useState<KoperasiInfo>(DEFAULT_KOPERASI);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from("settings").select("key,value").in("key", ["adart_content", "koperasi_info"]);
        const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value])) as Record<string, unknown>;
        if (map.adart_content) setAdart(map.adart_content as AdartContent);
        if (map.koperasi_info) setKoperasi(map.koperasi_info as KoperasiInfo);
      } catch {
        // settings tidak bisa dibaca anon — pakai default
      }
    })();
  }, []);

  const downloadAdart = () => {
    try {
      const doc = buildAdartPdf(koperasi, adart);
      const blobUrl = doc.output("bloburl");
      window.open(blobUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error("[adart-preview]", err);
      toast.error("Gagal membuka pratinjau AD/ART");
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = registerSchema.safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.errors[0].message);
    if (!ktpFile) return toast.error("Upload foto KTP wajib");
    if (!signature) return toast.error("Tanda tangani AD/ART terlebih dahulu");

    const normalizedPhone = normalizePhoneId(parsed.data.no_hp)!;
    setBusy(true);
    try {
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
      if (!uid) {
        toast.success("Pendaftaran terkirim. Cek email untuk verifikasi.");
        return;
      }

      // Pastikan session aktif untuk upload (jika auto-confirm off, signIn manual)
      if (!data.session) {
        await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
      }

      const updates: Record<string, string> = {};

      try {
        const ext = ktpFile.name.split(".").pop()?.toLowerCase() ?? "jpg";
        const path = `${uid}/${Date.now()}.${ext}`;
        const up = await supabase.storage.from("ktp").upload(path, ktpFile, { upsert: true, contentType: ktpFile.type });
        if (!up.error) updates.ktp_url = supabase.storage.from("ktp").getPublicUrl(path).data.publicUrl;
      } catch { /* lewati */ }

      if (avatarFile) {
        try {
          const ext = avatarFile.name.split(".").pop()?.toLowerCase() ?? "jpg";
          const path = `${uid}/${Date.now()}.${ext}`;
          const up = await supabase.storage.from("avatars").upload(path, avatarFile, { upsert: true, contentType: avatarFile.type });
          if (!up.error) updates.foto_url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
        } catch { /* lewati */ }
      }

      try {
        const blob = await (await fetch(signature.dataUrl)).blob();
        const path = `${uid}/adart-${Date.now()}.png`;
        const up = await supabase.storage.from("signatures").upload(path, blob, { upsert: true, contentType: "image/png" });
        if (!up.error) {
          const { data: signed } = await supabase.storage.from("signatures").createSignedUrl(path, 60 * 60 * 24 * 365);
          updates.adart_signed_at = new Date().toISOString();
          updates.adart_signature_url = signed?.signedUrl ?? path;
          updates.adart_signature_hash = signature.hash;
          updates.adart_version = signature.version;
        }
      } catch { /* lewati */ }

      if (Object.keys(updates).length > 0) {
        await supabase.from("profiles").update(updates as never).eq("id", uid);
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
          <Label htmlFor="r-nama">Nama Lengkap<RequiredMark /></Label>
          <Input id="r-nama" value={form.nama_lengkap} onChange={(e) => setForm({ ...form, nama_lengkap: e.target.value })} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="r-nik">NIK (16 digit)<RequiredMark /></Label>
          <Input id="r-nik" inputMode="numeric" maxLength={16} value={form.nik} onChange={(e) => setForm({ ...form, nik: e.target.value.replace(/\D/g, "") })} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="r-hp">Nomor HP<RequiredMark /></Label>
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
          <Label htmlFor="r-email">Email<RequiredMark /></Label>
          <Input id="r-email" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="r-alamat">Alamat<RequiredMark /></Label>
          <Textarea id="r-alamat" rows={2} value={form.alamat} onChange={(e) => setForm({ ...form, alamat: e.target.value })} required />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="r-pw">Password<RequiredMark /></Label>
          <PasswordInput id="r-pw" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          <p className="text-[11px] text-muted-foreground">Bebas pilih password Anda — wajib mengandung huruf besar, huruf kecil, dan angka.</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 rounded-lg border border-border bg-muted/30 p-3">
        <LocalFilePicker label={<>Upload KTP<RequiredMark /></>} hint="JPG/PNG/PDF, max 4MB" accept="image/*,.pdf" maxMB={4} value={ktpFile} onChange={setKtpFile} />
        <LocalFilePicker label="Foto Profil" hint="JPG/PNG, max 2MB (opsional)" accept="image/*" maxMB={2} value={avatarFile} onChange={setAvatarFile} />
      </div>

      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
        <div className="flex items-start gap-2">
          <FileText className="h-4 w-4 mt-0.5 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-medium">Tanda Tangani AD/ART Koperasi<RequiredMark /></p>
            <p className="text-[11px] text-muted-foreground">
              Wajib dibaca & ditandatangani sebagai bukti persetujuan menjadi anggota.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={downloadAdart}>
            <Download className="h-3 w-3 mr-1" /> Pratinjau AD/ART
          </Button>
          {signature ? (
            <div className="inline-flex items-center gap-2 rounded-md border border-success/40 bg-success/10 px-2 py-1 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
              <span>Tanda tangan tersimpan</span>
              <button type="button" className="ml-1 underline text-muted-foreground hover:text-foreground" onClick={() => setSignature(null)}>ulangi</button>
            </div>
          ) : (
            <SignaturePadDialog
              title="Tanda Tangan Persetujuan AD/ART"
              onSign={async (sig) => {
                setSignature({ dataUrl: sig.dataUrl, hash: sig.hash, fullName: sig.fullName, version: adart.version });
                toast.success("Tanda tangan tersimpan");
              }}
              trigger={
                <Button type="button" size="sm">Tanda Tangan Sekarang</Button>
              }
            />
          )}
        </div>
        <p className="text-[10px] text-muted-foreground">
          Penandatangan: <span className="font-medium">{form.nama_lengkap || "—"}</span> (NIK: {form.nik || "—"})
        </p>
      </div>

      <Button type="submit" className="w-full" disabled={busy}>
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Ajukan Pendaftaran
      </Button>
      <p className="text-xs text-muted-foreground text-center">
        Pendaftaran akan diverifikasi pengurus sebelum akun aktif penuh.
      </p>
    </form>
  );
}

function LocalFilePicker({
  label, hint, accept, maxMB, value, onChange,
}: {
  label: React.ReactNode;
  hint?: string;
  accept: string;
  maxMB: number;
  value: File | null;
  onChange: (f: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        {value && (
          <button type="button" onClick={() => { onChange(null); if (inputRef.current) inputRef.current.value = ""; }} className="text-xs text-muted-foreground hover:text-foreground">
            Hapus
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            if (f.size > maxMB * 1024 * 1024) {
              toast.error(`Ukuran maksimal ${maxMB}MB`);
              return;
            }
            onChange(f);
          }}
        />
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} className="gap-2">
          {value ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <FileText className="h-3.5 w-3.5" />}
          {value ? "Ganti file" : "Pilih file"}
        </Button>
        {value && <span className="truncate text-xs text-muted-foreground max-w-[160px]">{value.name}</span>}
      </div>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}