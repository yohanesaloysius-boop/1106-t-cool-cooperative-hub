import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Wallet, TrendingUp, ShieldCheck, Users, Calculator, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteFooter, SiteHeader } from "@/components/site-header";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "T-COOL Koperasi — Digitalisasi Koperasi Anda" },
      { name: "description", content: "Kelola simpanan, pinjaman, angsuran, dan SHU koperasi secara realtime. Mobile-friendly, transparan, dan aman." },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: Wallet, title: "Simpanan Digital", desc: "Pokok, wajib, sukarela — tercatat realtime dengan bukti transfer." },
  { icon: Calculator, title: "Kalkulator Pinjaman", desc: "Simulasi cicilan flat / efektif / menurun langsung tampil." },
  { icon: TrendingUp, title: "Dashboard Fintech", desc: "Saldo, sisa angsuran, SHU, dan tagihan jatuh tempo dalam satu layar." },
  { icon: ShieldCheck, title: "Approval Berlapis", desc: "Workflow Sekretaris → Bendahara → Ketua dengan tanda tangan digital." },
  { icon: Users, title: "Multi Role", desc: "Super Admin, Ketua, Sekretaris, Bendahara, dan Anggota." },
  { icon: BellRing, title: "Notifikasi Realtime", desc: "Tagihan, persetujuan, dan pengumuman langsung sampai." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 opacity-90" style={{ background: "var(--gradient-hero)" }} />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,white_0%,transparent_60%)] opacity-20" />
        <div className="container mx-auto px-4 py-24 md:py-32 text-primary-foreground">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-white" /> Sistem Manajemen Koperasi Modern
            </span>
            <h1 className="mt-6 text-4xl md:text-6xl font-bold tracking-tight">
              Koperasi Anda, <br className="hidden md:block" /> serasa aplikasi <span className="italic">fintech</span>.
            </h1>
            <p className="mt-6 text-lg md:text-xl text-white/80 max-w-2xl">
              T-COOL Koperasi mendigitalkan simpanan, pinjaman, angsuran, dan pembagian SHU — dengan approval berlapis, tanda tangan digital, dan dashboard realtime.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link to="/auth" search={{ mode: "register" } as never}>
                <Button size="lg" variant="secondary" className="shadow-lg">
                  Mulai Sekarang <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/auth">
                <Button size="lg" variant="outline" className="border-white/40 bg-white/10 text-white hover:bg-white/20">
                  Masuk ke Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-20">
        <div className="max-w-2xl">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Semua kebutuhan koperasi, dalam satu platform.</h2>
          <p className="mt-4 text-muted-foreground">
            Tidak ada lagi pencatatan manual. Anggota, pengurus, dan ketua bekerja di sistem yang sama — transparan dan auditable.
          </p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-1"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl text-primary-foreground" style={{ background: "var(--gradient-primary)" }}>
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
