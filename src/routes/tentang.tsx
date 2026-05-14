import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { ArrowRight, HeartHandshake, Sparkles, ShieldCheck, Users, Target, Eye } from "lucide-react";

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

function TentangPage() {
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

      <section className="container mx-auto px-4 py-16">
        <div className="relative overflow-hidden rounded-3xl p-10 md:p-14 text-primary-foreground" style={{ background: "var(--gradient-hero)" }}>
          <div className="max-w-2xl">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Siap bergabung?</h2>
            <p className="mt-4 text-white/85">Daftarkan diri Anda dan rasakan koperasi yang berbeda — modern, transparan, dan ada di genggaman.</p>
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