import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { fmtIDR, listMyFavorites, removeFavorite } from "@/lib/marketplace-api";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/favorit")({
  component: FavoritPage,
});

function FavoritPage() {
  const { user } = useAuth();
  const { data = [], isLoading, refetch } = useQuery({
    queryKey: ["mp-fav-page", user?.id],
    queryFn: () => (user ? listMyFavorites(user.id) : Promise.resolve([])),
    enabled: !!user,
  });

  const handleRemove = async (pid: string) => {
    if (!user) return;
    try {
      await removeFavorite(user.id, pid);
      toast.success("Dihapus dari favorit");
      refetch();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Produk Favorit</h1>
        <p className="text-sm text-muted-foreground">Produk yang Anda simpan untuk dibeli nanti.</p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Memuat…</p>
      ) : data.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card p-12 text-center">
          <Heart className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Belum ada favorit.</p>
          <Link to="/marketplace">
            <Button className="mt-4 rounded-full">Jelajahi Marketplace</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {data.map((f: any) => {
            const p = f.marketplace_products;
            if (!p) return null;
            const img = Array.isArray(p.gambar_produk) ? p.gambar_produk[0] : null;
            return (
              <div key={f.product_id} className="overflow-hidden rounded-2xl border border-border bg-card" style={{ boxShadow: "var(--shadow-card)" }}>
                <Link to="/marketplace/produk/$id" params={{ id: f.product_id }} className="block">
                  <div className="aspect-square bg-muted">
                    {img && <img src={img} alt={p.nama_produk} className="h-full w-full object-cover" />}
                  </div>
                </Link>
                <div className="p-3">
                  <p className="line-clamp-2 text-sm font-medium">{p.nama_produk}</p>
                  <p className="mt-1 text-base font-bold text-primary">{fmtIDR(Number(p.harga))}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 w-full rounded-full text-destructive"
                    onClick={() => handleRemove(f.product_id)}
                  >
                    <Heart className="mr-1.5 h-3.5 w-3.5 fill-destructive" /> Hapus
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
