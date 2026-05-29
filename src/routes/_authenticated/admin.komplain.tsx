import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { listAllComplaints, listOpenComplaints, resolveComplaint } from "@/lib/escrow-api";
import { AlertTriangle, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/komplain")({
  component: KomplainPage,
});

const STATUS_BADGE: Record<string, string> = {
  open: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  resolved_refund: "bg-success/15 text-success",
  resolved_release: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  rejected: "bg-destructive/15 text-destructive",
};

function KomplainPage() {
  const [tab, setTab] = useState("open");
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["mp-complaints", tab],
    queryFn: () => (tab === "open" ? listOpenComplaints() : listAllComplaints()),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["mp-complaints"] });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Komplain & Refund</h1>
        <p className="text-sm text-muted-foreground">Tinjau komplain dari pembeli. Refund mengembalikan dana dari escrow penjual ke pembeli.</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="open">Terbuka</TabsTrigger>
          <TabsTrigger value="all">Semua</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4 space-y-3">
          {list.isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : (list.data ?? []).length === 0 ? (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Tidak ada komplain.</CardContent></Card>
          ) : (
            list.data!.map((c: any) => <ComplaintRow key={c.id} c={c} onChanged={refresh} />)
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ComplaintRow({ c, onChanged }: { c: any; onChanged: () => void }) {
  const [open, setOpen] = useState<null | "refund" | "reject">(null);
  const [catatan, setCatatan] = useState("");
  const mut = useMutation({
    mutationFn: (action: "refund" | "reject") => resolveComplaint(c.id, action, catatan),
    onSuccess: () => { toast.success("Komplain diselesaikan"); onChanged(); setOpen(null); setCatatan(""); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardContent className="space-y-2 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={`rounded-full ${STATUS_BADGE[c.status] ?? "bg-muted"}`}>
            <AlertTriangle className="mr-1 h-3 w-3" /> {c.status}
          </Badge>
          <span className="text-xs text-muted-foreground">
            Trx #{c.trx_id.slice(0, 8)} · {new Date(c.created_at).toLocaleString("id-ID")}
          </span>
        </div>
        <p className="text-sm"><strong>Alasan:</strong> {c.alasan}</p>
        {c.lampiran_url && (
          <a href={c.lampiran_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">Lihat lampiran</a>
        )}
        {c.resolusi && (
          <p className="text-xs text-muted-foreground">Resolusi: {c.resolusi}</p>
        )}
        {c.status === "open" && (
          <div className="flex gap-2 pt-2">
            <Button size="sm" className="rounded-full bg-success text-success-foreground hover:bg-success/90" onClick={() => setOpen("refund")}>
              <Check className="mr-1.5 h-3.5 w-3.5" /> Setujui Refund
            </Button>
            <Button size="sm" variant="destructive" className="rounded-full" onClick={() => setOpen("reject")}>
              <X className="mr-1.5 h-3.5 w-3.5" /> Tolak
            </Button>
          </div>
        )}

        <Dialog open={open !== null} onOpenChange={(v) => !v && setOpen(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{open === "refund" ? "Setujui refund?" : "Tolak komplain?"}</DialogTitle>
            </DialogHeader>
            <Textarea placeholder="Catatan untuk pembeli & penjual…" value={catatan} onChange={(e) => setCatatan(e.target.value)} />
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(null)}>Batal</Button>
              <Button
                variant={open === "refund" ? "default" : "destructive"}
                onClick={() => open && mut.mutate(open)}
                disabled={mut.isPending}
              >
                {open === "refund" ? "Refund Sekarang" : "Tolak"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
