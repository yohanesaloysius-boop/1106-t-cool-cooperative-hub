import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CalendarDays, Newspaper } from "lucide-react";

export const Route = createFileRoute("/berita/$slug")({
  head: () => ({
    meta: [{ title: "Berita — T-COOL Koperasi" }],
  }),
  component: BeritaDetail,
  notFoundComponent: () => (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container mx-auto px-4 py-24 text-center">
        <Newspaper className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-3 font-semibold">Berita tidak ditemukan</p>
        <Link to="/berita" className="mt-4 inline-block text-sm text-primary hover:underline">
          ← Kembali ke Berita
        </Link>
      </main>
      <SiteFooter />
    </div>
  ),
  errorComponent: () => (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container mx-auto px-4 py-24 text-center">
        <p className="font-semibold">Gagal memuat berita</p>
        <Link to="/berita" className="mt-4 inline-block text-sm text-primary hover:underline">
          ← Kembali ke Berita
        </Link>
      </main>
      <SiteFooter />
    </div>
  ),
});

function fmtDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function BeritaDetail() {
  const { slug } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["public-berita", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("berita")
        .select("id,title,excerpt,content,cover_url,category,published_at,status")
        .eq("slug", slug)
        .eq("status", "published")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw notFound();
      return data;
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container mx-auto px-4 pt-8 pb-20">
        <Link
          to="/berita"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Semua Berita
        </Link>

        {isLoading || !data ? (
          <div className="mt-6 max-w-3xl">
            <div className="h-8 w-3/4 animate-pulse rounded bg-muted" />
            <div className="mt-6 aspect-[16/9] animate-pulse rounded-3xl bg-muted" />
          </div>
        ) : (
          <article className="mt-6 max-w-3xl">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px] uppercase">
                {data.category}
              </Badge>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarDays className="h-3 w-3" /> {fmtDate(data.published_at)}
              </span>
            </div>
            <h1 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight text-[#372f2f]">
              {data.title}
            </h1>
            {data.cover_url && (
              <div className="mt-6 overflow-hidden rounded-3xl border border-border">
                <img src={data.cover_url} alt={data.title} className="w-full object-cover" />
              </div>
            )}
            <div className="prose prose-neutral mt-8 max-w-none whitespace-pre-wrap text-[15px] leading-relaxed text-foreground/90">
              {data.content}
            </div>
          </article>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}