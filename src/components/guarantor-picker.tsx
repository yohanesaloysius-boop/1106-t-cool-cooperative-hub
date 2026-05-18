import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, UserPlus, X, Shield, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";

const fmt = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

export type GuarantorSelection = {
  user_id: string;
  nama: string;
  nomor_anggota: string | null;
  no_hp: string | null;
  guarantee_amount: number;
  validation?: { ok: boolean; reasons: string[] };
};

interface Props {
  required: number;
  perGuarantorAmount: number;
  selected: GuarantorSelection[];
  onChange: (next: GuarantorSelection[]) => void;
}

export function GuarantorPicker({ required, perGuarantorAmount, selected, onChange }: Props) {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const search = useQuery({
    queryKey: ["guarantor-search", q],
    enabled: q.trim().length >= 2,
    queryFn: async () => {
      const term = `%${q.trim()}%`;
      const { data, error } = await supabase
        .from("profiles")
        .select("id,nama_lengkap,nomor_anggota,no_hp,status")
        .eq("status", "active")
        .neq("id", user!.id)
        .or(`nama_lengkap.ilike.${term},nomor_anggota.ilike.${term},no_hp.ilike.${term}`)
        .limit(8);
      if (error) throw error;
      return data ?? [];
    },
  });

  const validateMut = useMutation({
    mutationFn: async (g: { id: string; nama: string; nomor_anggota: string | null; no_hp: string | null }) => {
      const { data, error } = await supabase.rpc("validate_guarantor", {
        _guarantor_id: g.id,
        _amount: perGuarantorAmount,
      });
      if (error) throw error;
      return { g, result: data as { ok: boolean; reasons: string[] } };
    },
    onSuccess: ({ g, result }) => {
      if (!result.ok) {
        toast.error("Tidak memenuhi syarat", { description: result.reasons.join(", ") });
        return;
      }
      if (selected.some((s) => s.user_id === g.id)) return;
      onChange([
        ...selected,
        {
          user_id: g.id,
          nama: g.nama,
          nomor_anggota: g.nomor_anggota,
          no_hp: g.no_hp,
          guarantee_amount: perGuarantorAmount,
          validation: result,
        },
      ]);
      setOpen(false);
      setQ("");
    },
    onError: (e) => toast.error("Validasi gagal", { description: (e as Error).message }),
  });

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" /> Penjamin Pinjaman
          </p>
          <p className="text-xs text-muted-foreground">
            Wajib {required} penjamin. Setiap penjamin menanggung {fmt.format(perGuarantorAmount)}.
          </p>
        </div>
        <Badge variant={selected.length >= required ? "default" : "secondary"}>
          {selected.length}/{required}
        </Badge>
      </div>

      <div className="space-y-2">
        {selected.map((s) => (
          <div key={s.user_id} className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 p-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{s.nama}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {s.nomor_anggota ?? "—"} · {s.no_hp ?? "—"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono">{fmt.format(s.guarantee_amount)}</span>
              <Button size="icon" variant="ghost" onClick={() => onChange(selected.filter((x) => x.user_id !== s.user_id))}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {selected.length < required && (
        <>
          {!open ? (
            <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => setOpen(true)}>
              <UserPlus className="h-4 w-4" /> Tambah Penjamin
            </Button>
          ) : (
            <div className="space-y-2 rounded-lg border bg-background p-3">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  autoFocus
                  className="pl-8"
                  placeholder="Cari nama, nomor anggota, atau no HP..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
              <div className="max-h-56 overflow-y-auto space-y-1">
                {search.isFetching && (
                  <p className="py-2 text-center text-xs text-muted-foreground">
                    <Loader2 className="inline h-3 w-3 animate-spin mr-1" /> Mencari...
                  </p>
                )}
                {q.trim().length < 2 && (
                  <p className="py-2 text-center text-xs text-muted-foreground">Ketik minimal 2 karakter</p>
                )}
                {search.data?.length === 0 && q.trim().length >= 2 && !search.isFetching && (
                  <p className="py-2 text-center text-xs text-muted-foreground">Tidak ada anggota cocok</p>
                )}
                {search.data?.map((p) => {
                  const already = selected.some((s) => s.user_id === p.id);
                  return (
                    <button
                      key={p.id}
                      disabled={already || validateMut.isPending}
                      onClick={() =>
                        validateMut.mutate({
                          id: p.id,
                          nama: p.nama_lengkap,
                          nomor_anggota: p.nomor_anggota,
                          no_hp: p.no_hp,
                        })
                      }
                      className="w-full text-left rounded-md border p-2 hover:bg-muted/50 disabled:opacity-50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{p.nama_lengkap}</p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {p.nomor_anggota ?? "—"} · {p.no_hp ?? "—"}
                          </p>
                        </div>
                        {already ? (
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        ) : (
                          <UserPlus className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              <Button variant="ghost" size="sm" className="w-full" onClick={() => { setOpen(false); setQ(""); }}>
                Tutup
              </Button>
            </div>
          )}
        </>
      )}

      {selected.length < required && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          Pinjaman ini wajib memiliki {required} penjamin sebelum bisa diajukan.
        </div>
      )}
    </Card>
  );
}