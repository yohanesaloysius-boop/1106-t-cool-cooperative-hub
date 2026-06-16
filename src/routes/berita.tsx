import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Newspaper } from "lucide-react";

export const Route = createFileRoute("/berita")({
  head: () => ({
    meta: [
      { title: "Berita & Kegiatan — T-COOL Koperasi" },
      {
        name: "description",
        content:
          "Kabar terbaru, agenda, dan dokumentasi kegiatan Koperasi T-COOL. Ikuti perkembangan koperasi Anda.",
      },
      { property: "og:title", content: "Berita & Kegiatan — T-COOL Koperasi" },
      {
        property: "og:description",
        content: "Kabar terbaru dan dokumentasi kegiatan Koperasi T-COOL.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: BeritaList,
});

type Berita = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_url: string | null;
  category: string;
  published_at: string | null;
};

function fmtDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function BeritaList() {
  const { data, isLoading } = useQuery({
    queryKey: ["public-berita"],
    queryFn: async (): Promise<Berita[]> => {
      const { data, error } = await supabase
        .from("berita")
        .select("id,title,slug,excerpt,cover_url,category,published_at")
        .eq("status", "published")
        .order("published_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Berita[];
    },
    staleTime: 30_000,
  });

  const items = data ?? [];

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container mx-auto px-4 pt-8 pb-20">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Newspaper className="h-3.5 w-3.5" /> Berita & Kegiatan
          </span>
          <h1 className="mt-4 text-3xl md:text-4xl font-bold tracking-tight text-[#372f2f]">
            Kabar & Kegiatan Koperasi
          </h1>
          <p className="mt-3 text-muted-foreground">
            Ikuti berita terbaru, agenda, dan dokumentasi kegiatan Koperasi T-COOL.
          </p>
        </div>

        {isLoading ? (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-72 animate-pulse rounded-3xl bg-muted" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="mt-16 rounded-3xl border border-dashed border-border p-12 text-center">
            <Newspaper className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 font-semibold">Belum ada berita</p>
            <p className="text-sm text-muted-foreground">
              Berita & kegiatan koperasi akan tampil di sini.
            </p>
          </div>
        ) : (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((b) => (
              <Link
                key={b.id}
                to="/berita/$slug"
                params={{ slug: b.slug }}
                className="group block overflow-hidden rounded-3xl border border-border bg-card transition-all hover:-translate-y-1 hover:border-primary/40"
                style={{ boxShadow: "var(--shadow-card)" }}
              >
                <div className="aspect-[16/10] overflow-hidden bg-muted">
                  {b.cover_url ? (
                    <img
                      src={b.cover_url}
                      alt={b.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-primary/30">
                      <Newspaper className="h-10 w-10" />
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] uppercase">
                      {b.category}
                    </Badge>
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <CalendarDays className="h-3 w-3" /> {fmtDate(b.published_at)}
                    </span>
                  </div>
                  <h3 className="mt-3 line-clamp-2 text-base font-semibold leading-snug">
                    {b.title}
                  </h3>
                  {b.excerpt && (
                    <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{b.excerpt}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}