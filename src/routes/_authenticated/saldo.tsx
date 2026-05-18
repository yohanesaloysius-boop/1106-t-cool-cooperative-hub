import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  fmtIDR, getMyWallet, listMyWalletTrx, listMyWithdrawals, requestWithdrawal,
} from "@/lib/escrow-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Wallet, Banknote, ArrowDownToLine, History as HistoryIcon, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/saldo")({
  component: SaldoPage,
});

const WD_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Menunggu", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  approved: { label: "Disetujui", cls: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  paid: { label: "Sudah Dicairkan", cls: "bg-success/15 text-success" },
  rejected: { label: "Ditolak", cls: "bg-destructive/15 text-destructive" },
};

function SaldoPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const uid = user?.id ?? "";

  const wQ = useQuery({ queryKey: ["wallet", uid], queryFn: () => getMyWallet(uid), enabled: !!uid });
  const trxQ = useQuery({ queryKey: ["wallet-trx", uid], queryFn: () => listMyWalletTrx(uid), enabled: !!uid });
  const wdQ = useQuery({ queryKey: ["my-withdrawals", uid], queryFn: () => listMyWithdrawals(uid), enabled: !!uid });

  const w = wQ.data;
  const saldo = Number(w?.saldo ?? 0);
  const escrow = Number(w?.saldo_escrow ?? 0);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["wallet"] });
    qc.invalidateQueries({ queryKey: ["wallet-trx"] });
    qc.invalidateQueries({ queryKey: ["my-withdrawals"] });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Saldo & Pencairan</h1>
        <p className="text-sm text-muted-foreground">
          Saldo hasil penjualan di Marketplace Koperasi. Cairkan kapan saja ke rekening Anda.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-border bg-gradient-to-br from-primary/10 to-primary/0 p-6" style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
              <Wallet className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Saldo Tersedia</p>
              <p className="text-2xl font-bold tabular-nums">{fmtIDR(saldo)}</p>
            </div>
          </div>
          <div className="mt-4">
            <WithdrawDialog saldo={saldo} onDone={refresh} />
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6" style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Dana Ditahan (Escrow)</p>
              <p className="text-2xl font-bold tabular-nums">{fmtIDR(escrow)}</p>
            </div>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Dana dari pesanan yang sudah dibayar tapi belum dikonfirmasi diterima oleh pembeli.
          </p>
        </div>
      </div>

      {/* Riwayat withdraw */}
      <div className="rounded-3xl border border-border bg-card p-5 md:p-6" style={{ boxShadow: "var(--shadow-card)" }}>
        <div className="mb-4 flex items-center gap-2">
          <ArrowDownToLine className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">Riwayat Pencairan</h2>
        </div>
        {wdQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Memuat…</p>
        ) : (wdQ.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada pengajuan pencairan.</p>
        ) : (
          <div className="space-y-2">
            {(wdQ.data ?? []).map((w) => {
              const s = WD_STATUS[w.status] ?? { label: w.status, cls: "bg-muted" };
              return (
                <div key={w.id} className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/60 p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{fmtIDR(Number(w.nominal))}</p>
                    <p className="text-xs text-muted-foreground">
                      {w.bank_nama} · {w.bank_no_rek} ({w.bank_atas_nama})
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(w.requested_at).toLocaleString("id-ID")}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge className={`rounded-full ${s.cls}`}>{s.label}</Badge>
                    {w.bukti_transfer_url && (
                      <a href={w.bukti_transfer_url} target="_blank" rel="noreferrer" className="text-[11px] text-primary underline">
                        Bukti
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Mutasi wallet */}
      <div className="rounded-3xl border border-border bg-card p-5 md:p-6" style={{ boxShadow: "var(--shadow-card)" }}>
        <div className="mb-4 flex items-center gap-2">
          <HistoryIcon className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">Mutasi Saldo</h2>
        </div>
        {trxQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Memuat…</p>
        ) : (trxQ.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada mutasi.</p>
        ) : (
          <div className="space-y-2">
            {(trxQ.data ?? []).map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/60 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{t.keterangan ?? t.jenis}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(t.created_at).toLocaleString("id-ID")} · {t.jenis}
                  </p>
                </div>
                <p className={`text-sm font-bold tabular-nums ${t.arah === "in" ? "text-success" : "text-destructive"}`}>
                  {t.arah === "in" ? "+" : "−"}
                  {fmtIDR(Number(t.nominal))}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function WithdrawDialog({ saldo, onDone }: { saldo: number; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [nominal, setNominal] = useState<number>(0);
  const [bank, setBank] = useState("");
  const [noRek, setNoRek] = useState("");
  const [atasNama, setAtasNama] = useState("");
  const [catatan, setCatatan] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (nominal <= 0) return toast.error("Nominal harus > 0");
    if (nominal > saldo) return toast.error("Nominal melebihi saldo");
    if (!bank || !noRek || !atasNama) return toast.error("Lengkapi data rekening");
    setBusy(true);
    try {
      await requestWithdrawal({
        nominal,
        bank_nama: bank,
        bank_no_rek: noRek,
        bank_atas_nama: atasNama,
        catatan: catatan || undefined,
      });
      toast.success("Pengajuan pencairan dikirim. Menunggu proses pengurus.");
      setOpen(false);
      setNominal(0); setCatatan("");
      onDone();
    } catch (e: any) {
      toast.error(e.message ?? "Gagal mengajukan");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full rounded-full" disabled={saldo <= 0}>
          <Banknote className="mr-2 h-4 w-4" />
          Ajukan Pencairan
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ajukan Pencairan Saldo</DialogTitle>
          <DialogDescription>
            Saldo tersedia: <strong>{fmtIDR(saldo)}</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nominal</Label>
            <Input type="number" value={nominal || ""} onChange={(e) => setNominal(Number(e.target.value))} placeholder="0" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nama Bank</Label>
              <Input value={bank} onChange={(e) => setBank(e.target.value)} placeholder="BCA / BRI / Mandiri" />
            </div>
            <div>
              <Label>No. Rekening</Label>
              <Input value={noRek} onChange={(e) => setNoRek(e.target.value)} placeholder="1234567890" />
            </div>
          </div>
          <div>
            <Label>Atas Nama</Label>
            <Input value={atasNama} onChange={(e) => setAtasNama(e.target.value)} placeholder="Sesuai buku tabungan" />
          </div>
          <div>
            <Label>Catatan (opsional)</Label>
            <Textarea value={catatan} onChange={(e) => setCatatan(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Batal</Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Mengirim…" : "Kirim Pengajuan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
