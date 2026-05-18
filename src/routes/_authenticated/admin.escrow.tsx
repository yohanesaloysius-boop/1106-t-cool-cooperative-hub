import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  fmtIDR, getKoperasiWallet, listAllWithdrawals, listPendingPayments,
  processWithdrawal, rejectWithdrawal, uploadBuktiFile, verifyPayment,
} from "@/lib/escrow-api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  CheckCircle2, XCircle, Banknote, Landmark, Receipt, ShieldCheck, Upload,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/escrow")({
  head: () => ({ meta: [{ title: "Escrow Marketplace — Admin T-COOL" }] }),
  component: AdminEscrowPage,
});

const WD_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Menunggu", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  approved: { label: "Disetujui", cls: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  paid: { label: "Dicairkan", cls: "bg-success/15 text-success" },
  rejected: { label: "Ditolak", cls: "bg-destructive/15 text-destructive" },
};

function AdminEscrowPage() {
  const { isPengurus } = useAuth();
  const qc = useQueryClient();

  const walletQ = useQuery({ queryKey: ["kop-wallet"], queryFn: getKoperasiWallet, enabled: isPengurus });
  const payQ = useQuery({ queryKey: ["pending-payments"], queryFn: listPendingPayments, enabled: isPengurus });
  const wdQ = useQuery({ queryKey: ["all-withdrawals"], queryFn: listAllWithdrawals, enabled: isPengurus });

  if (!isPengurus) {
    return (
      <div className="rounded-3xl border border-border bg-card p-12 text-center">
        <p className="text-sm">Akses ditolak. Halaman ini khusus pengurus.</p>
      </div>
    );
  }

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["kop-wallet"] });
    qc.invalidateQueries({ queryKey: ["pending-payments"] });
    qc.invalidateQueries({ queryKey: ["all-withdrawals"] });
  };

  const totalEscrow = (payQ.data ?? []).reduce((s: number, t: any) => s + Number(t.total ?? 0), 0);
  const pendingWD = (wdQ.data ?? []).filter((w: any) => w.status === "pending");
  const totalPendingWD = pendingWD.reduce((s: number, w: any) => s + Number(w.nominal ?? 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Escrow Marketplace</h1>
        <p className="text-sm text-muted-foreground">
          Verifikasi pembayaran masuk, kelola pencairan penjual, dan pantau saldo koperasi.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          icon={Landmark}
          tint="from-emerald-400 to-emerald-600"
          label="Saldo Koperasi (Fee)"
          value={fmtIDR(Number(walletQ.data?.saldo ?? 0))}
        />
        <StatCard
          icon={ShieldCheck}
          tint="from-amber-400 to-orange-600"
          label="Bukti Menunggu Verifikasi"
          value={(payQ.data ?? []).length.toString()}
          hint={`Total: ${fmtIDR(totalEscrow)}`}
        />
        <StatCard
          icon={Banknote}
          tint="from-sky-400 to-blue-600"
          label="Pencairan Menunggu"
          value={pendingWD.length.toString()}
          hint={`Total: ${fmtIDR(totalPendingWD)}`}
        />
      </div>

      <div className="rounded-3xl border border-border bg-card p-4 md:p-6" style={{ boxShadow: "var(--shadow-card)" }}>
        <Tabs defaultValue="payments">
          <TabsList className="rounded-full">
            <TabsTrigger value="payments" className="rounded-full">
              <Receipt className="mr-1.5 h-3.5 w-3.5" /> Verifikasi Pembayaran
            </TabsTrigger>
            <TabsTrigger value="withdraw" className="rounded-full">
              <Banknote className="mr-1.5 h-3.5 w-3.5" /> Pencairan Penjual
            </TabsTrigger>
          </TabsList>

          <TabsContent value="payments" className="mt-5">
            <PendingPayments rows={payQ.data ?? []} loading={payQ.isLoading} onChanged={refresh} />
          </TabsContent>
          <TabsContent value="withdraw" className="mt-5">
            <WithdrawalsTable rows={wdQ.data ?? []} loading={wdQ.isLoading} onChanged={refresh} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, tint, label, value, hint }: any) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center gap-3">
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-md ${tint}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold tabular-nums">{value}</p>
          {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
        </div>
      </div>
    </div>
  );
}

function PendingPayments({ rows, loading, onChanged }: { rows: any[]; loading: boolean; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);

  const handleVerify = async (id: string) => {
    setBusy(id);
    try {
      await verifyPayment(id);
      toast.success("Pembayaran diverifikasi. Dana masuk escrow.");
      onChanged();
    } catch (e: any) {
      toast.error(e.message ?? "Gagal verifikasi");
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Memuat…</p>;
  if (rows.length === 0)
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-10 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
        <p className="mt-3 text-sm">Tidak ada bukti pembayaran menunggu verifikasi.</p>
      </div>
    );

  return (
    <div className="space-y-2">
      {rows.map((t: any) => (
        <div key={t.id} className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-background/60 p-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">
              {t.marketplace_products?.nama_produk ?? "Produk"} ×{t.qty}
            </p>
            <p className="text-xs text-muted-foreground">
              {t.marketplace_stores?.nama_toko} ← {t.profiles?.nama_lengkap}
            </p>
            <p className="text-[11px] text-muted-foreground">
              #{t.id.slice(0, 8)} · {new Date(t.created_at).toLocaleString("id-ID")}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold tabular-nums text-primary">{fmtIDR(Number(t.total))}</p>
            {t.bukti_transfer_url && (
              <a href={t.bukti_transfer_url} target="_blank" rel="noreferrer" className="text-[11px] text-primary underline">
                Lihat bukti
              </a>
            )}
          </div>
          <Button size="sm" className="rounded-full" onClick={() => handleVerify(t.id)} disabled={busy === t.id}>
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Verifikasi
          </Button>
        </div>
      ))}
    </div>
  );
}

function WithdrawalsTable({ rows, loading, onChanged }: { rows: any[]; loading: boolean; onChanged: () => void }) {
  if (loading) return <p className="text-sm text-muted-foreground">Memuat…</p>;
  if (rows.length === 0)
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-10 text-center">
        <Banknote className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-3 text-sm">Belum ada pengajuan pencairan.</p>
      </div>
    );

  return (
    <div className="space-y-2">
      {rows.map((w) => (
        <WithdrawRow key={w.id} w={w} onChanged={onChanged} />
      ))}
    </div>
  );
}

function WithdrawRow({ w, onChanged }: { w: any; onChanged: () => void }) {
  const { user } = useAuth();
  const s = WD_STATUS[w.status] ?? { label: w.status, cls: "bg-muted" };
  const [busy, setBusy] = useState(false);
  const [openProc, setOpenProc] = useState(false);
  const [openReject, setOpenReject] = useState(false);
  const [alasan, setAlasan] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const doProcess = async (file: File) => {
    if (!user) return;
    setBusy(true);
    try {
      const url = await uploadBuktiFile(user.id, file);
      await processWithdrawal(w.id, url);
      toast.success("Pencairan diproses.");
      setOpenProc(false);
      onChanged();
    } catch (e: any) {
      toast.error(e.message ?? "Gagal proses");
    } finally {
      setBusy(false);
    }
  };

  const doReject = async () => {
    setBusy(true);
    try {
      await rejectWithdrawal(w.id, alasan);
      toast.success("Pencairan ditolak.");
      setOpenReject(false);
      setAlasan("");
      onChanged();
    } catch (e: any) {
      toast.error(e.message ?? "Gagal tolak");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-background/60 p-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">
          {w.profiles?.nama_lengkap ?? "Anggota"}{" "}
          <span className="text-xs text-muted-foreground">({w.profiles?.nomor_anggota ?? "-"})</span>
        </p>
        <p className="text-xs text-muted-foreground">
          {w.bank_nama} · {w.bank_no_rek} ({w.bank_atas_nama})
        </p>
        <p className="text-[11px] text-muted-foreground">
          {new Date(w.requested_at).toLocaleString("id-ID")}
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold tabular-nums">{fmtIDR(Number(w.nominal))}</p>
        <Badge className={`rounded-full ${s.cls}`}>{s.label}</Badge>
      </div>
      {(w.status === "pending" || w.status === "approved") && (
        <div className="flex gap-2">
          <Dialog open={openProc} onOpenChange={setOpenProc}>
            <DialogTrigger asChild>
              <Button size="sm" className="rounded-full">
                <Upload className="mr-1.5 h-3.5 w-3.5" /> Cairkan
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Proses Pencairan</DialogTitle>
                <DialogDescription>
                  Transfer <strong>{fmtIDR(Number(w.nominal))}</strong> ke {w.bank_nama} {w.bank_no_rek} ({w.bank_atas_nama}), lalu upload bukti.
                </DialogDescription>
              </DialogHeader>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) doProcess(f);
                }}
                className="block w-full rounded-lg border border-input bg-background p-2 text-sm"
              />
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpenProc(false)} disabled={busy}>Batal</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={openReject} onOpenChange={setOpenReject}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="rounded-full text-destructive">
                <XCircle className="mr-1.5 h-3.5 w-3.5" /> Tolak
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Tolak Pencairan</DialogTitle>
              </DialogHeader>
              <Input value={alasan} onChange={(e) => setAlasan(e.target.value)} placeholder="Alasan penolakan" />
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpenReject(false)} disabled={busy}>Batal</Button>
                <Button variant="destructive" onClick={doReject} disabled={busy || !alasan}>Tolak</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
      {w.bukti_transfer_url && (
        <a href={w.bukti_transfer_url} target="_blank" rel="noreferrer" className="text-[11px] text-primary underline">
          Bukti
        </a>
      )}
    </div>
  );
}
