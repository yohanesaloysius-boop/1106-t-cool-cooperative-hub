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

function ChartBox({ title, items, left, top, width, height }: { title: string; items?: string[]; left: number; top: number; width: number; height?: number }) {
  return (
    <div className="absolute" style={{ left, top, width, height }}>
      <div className="overflow-hidden rounded-md border-2 border-foreground/70 bg-card text-center" style={height ? { height: "100%" } : undefined}>
        {items && items.length > 0 ? (
          <>
            <div className="flex h-[34px] items-center justify-center border-b-2 border-foreground/70 bg-primary/10 px-2 text-sm font-bold tracking-tight">{title}</div>
            {items.map((it, i) => (
              <div key={i} className="flex h-[30px] items-center justify-center border-b border-border px-2 text-xs last:border-b-0">{it}</div>
            ))}
          </>
        ) : (
          <div className="flex items-center justify-center px-2 text-center text-sm font-bold tracking-tight" style={{ height: "100%" }}>{title}</div>
        )}
      </div>
    </div>
  );
}

function OrgChart({ t }: { t: Record<string, string> }) {
  const pengawas = splitLines(t.org_pengawas);
  const pengurus = splitLines(t.org_pengurus);
  const eksternal = splitLines(t.org_eksternal);
  const dinas = eksternal[0] || "DINAS KOPERASI KOTA BATAM";
  const puskopdit = eksternal[1] || "PUSKOPDIT BATAM";
  const dewan = eksternal[2] || "PUSKOPDIT";

  const HEADER = 34, ROW = 30;
  // RAPAT ANGGOTA (top center)
  const raX = 300, raY = 16, raW = 200, raH = 44;
  const raCx = raX + raW / 2, raBottom = raY + raH, raMidY = raY + raH / 2, raLeft = raX, raRight = raX + raW;
  // PENGURUS (center, aligned to RA center)
  const pgW = 180, pgCx = raCx, pgX = pgCx - pgW / 2, pgY = 120;
  const pgH = HEADER + Math.max(pengurus.length, 1) * ROW, pgBottom = pgY + pgH, pgRight = pgX + pgW;
  const coordY = pgY + HEADER / 2;
  // PENGAWAS (left of PENGURUS)
  const pawW = 160, pawX = pgX - 240, pawY = pgY;
  const pawH = HEADER + Math.max(pengawas.length, 1) * ROW, pawRight = pawX + pawW;
  // DEWAN PENASEHAT (right of PENGURUS, small)
  const dwW = 96, dwH = 40, dwX = pgRight + 70, dwY = coordY - dwH / 2;
  // MANAGEMEN
  const mgW = 180, mgCx = pgCx, mgX = mgCx - mgW / 2, mgH = 50, mgY = pgBottom + 70, mgBottom = mgY + mgH;
  // ANGGOTA
  const agW = 180, agCx = pgCx, agX = agCx - agW / 2, agH = 44, agY = mgBottom + 70;
  const agMid = agY + agH / 2, agLeft = agX, agRight = agX + agW, agBottom = agY + agH;
  // Outer service/command loops
  const leftX = 60, rightX = 680;
  // Externals (far right)
  const exX = 720, dinasW = 170, dinasH = 56, dinasY = coordY - dinasH / 2;
  const pusW = 150, pusH = 56, pusY = dinasY + dinasH + 34;
  const dinasMid = dinasY + dinasH / 2, pusMid = pusY + pusH / 2;
  const H = agBottom + 40;
  const W = 920;
  const stroke = "#111111";

  return (
    <div className="overflow-x-auto">
      <div className="relative mx-auto" style={{ width: W, height: H, minWidth: W }}>
        <svg className="absolute inset-0 pointer-events-none" width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          <defs>
            <marker id="arr" markerWidth="9" markerHeight="9" refX="7" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill={stroke} />
            </marker>
            <marker id="arrStart" markerWidth="9" markerHeight="9" refX="1" refY="4" orient="auto">
              <path d="M8,0 L0,4 L8,8 Z" fill={stroke} />
            </marker>
          </defs>
          {/* Garis perintah (solid + arrow) */}
          <g stroke={stroke} strokeWidth={1.5} fill="none">
            <path d={`M${raCx},${raBottom} L${raCx},${pgY}`} markerEnd="url(#arr)" />
            <path d={`M${pgCx},${pgBottom} L${pgCx},${mgY}`} markerEnd="url(#arr)" />
            <path d={`M${mgCx},${mgBottom} L${mgCx},${agY}`} markerEnd="url(#arr)" />
            {/* externals branch off right spine */}
            <path d={`M${rightX},${dinasMid} L${exX},${dinasMid}`} markerEnd="url(#arr)" />
            <path d={`M${rightX},${pusMid} L${exX},${pusMid}`} markerEnd="url(#arr)" />
          </g>
          {/* Garis koordinasi (dashed) */}
          {/* PENGAWAS <-> PENGURUS double arrow */}
          <path d={`M${pawRight},${coordY} L${pgX},${coordY}`} stroke={stroke} strokeWidth={1.5} strokeDasharray="5 4" fill="none" markerStart="url(#arrStart)" markerEnd="url(#arr)" />
          {/* PENGURUS <-> DEWAN PENASEHAT double arrow */}
          <path d={`M${pgRight},${coordY} L${dwX},${coordY}`} stroke={stroke} strokeWidth={1.5} strokeDasharray="5 4" fill="none" markerStart="url(#arrStart)" markerEnd="url(#arr)" />
          {/* Garis pelayanan (solid) — LEFT outer loop: ANGGOTA -> RAPAT ANGGOTA (arrow into RA) */}
          <path d={`M${agLeft},${agMid} L${leftX},${agMid} L${leftX},${raMidY} L${raLeft},${raMidY}`} stroke={stroke} strokeWidth={1.5} fill="none" markerEnd="url(#arr)" />
          {/* RIGHT outer spine: ANGGOTA -> RAPAT ANGGOTA (arrow into RA) */}
          <g stroke={stroke} strokeWidth={1.5} fill="none">
            <path d={`M${agRight},${agMid} L${rightX},${agMid} L${rightX},${raMidY} L${raRight},${raMidY}`} markerEnd="url(#arr)" />
          </g>
        </svg>

        <ChartBox title={t.org_rapat_anggota || "RAPAT ANGGOTA"} left={raX} top={raY} width={raW} height={raH} />
        <ChartBox title="PENGAWAS" items={pengawas} left={pawX} top={pawY} width={pawW} height={pawH} />
        <ChartBox title="PENGURUS" items={pengurus} left={pgX} top={pgY} width={pgW} height={pgH} />
        <ChartBox title={dewan} left={dwX} top={dwY} width={dwW} height={dwH} />
        <ChartBox title={t.org_manajemen || "MANAGEMEN"} left={mgX} top={mgY} width={mgW} height={mgH} />
        <ChartBox title={t.org_anggota || "ANGGOTA"} left={agX} top={agY} width={agW} height={agH} />
        <ChartBox title={dinas} left={exX} top={dinasY} width={dinasW} height={dinasH} />
        <ChartBox title={puskopdit} left={exX} top={pusY} width={pusW} height={pusH} />
      </div>
    </div>
  );
}

function Legend() {
  const stroke = "#111111";
  const Row = ({ label, dashed, plain }: { label: string; dashed?: boolean; plain?: boolean }) => (
    <div className="flex items-center gap-4">
      <span className="w-40 text-sm font-medium">{label}</span>
      <svg width="80" height="14" viewBox="0 0 80 14">
        <defs>
          <marker id={`lg-${label}`} markerWidth="9" markerHeight="9" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill={stroke} />
          </marker>
          <marker id={`lgs-${label}`} markerWidth="9" markerHeight="9" refX="1" refY="4" orient="auto">
            <path d="M8,0 L0,4 L8,8 Z" fill={stroke} />
          </marker>
        </defs>
        <path d="M4,7 L72,7" stroke={stroke} strokeWidth={1.5} fill="none"
          strokeDasharray={dashed ? "5 4" : undefined}
          markerEnd={plain ? undefined : `url(#lg-${label})`}
          markerStart={dashed ? `url(#lgs-${label})` : undefined} />
      </svg>
    </div>
  );
  return (
    <div className="mt-8 border-t border-border pt-5">
      <p className="mb-3 font-bold">Keterangan</p>
      <div className="space-y-2">
        <Row label="Garis koordinasi" dashed />
        <Row label="Garis perintah" />
        <Row label="Garis pelayanan" plain />
      </div>
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
          <OrgChart t={t} />
          <Legend />
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