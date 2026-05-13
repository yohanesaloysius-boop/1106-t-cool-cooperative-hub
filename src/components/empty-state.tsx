import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

export function EmptyState({ title, desc, action, icon: Icon = Inbox }: { title: string; desc?: string; action?: ReactNode; icon?: typeof Inbox }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border p-10 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-semibold">{title}</p>
      {desc ? <p className="mt-1 text-xs text-muted-foreground max-w-sm">{desc}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

const statusMap: Record<string, { label: string; cls: string }> = {
  pending: { label: "Menunggu", cls: "bg-warning/15 text-warning border-warning/30" },
  pending_sekretaris: { label: "Review Sekretaris", cls: "bg-warning/15 text-warning border-warning/30" },
  pending_bendahara: { label: "Review Bendahara", cls: "bg-warning/15 text-warning border-warning/30" },
  pending_ketua: { label: "Review Ketua", cls: "bg-warning/15 text-warning border-warning/30" },
  verified: { label: "Terverifikasi", cls: "bg-success/15 text-success border-success/30" },
  approved: { label: "Disetujui", cls: "bg-success/15 text-success border-success/30" },
  disbursed: { label: "Dicairkan", cls: "bg-primary/10 text-primary border-primary/30" },
  completed: { label: "Lunas", cls: "bg-success/15 text-success border-success/30" },
  rejected: { label: "Ditolak", cls: "bg-destructive/15 text-destructive border-destructive/30" },
  cancelled: { label: "Dibatalkan", cls: "bg-muted text-muted-foreground border-border" },
  draft: { label: "Draft", cls: "bg-muted text-muted-foreground border-border" },
  unpaid: { label: "Belum Bayar", cls: "bg-muted text-muted-foreground border-border" },
  paid: { label: "Lunas", cls: "bg-success/15 text-success border-success/30" },
  overdue: { label: "Lewat Jatuh Tempo", cls: "bg-destructive/15 text-destructive border-destructive/30" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = statusMap[status] ?? { label: status, cls: "bg-muted text-foreground border-border" };
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${s.cls}`}>{s.label}</span>;
}
