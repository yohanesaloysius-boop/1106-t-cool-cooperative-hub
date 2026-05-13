import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SignaturePadDialog, type SignatureResult } from "@/components/signature-pad";
import { FileUpload } from "@/components/file-upload";
import { toast } from "sonner";
import { CalendarPlus, Calendar as CalendarIcon, MapPin, Video, FileSignature, CheckCircle2, XCircle, Clock, Users, FilePlus2, ShieldCheck, Loader2, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/rapat")({
  head: () => ({ meta: [{ title: "Rapat Digital — T-COOL" }] }),
  component: RapatPage,
});

type Meeting = {
  id: string;
  judul: string;
  agenda: string | null;
  lokasi: string | null;
  link_online: string | null;
  mulai: string;
  selesai: string | null;
  status: "scheduled" | "ongoing" | "completed" | "cancelled";
  created_by: string | null;
  created_at: string;
};

type Attendance = {
  id: string;
  meeting_id: string;
  user_id: string;
  status: string;
  signed_at: string | null;
  signature_id: string | null;
  catatan: string | null;
};

type Note = {
  id: string;
  meeting_id: string;
  isi: string;
  keputusan: string | null;
  attachment_url: string | null;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  signature_id: string | null;
  notulis_id: string | null;
  created_at: string;
};

function statusBadge(s: Meeting["status"]) {
  if (s === "scheduled") return <Badge variant="outline" className="border-warning/30 bg-warning/15 text-warning"><Clock className="mr-1 h-3 w-3" />Terjadwal</Badge>;
  if (s === "ongoing") return <Badge className="bg-primary text-primary-foreground"><Video className="mr-1 h-3 w-3" />Berlangsung</Badge>;
  if (s === "completed") return <Badge className="bg-success text-success-foreground"><CheckCircle2 className="mr-1 h-3 w-3" />Selesai</Badge>;
  return <Badge variant="outline" className="text-muted-foreground"><XCircle className="mr-1 h-3 w-3" />Batal</Badge>;
}

function RapatPage() {
  const { user, roles } = useAuth();
  const qc = useQueryClient();
  const isPengurus = roles.some((r) => ["super_admin", "ketua", "sekretaris", "bendahara"].includes(r));
  const isKetua = roles.includes("ketua") || roles.includes("super_admin");

  const { data: meetings = [], isLoading } = useQuery({
    queryKey: ["meetings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("meetings").select("*").is("deleted_at", null).order("mulai", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Meeting[];
    },
  });

  useEffect(() => {
    const ch = supabase.channel("meetings-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "meetings" }, () => qc.invalidateQueries({ queryKey: ["meetings"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "meeting_attendances" }, () => qc.invalidateQueries())
      .on("postgres_changes", { event: "*", schema: "public", table: "meeting_notes" }, () => qc.invalidateQueries())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const upcoming = useMemo(() => meetings.filter((m) => m.status === "scheduled" || m.status === "ongoing"), [meetings]);
  const past = useMemo(() => meetings.filter((m) => m.status === "completed" || m.status === "cancelled"), [meetings]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rapat Digital</h1>
          <p className="text-sm text-muted-foreground">Jadwal, notulen, dan tanda tangan digital peserta rapat.</p>
        </div>
        {isPengurus && <NewMeetingDialog userId={user!.id} onCreated={() => qc.invalidateQueries({ queryKey: ["meetings"] })} />}
      </div>

      <Tabs defaultValue="upcoming">
        <TabsList>
          <TabsTrigger value="upcoming"><CalendarIcon className="mr-1 h-4 w-4" />Mendatang ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="past"><ShieldCheck className="mr-1 h-4 w-4" />Selesai ({past.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming" className="space-y-3">
          {isLoading ? <Loading /> : upcoming.length === 0 ? <Empty text="Belum ada rapat terjadwal." /> :
            upcoming.map((m) => <MeetingCard key={m.id} meeting={m} userId={user!.id} isPengurus={isPengurus} isKetua={isKetua} />)}
        </TabsContent>
        <TabsContent value="past" className="space-y-3">
          {isLoading ? <Loading /> : past.length === 0 ? <Empty text="Belum ada rapat selesai." /> :
            past.map((m) => <MeetingCard key={m.id} meeting={m} userId={user!.id} isPengurus={isPengurus} isKetua={isKetua} />)}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Loading() { return <Card><CardContent className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></CardContent></Card>; }
function Empty({ text }: { text: string }) { return <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">{text}</CardContent></Card>; }

function MeetingCard({ meeting, userId, isPengurus, isKetua }: { meeting: Meeting; userId: string; isPengurus: boolean; isKetua: boolean }) {
  const qc = useQueryClient();

  const { data: attendances = [] } = useQuery({
    queryKey: ["att", meeting.id],
    queryFn: async () => {
      const { data } = await supabase.from("meeting_attendances").select("*").eq("meeting_id", meeting.id);
      return (data ?? []) as Attendance[];
    },
  });

  const { data: notes = [] } = useQuery({
    queryKey: ["notes", meeting.id],
    queryFn: async () => {
      const { data } = await supabase.from("meeting_notes").select("*").eq("meeting_id", meeting.id).order("created_at", { ascending: false });
      return (data ?? []) as Note[];
    },
  });

  const myAtt = attendances.find((a) => a.user_id === userId);
  const confirmed = attendances.filter((a) => a.status === "confirmed" || a.status === "attended").length;
  const signed = attendances.filter((a) => !!a.signed_at).length;
  const note = notes[0];

  const respond = async (status: "confirmed" | "declined") => {
    const payload = { meeting_id: meeting.id, user_id: userId, status };
    const { error } = await supabase.from("meeting_attendances").upsert(payload, { onConflict: "meeting_id,user_id" });
    if (error) toast.error(error.message); else { toast.success("Status kehadiran tersimpan."); qc.invalidateQueries({ queryKey: ["att", meeting.id] }); }
  };

  const signAttendance = async (sig: SignatureResult) => {
    try {
      const { data: s, error: se } = await supabase.from("signatures").insert({
        user_id: userId, signature_url: sig.dataUrl, hash: sig.hash, ref_table: "meeting_attendances", ref_id: meeting.id,
      }).select("id").single();
      if (se) throw se;
      const { error } = await supabase.from("meeting_attendances").upsert({
        meeting_id: meeting.id, user_id: userId, status: "attended", signed_at: new Date().toISOString(), signature_id: s.id,
      }, { onConflict: "meeting_id,user_id" });
      if (error) throw error;
      await supabase.from("audit_logs").insert({ actor_id: userId, action: "meeting.signed", entity: "meetings", entity_id: meeting.id });
      toast.success("Tanda tangan kehadiran tersimpan.");
      qc.invalidateQueries({ queryKey: ["att", meeting.id] });
    } catch (e) { toast.error((e as Error).message); }
  };

  const setStatus = async (status: Meeting["status"]) => {
    const { error } = await supabase.from("meetings").update({ status }).eq("id", meeting.id);
    if (error) toast.error(error.message); else { toast.success("Status rapat diperbarui."); qc.invalidateQueries({ queryKey: ["meetings"] }); }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">{meeting.judul}</CardTitle>
              {statusBadge(meeting.status)}
            </div>
            <p className="text-xs text-muted-foreground">{new Date(meeting.mulai).toLocaleString("id-ID")}{meeting.selesai ? ` — ${new Date(meeting.selesai).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}` : ""}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {meeting.lokasi && <Badge variant="outline" className="text-xs"><MapPin className="mr-1 h-3 w-3" />{meeting.lokasi}</Badge>}
            {meeting.link_online && <a href={meeting.link_online} target="_blank" rel="noopener noreferrer"><Badge variant="outline" className="text-xs hover:bg-muted"><Video className="mr-1 h-3 w-3" />Online <ExternalLink className="ml-1 h-3 w-3" /></Badge></a>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {meeting.agenda && <p className="text-sm text-muted-foreground">{meeting.agenda}</p>}

        <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/30 p-3 text-center text-xs">
          <div><p className="text-muted-foreground">Hadir Konfirmasi</p><p className="text-lg font-bold">{confirmed}</p></div>
          <div><p className="text-muted-foreground">Sudah TTD</p><p className="text-lg font-bold">{signed}</p></div>
          <div><p className="text-muted-foreground">Notulen</p><p className="text-lg font-bold">{notes.length}</p></div>
        </div>

        {/* My response */}
        <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">Status saya:</span>
          {myAtt ? (
            <Badge variant="outline" className="capitalize">{myAtt.status}{myAtt.signed_at ? " ✓ TTD" : ""}</Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">Belum respon</Badge>
          )}
          <div className="ml-auto flex gap-2">
            {meeting.status !== "completed" && meeting.status !== "cancelled" && (
              <>
                <Button size="sm" variant="outline" onClick={() => respond("confirmed")}>Hadir</Button>
                <Button size="sm" variant="outline" onClick={() => respond("declined")}>Tidak Hadir</Button>
                <SignaturePadDialog
                  title="Tanda Tangan Kehadiran"
                  onSign={signAttendance}
                  trigger={<Button size="sm"><FileSignature className="mr-1 h-3 w-3" />TTD</Button>}
                />
              </>
            )}
          </div>
        </div>

        {/* Notulen */}
        {note ? (
          <div className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Notulen Rapat</div>
              <NoteStatusBadge status={note.status} />
            </div>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{note.isi}</p>
            {note.keputusan && <p className="rounded bg-primary/5 p-2 text-xs"><strong>Keputusan:</strong> {note.keputusan}</p>}
            {note.attachment_url && <a href={note.attachment_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">📎 Lampiran notulen</a>}
            {note.approved_at && <p className="text-[11px] text-success">✓ Disetujui {new Date(note.approved_at).toLocaleString("id-ID")}</p>}
            {isKetua && note.status === "pending" && (
              <div className="flex gap-2 border-t pt-2">
                <SignaturePadDialog
                  title="Tanda Tangan Approve Notulen"
                  onSign={async (sig) => {
                    try {
                      const { data: s, error: se } = await supabase.from("signatures").insert({
                        user_id: userId, signature_url: sig.dataUrl, hash: sig.hash, ref_table: "meeting_notes", ref_id: note.id,
                      }).select("id").single();
                      if (se) throw se;
                      const { error } = await supabase.from("meeting_notes").update({ status: "approved", approved_by: userId, approved_at: new Date().toISOString(), signature_id: s.id }).eq("id", note.id);
                      if (error) throw error;
                      await supabase.from("meetings").update({ status: "completed" }).eq("id", meeting.id);
                      await supabase.from("audit_logs").insert({ actor_id: userId, action: "notulen.approved", entity: "meeting_notes", entity_id: note.id });
                      toast.success("Notulen disetujui & rapat ditandai selesai.");
                      qc.invalidateQueries();
                    } catch (e) { toast.error((e as Error).message); }
                  }}
                  trigger={<Button size="sm"><CheckCircle2 className="mr-1 h-3 w-3" />Approve & TTD</Button>}
                />
                <Button size="sm" variant="outline" onClick={async () => {
                  await supabase.from("meeting_notes").update({ status: "rejected" }).eq("id", note.id);
                  toast.success("Notulen ditolak.");
                  qc.invalidateQueries();
                }}><XCircle className="mr-1 h-3 w-3" />Reject</Button>
              </div>
            )}
          </div>
        ) : (
          isPengurus && <UploadNotulenDialog meetingId={meeting.id} userId={userId} />
        )}

        {isPengurus && meeting.status === "scheduled" && (
          <div className="flex flex-wrap gap-2 border-t pt-3">
            <Button size="sm" variant="outline" onClick={() => setStatus("ongoing")}>Mulai Rapat</Button>
            <Button size="sm" variant="ghost" onClick={() => setStatus("cancelled")}>Batalkan</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NoteStatusBadge({ status }: { status: string }) {
  if (status === "approved") return <Badge className="bg-success text-success-foreground"><CheckCircle2 className="mr-1 h-3 w-3" />Approved</Badge>;
  if (status === "rejected") return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />Rejected</Badge>;
  if (status === "pending") return <Badge className="bg-warning text-warning-foreground"><Clock className="mr-1 h-3 w-3" />Pending</Badge>;
  return <Badge variant="outline">Draft</Badge>;
}

function NewMeetingDialog({ userId, onCreated }: { userId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [judul, setJudul] = useState("");
  const [agenda, setAgenda] = useState("");
  const [lokasi, setLokasi] = useState("");
  const [link, setLink] = useState("");
  const [mulai, setMulai] = useState("");
  const [selesai, setSelesai] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!judul.trim() || !mulai) { toast.error("Judul dan waktu mulai wajib diisi."); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.from("meetings").insert({
        judul: judul.trim(), agenda: agenda.trim() || null, lokasi: lokasi.trim() || null, link_online: link.trim() || null,
        mulai: new Date(mulai).toISOString(), selesai: selesai ? new Date(selesai).toISOString() : null,
        status: "scheduled", created_by: userId,
      }).select("id").single();
      if (error) throw error;
      await supabase.from("audit_logs").insert({ actor_id: userId, action: "meeting.created", entity: "meetings", entity_id: data.id });
      toast.success("Rapat berhasil dijadwalkan.");
      setOpen(false);
      setJudul(""); setAgenda(""); setLokasi(""); setLink(""); setMulai(""); setSelesai("");
      onCreated();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><CalendarPlus className="mr-1 h-4 w-4" />Jadwalkan Rapat</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Jadwalkan Rapat Baru</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Judul Rapat</Label><Input value={judul} onChange={(e) => setJudul(e.target.value)} placeholder="Rapat Bulanan Pengurus" /></div>
          <div><Label>Agenda</Label><Textarea value={agenda} onChange={(e) => setAgenda(e.target.value)} rows={3} placeholder="Pembahasan laporan keuangan & evaluasi pinjaman" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Mulai</Label><Input type="datetime-local" value={mulai} onChange={(e) => setMulai(e.target.value)} /></div>
            <div><Label>Selesai</Label><Input type="datetime-local" value={selesai} onChange={(e) => setSelesai(e.target.value)} /></div>
          </div>
          <div><Label>Lokasi</Label><Input value={lokasi} onChange={(e) => setLokasi(e.target.value)} placeholder="Ruang Rapat Koperasi" /></div>
          <div><Label>Link Online (opsional)</Label><Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://meet.google.com/..." /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Batal</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Menyimpan..." : "Simpan"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UploadNotulenDialog({ meetingId, userId }: { meetingId: string; userId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [isi, setIsi] = useState("");
  const [keputusan, setKeputusan] = useState("");
  const [attachment, setAttachment] = useState<string | null>(null);
  const [submitStatus, setSubmitStatus] = useState<"draft" | "pending">("pending");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!isi.trim()) { toast.error("Isi notulen wajib diisi."); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.from("meeting_notes").insert({
        meeting_id: meetingId, isi: isi.trim(), keputusan: keputusan.trim() || null,
        attachment_url: attachment, notulis_id: userId, status: submitStatus, created_by: userId,
      }).select("id").single();
      if (error) throw error;
      await supabase.from("audit_logs").insert({ actor_id: userId, action: `notulen.${submitStatus === "pending" ? "submitted" : "drafted"}`, entity: "meeting_notes", entity_id: data.id });
      toast.success(submitStatus === "pending" ? "Notulen dikirim untuk approval Ketua." : "Notulen disimpan sebagai draft.");
      setOpen(false);
      setIsi(""); setKeputusan(""); setAttachment(null);
      qc.invalidateQueries({ queryKey: ["notes", meetingId] });
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" size="sm" className="w-full"><FilePlus2 className="mr-1 h-4 w-4" />Upload Notulen</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Upload Notulen Rapat</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Isi Notulen</Label><Textarea value={isi} onChange={(e) => setIsi(e.target.value)} rows={6} placeholder="Pembahasan dan poin-poin rapat..." /></div>
          <div><Label>Keputusan / Resolusi</Label><Textarea value={keputusan} onChange={(e) => setKeputusan(e.target.value)} rows={2} placeholder="Keputusan yang diambil dalam rapat" /></div>
          <div>
            <Label>Lampiran (opsional)</Label>
            <FileUpload bucket="ktp" folder={`notulen/${meetingId}`} accept="application/pdf,image/*" onUploaded={(url) => setAttachment(url)} />
            {attachment && <p className="mt-1 text-xs text-success">✓ File terunggah</p>}
          </div>
          <div>
            <Label>Status Pengiriman</Label>
            <Select value={submitStatus} onValueChange={(v) => setSubmitStatus(v as "draft" | "pending")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Simpan sebagai Draft</SelectItem>
                <SelectItem value="pending">Kirim untuk Approval Ketua</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Batal</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Mengunggah..." : "Simpan"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}