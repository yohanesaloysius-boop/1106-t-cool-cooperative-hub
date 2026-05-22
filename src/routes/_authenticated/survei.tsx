import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ClipboardList, CheckCircle2, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/survei")({
  head: () => ({ meta: [{ title: "Survei Kepuasan Anggota" }] }),
  component: SurveiPage,
});

function SurveiPage() {
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: userData } = useQuery({
    queryKey: ["auth-user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  const { data: surveys, isLoading } = useQuery({
    queryKey: ["surveys-active"],
    queryFn: async () => {
      const { data } = await supabase.from("surveys" as any).select("*").eq("status", "active").order("created_at", { ascending: false });
      return (data as any[]) ?? [];
    },
  });

  const { data: myResponses } = useQuery({
    queryKey: ["my-survey-responses", userData?.id],
    enabled: !!userData?.id,
    queryFn: async () => {
      const { data } = await supabase.from("survey_responses" as any).select("survey_id").eq("user_id", userData!.id);
      return new Set((data as any[])?.map((r) => r.survey_id) ?? []);
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Survei Kepuasan Anggota</h1>
        <p className="text-sm text-muted-foreground">Suara Anda membantu kami meningkatkan layanan koperasi.</p>
      </div>

      {isLoading && <Card><CardContent className="p-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></CardContent></Card>}

      {!isLoading && (surveys?.length ?? 0) === 0 && (
        <Card><CardContent className="p-12 text-center text-muted-foreground">
          <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-40" />
          Belum ada survei aktif.
        </CardContent></Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {surveys?.map((s) => {
          const done = myResponses?.has(s.id);
          return (
            <Card key={s.id} style={{ boxShadow: "var(--shadow-card)" }}>
              <CardHeader>
                <CardTitle className="flex items-start justify-between gap-2 text-base">
                  <span>{s.judul}</span>
                  {done && <Badge variant="outline" className="text-green-700 border-green-300"><CheckCircle2 className="h-3 w-3" />Selesai</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{s.deskripsi}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {s.anonim && <Badge variant="secondary">Anonim</Badge>}
                  <span>Target: {s.target}</span>
                </div>
                <Button onClick={() => setOpenId(s.id)} disabled={done} className="w-full">
                  {done ? "Sudah diisi" : "Isi Survei"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {openId && (
        <SurveyDialog
          surveyId={openId}
          onClose={() => setOpenId(null)}
          onDone={() => {
            setOpenId(null);
            qc.invalidateQueries({ queryKey: ["my-survey-responses"] });
          }}
          userId={userData?.id}
        />
      )}
    </div>
  );
}

function SurveyDialog({ surveyId, onClose, onDone, userId }: { surveyId: string; onClose: () => void; onDone: () => void; userId?: string }) {
  const [answers, setAnswers] = useState<Record<string, any>>({});

  const { data: questions } = useQuery({
    queryKey: ["survey-questions", surveyId],
    queryFn: async () => {
      const { data } = await supabase.from("survey_questions" as any).select("*").eq("survey_id", surveyId).order("urutan");
      return (data as any[]) ?? [];
    },
  });

  const { data: survey } = useQuery({
    queryKey: ["survey-detail", surveyId],
    queryFn: async () => {
      const { data } = await supabase.from("surveys" as any).select("*").eq("id", surveyId).single();
      return data as any;
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      const missing = questions?.find((q) => q.wajib && !answers[q.id]);
      if (missing) throw new Error("Lengkapi pertanyaan wajib");
      const { error } = await supabase.from("survey_responses" as any).insert({
        survey_id: surveyId,
        user_id: survey?.anonim ? null : userId,
        jawaban: answers,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Terima kasih atas masukan Anda!");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{survey?.judul}</DialogTitle></DialogHeader>
        <div className="space-y-5">
          {questions?.map((q, idx) => (
            <div key={q.id} className="space-y-2">
              <Label className="font-medium">
                {idx + 1}. {q.pertanyaan} {q.wajib && <span className="text-red-500">*</span>}
              </Label>
              {q.tipe === "teks" && (
                <Textarea value={answers[q.id] ?? ""} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} />
              )}
              {q.tipe === "angka" && (
                <Input type="number" value={answers[q.id] ?? ""} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} />
              )}
              {q.tipe === "rating" && (
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Button key={n} type="button" variant={answers[q.id] === n ? "default" : "outline"} size="sm" onClick={() => setAnswers({ ...answers, [q.id]: n })}>
                      {n}
                    </Button>
                  ))}
                </div>
              )}
              {q.tipe === "pilihan" && Array.isArray(q.opsi) && (
                <RadioGroup value={answers[q.id] ?? ""} onValueChange={(v) => setAnswers({ ...answers, [q.id]: v })}>
                  {q.opsi.map((opt: string) => (
                    <div key={opt} className="flex items-center space-x-2">
                      <RadioGroupItem value={opt} id={`${q.id}-${opt}`} />
                      <Label htmlFor={`${q.id}-${opt}`} className="font-normal">{opt}</Label>
                    </div>
                  ))}
                </RadioGroup>
              )}
            </div>
          ))}
          <Button onClick={() => submit.mutate()} disabled={submit.isPending} className="w-full">
            {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Kirim Jawaban"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
