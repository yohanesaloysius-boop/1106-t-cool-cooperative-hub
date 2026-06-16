import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { ArrowRight, HeartHandshake, Sparkles, ShieldCheck, Users, Target, Eye, BadgeInfo, ScrollText, Network, Building2, GitBranch } from "lucide-react";

export const Route = createFileRoute("/tentang")({
  head: () => ({
    meta: [
      { title: "Tentang Kami — T-COOL Koperasi" },
      { name: "description", content: "Mengenal T-COOL Koperasi: misi mendigitalkan koperasi Indonesia agar transparan, modern, dan terpercaya." },
      { property: "og:title", content: "Tentang T-COOL Koperasi" },
      { property: "og:description", content: "Misi kami: koperasi yang transparan, modern, dan terpercaya untuk semua anggota." },
    ],
  }),
  component: TentangPage,
});

const values = [
  { icon: HeartHandshake, title: "Gotong Royong", desc: "Membangun ekonomi anggota dari, oleh, dan untuk anggota." },
  { icon: ShieldCheck, title: "Transparan", desc: "Setiap transaksi tercatat dan dapat diaudit kapan saja." },
  { icon: Sparkles, title: "Modern", desc: "Pengalaman seperti aplikasi fintech, mudah dipakai semua usia." },
  { icon: Users, title: "Inklusif", desc: "Mendukung koperasi besar maupun kecil di seluruh Indonesia." },
];

const splitLines = (s?: string) => (s ?? "").split("\n").map((x) => x.trim()).filter(Boolean);

function OrgBox({ title, items, className = "" }: { title: string; items?: string[]; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-lg border-2 border-foreground/70 bg-card text-center ${className}`}>
      <div className="border-b-2 border-foreground/70 bg-primary/10 px-3 py-2 text-sm font-bold tracking-tight">{title}</div>
      {items && items.length > 0 && (
        <ul className="divide-y divide-border">
          {items.map((it, i) => (
            <li key={i} className="px-3 py-1.5 text-xs">{it}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TentangPage() {
  const { data: pengurus } = useQuery({
    queryKey: ["public-pengurus"],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_public_pengurus");
      if (error) throw error;
      return (data ?? []) as { jabatan: string; nama: string; foto_url: string }[];
    },
    staleTime: 60_000,
  });
  const pengurusList = (pengurus ?? []).filter((p) => p.nama || p.foto_url);

  const { data: tentang } = useQuery({
    queryKey: ["public-tentang"],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_public_tentang");
      if (error) throw error;
      return (data ?? {}) as Record<string, string>;
    },
    staleTime: 60_000,
  });
  const t = tentang ?? {};

  // Scroll to hash section when navigating from the dropdown
  useEffect(() => {
    const id = window.location.hash.replace("#", "");
    if (!id) return;
    const el = document.getElementById(id);
    if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
  }, [tentang]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <section className="container mx-auto px-4 pt-16 pb-10 md:pt-24">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Tentang Kami
          </span>
          <h1 className="mt-5 text-4xl md:text-5xl font-bold tracking-tight">
            Mendigitalkan koperasi Indonesia, <span className="text-primary">satu anggota dalam satu waktu.</span>
          </h1>
          <p className="mt-5 text-lg text-muted-foreground">
            T-COOL Koperasi lahir dari kebutuhan koperasi modern: pencatatan rapi, approval transparan, dan pengalaman pengguna sebaik aplikasi fintech yang Anda pakai sehari-hari.
          </p>
        </div>
      </section>

      <section className="container mx-auto px-4 py-10">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-border bg-card p-8" style={{ boxShadow: "var(--shadow-card)" }}>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl text-primary-foreground" style={{ background: "var(--gradient-primary)" }}>
              <Target className="h-5 w-5" />
            </div>
            <h2 className="mt-5 text-2xl font-semibold">Misi Kami</h2>
            <p className="mt-3 text-muted-foreground">
              Memberi koperasi alat kelola yang sederhana namun kuat — dari simpanan, pinjaman, hingga pembagian SHU — sehingga pengurus fokus melayani anggota, bukan mengurus berkas.
            </p>
          </div>
          <div className="rounded-3xl border border-border bg-card p-8" style={{ boxShadow: "var(--shadow-card)" }}>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl text-primary-foreground" style={{ background: "var(--gradient-primary)" }}>
              <Eye className="h-5 w-5" />
            </div>
            <h2 className="mt-5 text-2xl font-semibold">Visi Kami</h2>
            <p className="mt-3 text-muted-foreground">
              Menjadi platform koperasi digital paling tepercaya di Indonesia, di mana setiap anggota merasakan manfaat ekonomi yang adil dan transparan.
            </p>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-12">
        <h2 className="text-3xl font-bold tracking-tight">Nilai yang kami pegang</h2>
        <p className="mt-3 text-muted-foreground max-w-2xl">Empat prinsip yang menuntun setiap fitur yang kami bangun.</p>
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {values.map((v) => (
            <div key={v.title} className="rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-1" style={{ boxShadow: "var(--shadow-card)" }}>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl text-primary-foreground" style={{ background: "var(--gradient-primary)" }}>
                <v.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-lg font-semibold">{v.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{v.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Makna Logo dan Nama */}
      <section id="makna-logo" className="container mx-auto scroll-mt-24 px-4 py-12">
        <div className="rounded-3xl border border-border bg-card p-8" style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl text-primary-foreground" style={{ background: "var(--gradient-primary)" }}><BadgeInfo className="h-5 w-5" /></div>
            <h2 className="text-2xl font-bold tracking-tight">Makna Logo dan Nama</h2>
          </div>
          <p className="mt-4 whitespace-pre-line text-muted-foreground">{t.makna_logo || "—"}</p>
        </div>
      </section>

      {/* Visi dan Misi */}
      <section id="visi-misi" className="container mx-auto scroll-mt-24 px-4 py-12">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl text-primary-foreground" style={{ background: "var(--gradient-primary)" }}><Target className="h-5 w-5" /></div>
          <h2 className="text-2xl font-bold tracking-tight">Visi dan Misi</h2>
        </div>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-border bg-card p-8" style={{ boxShadow: "var(--shadow-card)" }}>
            <h3 className="text-lg font-semibold">Visi</h3>
            <p className="mt-3 whitespace-pre-line text-muted-foreground">{t.visi || "—"}</p>
          </div>
          <div className="rounded-3xl border border-border bg-card p-8" style={{ boxShadow: "var(--shadow-card)" }}>
            <h3 className="text-lg font-semibold">Misi</h3>
            <ul className="mt-3 list-decimal space-y-1.5 pl-5 text-muted-foreground">
              {splitLines(t.misi).map((m, i) => <li key={i}>{m}</li>)}
            </ul>
          </div>
        </div>
      </section>


      {/* Struktur Organisasi */}
      <section id="struktur-organisasi" className="container mx-auto scroll-mt-24 px-4 py-12">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl text-primary-foreground" style={{ background: "var(--gradient-primary)" }}><Network className="h-5 w-5" /></div>
          <h2 className="text-2xl font-bold tracking-tight">Struktur Organisasi</h2>
        </div>
        <div className="mt-8 rounded-3xl border border-border bg-card p-6 md:p-10" style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="mx-auto grid max-w-4xl items-start gap-6 md:grid-cols-[1fr_auto]">
            <div className="space-y-6">
              <OrgBox title={t.org_rapat_anggota || "RAPAT ANGGOTA"} className="mx-auto w-full max-w-sm" />
              <div className="flex justify-center"><div className="h-6 w-px bg-foreground/40" /></div>
              <div className="grid gap-6 sm:grid-cols-2">
                <OrgBox title="PENGAWAS" items={splitLines(t.org_pengawas)} />
                <OrgBox title="PENGURUS" items={splitLines(t.org_pengurus)} />
              </div>
              <div className="flex justify-center"><div className="h-6 w-px bg-foreground/40" /></div>
              <OrgBox title={t.org_manajemen || "MANAJEMEN"} className="mx-auto w-full max-w-sm" />
              <div className="flex justify-center"><div className="h-6 w-px bg-foreground/40" /></div>
              <OrgBox title={t.org_anggota || "ANGGOTA"} className="mx-auto w-full max-w-sm" />
            </div>
            <div className="space-y-4 md:pt-2">
              {splitLines(t.org_eksternal).map((e, i) => (
                <OrgBox key={i} title={e} className="w-full md:w-48" />
              ))}
            </div>
          </div>
          <div className="mt-8 border-t border-border pt-4 text-xs text-muted-foreground">
            <p className="font-semibold">Keterangan</p>
            <p className="mt-1">Garis koordinasi, garis perintah, dan garis pelayanan menghubungkan setiap unsur organisasi koperasi.</p>
          </div>
        </div>
      </section>

      {/* Struktur Manajemen */}
      <section id="struktur-manajemen" className="container mx-auto scroll-mt-24 px-4 py-12">
        <div className="rounded-3xl border border-border bg-card p-8" style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl text-primary-foreground" style={{ background: "var(--gradient-primary)" }}><GitBranch className="h-5 w-5" /></div>
            <h2 className="text-2xl font-bold tracking-tight">Struktur Manajemen</h2>
          </div>
          <ul className="mt-4 space-y-2">
            {splitLines(t.struktur_manajemen).map((m, i) => (
              <li key={i} className="flex items-center gap-2 text-muted-foreground"><Building2 className="h-4 w-4 text-primary" /> {m}</li>
            ))}
          </ul>
        </div>
      </section>


      {pengurusList.length > 0 && (
        <section className="container mx-auto px-4 py-12">
          <h2 className="text-3xl font-bold tracking-tight">Struktur Pengurus</h2>
          <p className="mt-3 text-muted-foreground max-w-2xl">Pengurus & dewan pengawas Koperasi T-COOL.</p>
          <div className="mt-10 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
            {pengurusList.map((p, i) => (
              <div
                key={i}
                className="flex flex-col items-center rounded-3xl border border-border bg-card p-5 text-center transition-all hover:-translate-y-1"
                style={{ boxShadow: "var(--shadow-card)" }}
              >
                <div className="h-24 w-24 overflow-hidden rounded-full border-4 border-primary/15 bg-muted">
                  {p.foto_url ? (
                    <img src={p.foto_url} alt={p.nama || p.jabatan} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-2xl font-bold text-primary/40">
                      {(p.nama || p.jabatan).charAt(0)}
                    </span>
                  )}
                </div>
                <p className="mt-4 text-sm font-semibold leading-tight">{p.nama || "—"}</p>
                <span className="mt-1 inline-flex rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
                  {p.jabatan}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="container mx-auto px-4 py-16">
        <div className="relative overflow-hidden rounded-3xl p-10 md:p-14 text-white" style={{ background: "linear-gradient(135deg, hsl(160 84% 22%), hsl(160 70% 38%))", boxShadow: "var(--shadow-elegant)" }}>
          <div className="max-w-2xl">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight drop-shadow-sm">Siap bergabung?</h2>
            <p className="mt-1 text-sm text-[#3b3535]">Daftarkan diri Anda dan rasakan koperasi yang berbeda — modern, transparan, dan ada di genggaman.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/daftar-anggota">
                <Button size="lg" variant="secondary" className="shadow-lg">
                  Daftar Anggota <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/auth">
                <Button size="lg" variant="outline" className="border-white/40 bg-white/10 text-white hover:bg-white/20">Masuk</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}