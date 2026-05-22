import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { MessageCircle, Send, CheckCheck, XCircle, RefreshCw, Loader2 } from "lucide-react";
import { openWhatsApp } from "@/lib/whatsapp";

export const Route = createFileRoute("/_authenticated/admin/notifikasi-wa")({
  head: () => ({ meta: [{ title: "Notifikasi WhatsApp — Admin" }] }),
  component: WhatsAppQueuePage,
});

type Item = {
  id: string;
  template: string;
  target_address: string | null;
  target_user: string | null;
  payload: { nama?: string; pesan?: string } | null;
  status: "queued" | "sent" | "failed" | "skipped";
  created_at: string;
  sent_at: string | null;
  ref_table: string | null;
};

function WhatsAppQueuePage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<string>("queued");

  const { data: items, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["wa-queue", tab],
    queryFn: async () => {
      const { data } = await supabase
        .from("notification_log")
        .select("*")
        .eq("channel", "whatsapp")
        .eq("status", tab as Item["status"])
        .order("created_at", { ascending: false })
        .limit(200);
      return ((data as any[]) ?? []) as Item[];
    },
  });

  const counts = useQuery({
    queryKey: ["wa-counts"],
    queryFn: async () => {
      const stats: Record<string, number> = { queued: 0, sent: 0, failed: 0, skipped: 0 };
      for (const s of Object.keys(stats)) {
        const { count } = await supabase
          .from("notification_log")
          .select("id", { count: "exact", head: true })
          .eq("channel", "whatsapp")
          .eq("status", s);
        stats[s] = count ?? 0;
      }
      return stats;
    },
  });

  const markSent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notification_log")
        .update({ status: "sent", sent_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wa-queue"] });
      qc.invalidateQueries({ queryKey: ["wa-counts"] });
    },
  });

  const markSkipped = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notification_log")
        .update({ status: "skipped" } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wa-queue"] });
      qc.invalidateQueries({ queryKey: ["wa-counts"] });
    },
  });

  const sendOne = (item: Item) => {
    const phone = item.target_address;
    const pesan = item.payload?.pesan ?? "";
    if (!phone) {
      toast.error("Nomor WA kosong");
      return;
    }
    const ok = openWhatsApp(phone, pesan);
    if (!ok) {
      toast.error("Format nomor tidak valid");
      return;
    }
    markSent.mutate(item.id);
    toast.success("WhatsApp dibuka");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Antrian Notifikasi WhatsApp</h1>
          <p className="text-sm text-muted-foreground">
            Pesan reminder dari sistem cron. Klik kirim untuk buka WhatsApp dengan pesan otomatis ke anggota.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {(["queued", "sent", "failed", "skipped"] as const).map((s) => (
          <Card key={s} style={{ boxShadow: "var(--shadow-card)" }}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground capitalize">{s}</p>
              <p className="text-2xl font-bold mt-1">{counts.data?.[s] ?? 0}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="queued">Antrian</TabsTrigger>
          <TabsTrigger value="sent">Terkirim</TabsTrigger>
          <TabsTrigger value="skipped">Dilewati</TabsTrigger>
          <TabsTrigger value="failed">Gagal</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card style={{ boxShadow: "var(--shadow-card)" }}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-primary" /> Daftar Pesan
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : !items?.length ? (
            <p className="text-center text-sm text-muted-foreground py-10">Tidak ada pesan.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Penerima</TableHead>
                  <TableHead>Nomor</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Pesan</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell className="text-sm">{it.payload?.nama ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{it.target_address ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{it.template}</Badge></TableCell>
                    <TableCell className="max-w-md">
                      <p className="text-xs text-muted-foreground line-clamp-2">{it.payload?.pesan}</p>
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {new Date(it.created_at).toLocaleString("id-ID")}
                    </TableCell>
                    <TableCell className="text-right">
                      {tab === "queued" ? (
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" onClick={() => sendOne(it)} disabled={!it.target_address}>
                            <Send className="h-3.5 w-3.5" /> Kirim
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => markSkipped.mutate(it.id)}>
                            <XCircle className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : tab === "sent" ? (
                        <Badge variant="outline" className="text-green-700 border-green-300">
                          <CheckCheck className="h-3 w-3" /> {it.sent_at ? new Date(it.sent_at).toLocaleDateString("id-ID") : "—"}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">{it.status}</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
