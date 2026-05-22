import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Vote, CheckCircle2, Loader2, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/voting")({
  head: () => ({ meta: [{ title: "E-Voting RAT" }] }),
  component: VotingPage,
});

function VotingPage() {
  const qc = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ["auth-user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  const { data: votings, isLoading } = useQuery({
    queryKey: ["member-votings"],
    queryFn: async () => {
      const { data } = await supabase.from("rat_votings" as any).select("*").in("status", ["active", "closed"]).order("created_at", { ascending: false });
      return (data as any[]) ?? [];
    },
  });

  const { data: myVotes } = useQuery({
    queryKey: ["my-votes", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("rat_votes" as any).select("voting_id,pilihan").eq("user_id", user!.id);
      return (data as any[]) ?? [];
    },
  });

  const votedMap = new Map((myVotes ?? []).map((v: any) => [v.voting_id, v.pilihan]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Vote className="h-6 w-6 text-primary" /> E-Voting RAT</h1>
        <p className="text-sm text-muted-foreground">Berikan suara Anda pada keputusan rapat anggota tahunan.</p>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Memuat...</p> : (votings ?? []).length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Belum ada voting yang berlangsung.</CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {(votings ?? []).map((v: any) => (
            <VotingCard key={v.id} voting={v} alreadyVoted={votedMap.has(v.id)} myChoice={votedMap.get(v.id)} onVoted={() => qc.invalidateQueries({ queryKey: ["my-votes"] })} />
          ))}
        </div>
      )}
    </div>
  );
}

function VotingCard({ voting, alreadyVoted, myChoice, onVoted }: { voting: any; alreadyVoted: boolean; myChoice?: any; onVoted: () => void }) {
  const [picks, setPicks] = useState<string[]>([]);
  const isClosed = voting.status === "closed" || new Date(voting.selesai) < new Date();
  const opsi = voting.opsi as string[];

  const cast = useMutation({
    mutationFn: async () => {
      if (picks.length === 0) throw new Error("Pilih minimal 1 opsi");
      const { error } = await supabase.rpc("cast_rat_vote" as any, { _voting_id: voting.id, _pilihan: picks });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Suara Anda tercatat ✓"); onVoted(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{voting.judul}</CardTitle>
          <Badge variant={isClosed ? "secondary" : "default"}>{isClosed ? "Tutup" : "Aktif"}</Badge>
        </div>
        {voting.deskripsi && <p className="text-xs text-muted-foreground">{voting.deskripsi}</p>}
        <div className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" /> Berakhir {new Date(voting.selesai).toLocaleString("id-ID")}</div>
      </CardHeader>
      <CardContent className="space-y-3">
        {alreadyVoted ? (
          <div className="rounded-lg bg-primary/10 p-3 text-sm flex items-center gap-2 text-primary">
            <CheckCircle2 className="h-4 w-4" /> Anda sudah vote: <b>{Array.isArray(myChoice) ? myChoice.join(", ") : String(myChoice)}</b>
          </div>
        ) : isClosed ? (
          <p className="text-sm text-muted-foreground">Voting telah ditutup.</p>
        ) : voting.multi_select ? (
          <div className="space-y-2">
            {opsi.map((o) => (
              <label key={o} className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={picks.includes(o)} onCheckedChange={(c) => setPicks(c ? [...picks, o] : picks.filter((p) => p !== o))} />
                <span className="text-sm">{o}</span>
              </label>
            ))}
            <Button onClick={() => cast.mutate()} disabled={cast.isPending} className="w-full mt-2">
              {cast.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Kirim Suara
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <RadioGroup value={picks[0] ?? ""} onValueChange={(v) => setPicks([v])}>
              {opsi.map((o) => (
                <div key={o} className="flex items-center gap-2">
                  <RadioGroupItem value={o} id={`${voting.id}-${o}`} />
                  <Label htmlFor={`${voting.id}-${o}`} className="cursor-pointer">{o}</Label>
                </div>
              ))}
            </RadioGroup>
            <Button onClick={() => cast.mutate()} disabled={cast.isPending || picks.length === 0} className="w-full mt-2">
              {cast.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Kirim Suara
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
