import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { ArrowRight, ClipboardCheck, FileSignature, IdCard, UserPlus, ShieldCheck, Wallet, BadgeCheck } from "lucide-react";

export const Route = createFileRoute("/daftar-anggota")({
  head: () => ({
    meta: [
      { title: "Daftar Anggota — T-COOL Koperasi" },
      { name: "description", content: "Cara daftar menjadi anggota T-COOL Koperasi: cukup KTP, isi data, dan tunggu verifikasi pengurus. Cepat, mudah, online." },
      { property: "og:title", content: "Daftar Anggota T-COOL Koperasi" },
      { property: "og:description", content: "Daftar online jadi anggota koperasi modern. Cukup KTP, isi data, dan langsung aktif setelah verifikasi." },
    ],
  }),
  component: DaftarAnggotaPage,
});

const steps = [
  { icon: UserPlus, title: "Isi Formulir", desc: "Lengkapi data diri: nama, NIK, alamat, dan kontak aktif." },
  { icon: IdCard, title: "Unggah KTP", desc: "Foto KTP yang jelas — disimpan aman dan terenkripsi." },
  { icon: FileSignature, title: "Tanda Tangan Digital", desc: "Setujui anggaran dasar koperasi dengan tanda tangan digital." },
  { icon: ClipboardCheck, title: "Verifikasi Pengurus", desc: "Sekretaris memverifikasi data Anda. Notifikasi langsung dikirim." },
];

const benefits = [
  { icon: Wallet, title: "Simpanan Aman", desc: "Pokok, wajib, dan sukarela tercatat realtime." },
  { icon: ShieldCheck, title: "Pinjaman Transparan", desc: "Approval berlapis, bunga jelas, tanpa biaya tersembunyi." },
  { icon: BadgeCheck, title: "SHU Otomatis", desc: "Bagi hasil dihitung otomatis di akhir periode." },
];

const persyaratan = [
  "Anggota Jemaat dan juga anggota kelompok FC",
  "Memiliki KTP yang masih berlaku",
  "Bersedia membayar simpanan pokok dan wajib",
  "Menyetujui anggaran dasar dan rumah tangga koperasi",
];

function DaftarAnggotaPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <section className="container mx-auto px-4 pt-16 pb-10 md:pt-24">
        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Pendaftaran Anggota
            </span>
            <h1 className="mt-5 text-4xl md:text-5xl font-bold tracking-tight">
              Daftar jadi anggota <span className="text-primary">dalam 5 menit.</span>
            </h1>
            <p className="mt-5 text-lg text-muted-foreground">
              Semua online — tidak perlu antre, tidak perlu fotokopi berkas. Cukup KTP dan akses internet.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/auth" search={{ mode: "register" } as never}>
                <Button size="lg" className="shadow-lg">
                  Mulai Pendaftaran <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/auth">
                <Button size="lg" variant="outline">Sudah punya akun?</Button>
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="rounded-3xl border border-border bg-card p-8" style={{ boxShadow: "var(--shadow-soft)" }}>
              <h3 className="text-lg font-semibold">Persyaratan</h3>
              <ul className="mt-4 space-y-3 text-sm">
                {persyaratan.map((p) => (
                  <li key={p} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                      <BadgeCheck className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-foreground/80">{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-12">
        <h2 className="text-3xl font-bold tracking-tight">Cara mendaftar</h2>
        <p className="mt-3 text-muted-foreground max-w-2xl">Empat langkah singkat — semuanya online dari ponsel atau komputer Anda.</p>
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <div key={s.title} className="relative rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-1" style={{ boxShadow: "var(--shadow-card)" }}>
              <span className="absolute -top-3 left-6 rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
                Langkah {i + 1}
              </span>
              <div className="mt-2 flex h-11 w-11 items-center justify-center rounded-xl text-primary-foreground" style={{ background: "var(--gradient-primary)" }}>
                <s.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-4 py-12">
        <div className="rounded-3xl border border-border bg-card p-8 md:p-10" style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="max-w-2xl">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Apa yang Anda dapatkan?</h2>
            <p className="mt-3 text-muted-foreground">Manfaat menjadi anggota T-COOL Koperasi.</p>
          </div>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {benefits.map((b) => (
              <div key={b.title} className="rounded-2xl border border-border/60 bg-background p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <b.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold">{b.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16">
        <div className="relative overflow-hidden rounded-3xl p-10 md:p-14 text-white" style={{ background: "linear-gradient(135deg, hsl(160 84% 22%), hsl(160 70% 38%))", boxShadow: "var(--shadow-elegant)" }}>
          <div className="max-w-2xl">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight drop-shadow-sm">Siap menjadi anggota?</h2>
            <p className="mt-1 text-sm text-[#2c2626]">Pendaftaran gratis. Aktivasi setelah verifikasi pengurus.</p>
            <div className="mt-8">
              <Link to="/auth" search={{ mode: "register" } as never}>
                <Button size="lg" variant="secondary" className="shadow-lg">
                  Daftar Sekarang <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}