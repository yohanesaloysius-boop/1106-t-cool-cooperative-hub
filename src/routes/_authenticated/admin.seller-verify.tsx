import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { listStoresByStatus, setStoreStatus } from "@/lib/escrow-api";
import { Check, X, Store as StoreIcon, ExternalLink, Loader2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/seller-verify")({
  component: SellerVerifyPage,
});

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  active: "bg-success/15 text-success",
  suspended: "bg-destructive/15 text-destructive",
  inactive: "bg-muted text-muted-foreground",
};

function SellerVerifyPage() {
  const [tab, setTab] = useState("pending");
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["mp-stores-status", tab],
    queryFn: () => listStoresByStatus(tab === "all" ? undefined : tab),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["mp-stores-status"] });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Verifikasi Seller</h1>
        <p className="text-sm text-muted-foreground">Aktifkan, tangguhkan, atau tinjau toko anggota sebelum bisa berjualan.</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pending">Menunggu</TabsTrigger>
          <TabsTrigger value="active">Aktif</TabsTrigger>
          <TabsTrigger value="suspended">Ditangguhkan</TabsTrigger>
          <TabsTrigger value="all">Semua</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4 space-y-3">
          {list.isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : (list.data ?? []).length === 0 ? (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Tidak ada toko di kategori ini.</CardContent></Card>
          ) : (
            list.data!.map((s: any) => <StoreRow key={s.id} store={s} onChanged={refresh} />)
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StoreRow({ store, onChanged }: { store: any; onChanged: () => void }) {
  const [openReject, setOpenReject] = useState(false);
  const [alasan, setAlasan] = useState("");
  const mut = useMutation({
    mutationFn: async (status: "active" | "suspended" | "pending") => setStoreStatus(store.id, status, alasan || undefined),
    onSuccess: () => { toast.success("Status toko diperbarui"); onChanged(); setOpenReject(false); setAlasan(""); },
    onError: (e: Error) => toast.error(e.message),
  });
  const owner = store.profiles;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted">
          {store.logo ? <img src={store.logo} alt="" className="h-full w-full object-cover" /> : <StoreIcon className="m-auto mt-4 h-6 w-6 text-muted-foreground" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{store.nama_toko}</p>
            <Badge className={`rounded-full ${STATUS_BADGE[store.status_toko] ?? "bg-muted"}`}>{store.status_toko}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Pemilik: <strong>{owner?.nama_lengkap ?? "-"}</strong> · {owner?.nomor_anggota ?? "—"} · {owner?.no_hp ?? "—"}
          </p>
          {store.deskripsi && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{store.deskripsi}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/marketplace/toko/$slug" params={{ slug: store.slug }}>
            <Button size="sm" variant="outline" className="rounded-full"><ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Lihat</Button>
          </Link>
          {store.status_toko !== "active" && (
            <Button size="sm" className="rounded-full bg-success text-success-foreground hover:bg-success/90" onClick={() => mut.mutate("active")} disabled={mut.isPending}>
              <Check className="mr-1.5 h-3.5 w-3.5" /> Aktifkan
            </Button>
          )}
          {store.status_toko !== "suspended" && (
            <Dialog open={openReject} onOpenChange={setOpenReject}>
              <Button size="sm" variant="destructive" className="rounded-full" onClick={() => setOpenReject(true)}>
                <X className="mr-1.5 h-3.5 w-3.5" /> Suspend
              </Button>
              <DialogContent>
                <DialogHeader><DialogTitle>Tangguhkan toko {store.nama_toko}?</DialogTitle></DialogHeader>
                <Textarea placeholder="Alasan penangguhan…" value={alasan} onChange={(e) => setAlasan(e.target.value)} />
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setOpenReject(false)}>Batal</Button>
                  <Button variant="destructive" onClick={() => mut.mutate("suspended")} disabled={mut.isPending}>Tangguhkan</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
