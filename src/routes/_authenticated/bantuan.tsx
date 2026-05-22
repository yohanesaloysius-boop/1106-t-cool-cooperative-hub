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
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Send, MessageSquare, Plus, Loader2, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/bantuan")({
  head: () => ({ meta: [{ title: "Pusat Bantuan — T-COOL" }] }),
  component: BantuanPage,
});

const statusLabel: Record<string, { label: string; cls: string }> = {
  open: { label: "Terbuka", cls: "bg-blue-100 text-blue-800" },
  in_progress: { label: "Diproses", cls: "bg-amber-100 text-amber-800" },
  resolved: { label: "Selesai", cls: "bg-green-100 text-green-800" },
  closed: { label: "Ditutup", cls: "bg-gray-100 text-gray-700" },
};

function BantuanPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [newTicket, setNewTicket] = useState({ subjek: "", kategori: "umum", prioritas: "medium", body: "" });
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: tickets } = useQuery({
    queryKey: ["my-tickets", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("user_id", user!.id)
        .order("last_message_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: messages } = useQuery({
    queryKey: ["my-ticket-msgs", selectedId],
    queryFn: async () => {
      if (!selectedId) return [];
      const { data } = await supabase
        .from("support_messages")
        .select("*")
        .eq("ticket_id", selectedId)
        .order("created_at");
      await supabase.from("support_tickets").update({ unread_for_user: false }).eq("id", selectedId);
      qc.invalidateQueries({ queryKey: ["my-tickets"] });
      return data ?? [];
    },
    enabled: !!selectedId,
  });

  useEffect(() => {
    if (!selectedId) return;
    const ch = supabase
      .channel(`my-ticket-${selectedId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages", filter: `ticket_id=eq.${selectedId}` }, () => {
        qc.invalidateQueries({ queryKey: ["my-ticket-msgs", selectedId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [selectedId, qc]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const createMut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Login diperlukan");
      if (!newTicket.subjek.trim() || !newTicket.body.trim()) throw new Error("Lengkapi subjek & pesan");
      const { data, error } = await supabase.from("support_tickets").insert({
        user_id: user.id,
        subjek: newTicket.subjek.trim(),
        kategori: newTicket.kategori as any,
        prioritas: newTicket.prioritas as any,
        status: "open",
      }).select().single();
      if (error) throw error;
      await supabase.from("support_messages").insert({
        ticket_id: data.id,
        sender_id: user.id,
        is_pengurus: false,
        body: newTicket.body.trim(),
      });
      return data.id as string;
    },
    onSuccess: (id) => {
      toast.success("Tiket dibuat");
      setOpen(false);
      setNewTicket({ subjek: "", kategori: "umum", prioritas: "medium", body: "" });
      setSelectedId(id);
      qc.invalidateQueries({ queryKey: ["my-tickets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendMut = useMutation({
    mutationFn: async () => {
      if (!selectedId || !reply.trim() || !user) return;
      const { error } = await supabase.from("support_messages").insert({
        ticket_id: selectedId,
        sender_id: user.id,
        is_pengurus: false,
        body: reply.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setReply("");
      qc.invalidateQueries({ queryKey: ["my-ticket-msgs", selectedId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const selected = tickets?.find((t) => t.id === selectedId);

  if (selectedId && selected) {
    return (
      <div className="space-y-3 max-w-3xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)}><ArrowLeft className="h-4 w-4" /> Kembali</Button>
        <Card style={{ boxShadow: "var(--shadow-card)" }} className="flex flex-col">
          <CardHeader className="border-b">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">{selected.subjek}</CardTitle>
                <div className="flex gap-1.5 mt-1.5">
                  <Badge variant="outline" className="text-[10px]">{selected.kategori}</Badge>
                  <Badge className={`text-[10px] ${statusLabel[selected.status]?.cls}`}>{statusLabel[selected.status]?.label}</Badge>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex flex-col">
            <ScrollArea className="h-[420px] p-4" ref={scrollRef as any}>
              <div className="space-y-3">
                {messages?.map((m) => (
                  <div key={m.id} className={`flex ${!m.is_pengurus ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${!m.is_pengurus ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                      {m.is_pengurus && <p className="text-[10px] opacity-70 mb-0.5 font-semibold">Pengurus</p>}
                      <p className="text-sm whitespace-pre-wrap">{m.body}</p>
                      <p className="text-[10px] opacity-70 mt-1">{new Date(m.created_at).toLocaleString("id-ID")}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            {selected.status !== "closed" && (
              <div className="border-t p-3 flex gap-2">
                <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Ketik pesan…" rows={2} />
                <Button onClick={() => sendMut.mutate()} disabled={sendMut.isPending || !reply.trim()}>
                  {sendMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><MessageSquare className="h-6 w-6 text-primary" /> Pusat Bantuan</h1>
          <p className="text-sm text-muted-foreground">Hubungi pengurus untuk pertanyaan, keluhan, atau bantuan teknis.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> Tiket Baru</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Buat Tiket Bantuan</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Subjek</Label>
                <Input value={newTicket.subjek} onChange={(e) => setNewTicket({ ...newTicket, subjek: e.target.value })} placeholder="Ringkasan masalah" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Kategori</Label>
                  <Select value={newTicket.kategori} onValueChange={(v) => setNewTicket({ ...newTicket, kategori: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="umum">Umum</SelectItem>
                      <SelectItem value="pinjaman">Pinjaman</SelectItem>
                      <SelectItem value="simpanan">Simpanan</SelectItem>
                      <SelectItem value="marketplace">Marketplace</SelectItem>
                      <SelectItem value="teknis">Teknis</SelectItem>
                      <SelectItem value="komplain">Komplain</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Prioritas</Label>
                  <Select value={newTicket.prioritas} onValueChange={(v) => setNewTicket({ ...newTicket, prioritas: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Rendah</SelectItem>
                      <SelectItem value="medium">Sedang</SelectItem>
                      <SelectItem value="high">Tinggi</SelectItem>
                      <SelectItem value="urgent">Mendesak</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Pesan</Label>
                <Textarea value={newTicket.body} onChange={(e) => setNewTicket({ ...newTicket, body: e.target.value })} rows={5} placeholder="Jelaskan masalah Anda…" />
              </div>
              <Button onClick={() => createMut.mutate()} disabled={createMut.isPending} className="w-full">
                {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Kirim Tiket"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card style={{ boxShadow: "var(--shadow-card)" }}>
        <CardContent className="p-0">
          {tickets?.length ? (
            <div className="divide-y">
              {tickets.map((t) => (
                <button key={t.id} onClick={() => setSelectedId(t.id)}
                  className="w-full text-left px-4 py-3 hover:bg-muted/50 transition flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{t.subjek}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Diperbarui {new Date(t.last_message_at).toLocaleString("id-ID")}</p>
                    <div className="flex gap-1.5 mt-1.5">
                      <Badge variant="outline" className="text-[10px]">{t.kategori}</Badge>
                      <Badge className={`text-[10px] ${statusLabel[t.status]?.cls}`}>{statusLabel[t.status]?.label}</Badge>
                    </div>
                  </div>
                  {t.unread_for_user && <span className="h-2 w-2 rounded-full bg-primary mt-2 shrink-0" />}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-sm text-muted-foreground">
              Belum ada tiket. Klik "Tiket Baru" untuk mulai.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
