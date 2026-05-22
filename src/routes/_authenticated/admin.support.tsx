import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Send, CheckCircle2, MessageSquare, Inbox, AlertCircle, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/support")({
  head: () => ({ meta: [{ title: "Bantuan Anggota — Admin" }] }),
  component: AdminSupportPage,
});

const statusLabel: Record<string, { label: string; cls: string }> = {
  open: { label: "Terbuka", cls: "bg-blue-100 text-blue-800" },
  in_progress: { label: "Diproses", cls: "bg-amber-100 text-amber-800" },
  resolved: { label: "Selesai", cls: "bg-green-100 text-green-800" },
  closed: { label: "Ditutup", cls: "bg-gray-100 text-gray-700" },
};

const priorityCls: Record<string, string> = {
  urgent: "bg-red-100 text-red-800",
  high: "bg-orange-100 text-orange-800",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-gray-100 text-gray-700",
};

function AdminSupportPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [filterStatus, setFilterStatus] = useState<string>("open");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: tickets } = useQuery({
    queryKey: ["admin-tickets", filterStatus],
    queryFn: async () => {
      let q = supabase
        .from("support_tickets")
        .select("*, profiles!support_tickets_user_id_fkey(nama_lengkap, nomor_anggota)")
        .order("last_message_at", { ascending: false })
        .limit(100);
      if (filterStatus !== "all") q = q.eq("status", filterStatus as any);
      const { data } = await q;
      return data ?? [];
    },
  });

  const { data: messages } = useQuery({
    queryKey: ["ticket-msgs", selectedId],
    queryFn: async () => {
      if (!selectedId) return [];
      const { data } = await supabase
        .from("support_messages")
        .select("*")
        .eq("ticket_id", selectedId)
        .order("created_at");
      // Mark as read for admin
      await supabase.from("support_tickets").update({ unread_for_admin: false }).eq("id", selectedId);
      qc.invalidateQueries({ queryKey: ["admin-tickets"] });
      return data ?? [];
    },
    enabled: !!selectedId,
  });

  useEffect(() => {
    if (!selectedId) return;
    const ch = supabase
      .channel(`admin-ticket-${selectedId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages", filter: `ticket_id=eq.${selectedId}` }, () => {
        qc.invalidateQueries({ queryKey: ["ticket-msgs", selectedId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [selectedId, qc]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendMut = useMutation({
    mutationFn: async () => {
      if (!selectedId || !reply.trim() || !user) return;
      const { error } = await supabase.from("support_messages").insert({
        ticket_id: selectedId,
        sender_id: user.id,
        is_pengurus: true,
        body: reply.trim(),
      });
      if (error) throw error;
      await supabase.from("support_tickets").update({
        status: "in_progress",
        assigned_to: user.id,
      }).eq("id", selectedId);
    },
    onSuccess: () => {
      setReply("");
      qc.invalidateQueries({ queryKey: ["ticket-msgs", selectedId] });
      qc.invalidateQueries({ queryKey: ["admin-tickets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const closeMut = useMutation({
    mutationFn: async (status: "resolved" | "closed") => {
      if (!selectedId) return;
      const upd: any = { status };
      if (status === "resolved") upd.resolved_at = new Date().toISOString();
      if (status === "closed") upd.closed_at = new Date().toISOString();
      const { error } = await supabase.from("support_tickets").update(upd).eq("id", selectedId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status tiket diperbarui");
      qc.invalidateQueries({ queryKey: ["admin-tickets"] });
    },
  });

  const selectedTicket = tickets?.find((t) => t.id === selectedId);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><MessageSquare className="h-6 w-6 text-primary" /> Pusat Bantuan Anggota</h1>
        <p className="text-sm text-muted-foreground">Balas pertanyaan & keluhan anggota dalam waktu cepat.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <Card style={{ boxShadow: "var(--shadow-card)" }}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><Inbox className="h-4 w-4" /> Inbox</CardTitle>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Terbuka</SelectItem>
                  <SelectItem value="in_progress">Diproses</SelectItem>
                  <SelectItem value="resolved">Selesai</SelectItem>
                  <SelectItem value="closed">Ditutup</SelectItem>
                  <SelectItem value="all">Semua</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[520px]">
              <div className="divide-y">
                {tickets?.length ? tickets.map((t: any) => (
                  <button key={t.id} onClick={() => setSelectedId(t.id)}
                    className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition ${selectedId === t.id ? "bg-muted" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{t.subjek}</p>
                        <p className="text-xs text-muted-foreground truncate">{t.profiles?.nama_lengkap} · {t.profiles?.nomor_anggota}</p>
                      </div>
                      {t.unread_for_admin && <span className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />}
                    </div>
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px]">{t.kategori}</Badge>
                      <Badge className={`text-[10px] ${priorityCls[t.prioritas]}`}>{t.prioritas}</Badge>
                      <Badge className={`text-[10px] ${statusLabel[t.status]?.cls}`}>{statusLabel[t.status]?.label}</Badge>
                    </div>
                  </button>
                )) : (
                  <p className="text-center text-sm text-muted-foreground py-12">Tidak ada tiket</p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card style={{ boxShadow: "var(--shadow-card)" }} className="flex flex-col">
          {selectedTicket ? (
            <>
              <CardHeader className="border-b">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{selectedTicket.subjek}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      {(selectedTicket as any).profiles?.nama_lengkap} · dibuka {new Date(selectedTicket.created_at).toLocaleString("id-ID")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => closeMut.mutate("resolved")}>
                      <CheckCircle2 className="h-4 w-4" /> Selesai
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => closeMut.mutate("closed")}>Tutup</Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 p-0 flex flex-col">
                <ScrollArea className="h-[420px] p-4" ref={scrollRef as any}>
                  <div className="space-y-3">
                    {messages?.map((m) => (
                      <div key={m.id} className={`flex ${m.is_pengurus ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${m.is_pengurus ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                          <p className="text-sm whitespace-pre-wrap">{m.body}</p>
                          <p className="text-[10px] opacity-70 mt-1">{new Date(m.created_at).toLocaleString("id-ID")}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <div className="border-t p-3 flex gap-2">
                  <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Ketik balasan…" rows={2}
                    onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) sendMut.mutate(); }} />
                  <Button onClick={() => sendMut.mutate()} disabled={sendMut.isPending || !reply.trim()}>
                    {sendMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </CardContent>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-12">
              <Inbox className="h-10 w-10 mb-2" />
              <p className="text-sm">Pilih tiket dari inbox untuk membalas</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
