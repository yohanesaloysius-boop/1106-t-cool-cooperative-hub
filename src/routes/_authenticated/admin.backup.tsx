import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldAlert, Download, DatabaseBackup, FileJson, FileSpreadsheet, FileCode2 } from "lucide-react";
import { toast } from "sonner";
import JSZip from "jszip";
import * as XLSX from "xlsx";
import { exportBackup, BACKUP_TABLES } from "@/lib/backup.functions";

// Snapshot source code at build time — only loaded on this admin page (route-level chunk).
const SOURCE_FILES = import.meta.glob(
  [
    "/src/**/*.{ts,tsx,js,jsx,css,json,md,html}",
    "/supabase/**/*.{sql,toml,md}",
    "/scripts/**/*.{ts,js,md}",
    "/public/**/*.{json,xml,txt,md,html}",
    "/package.json",
    "/tsconfig.json",
    "/vite.config.ts",
    "/components.json",
    "/wrangler.jsonc",
    "/README.md",
  ],
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

export const Route = createFileRoute("/_authenticated/admin/backup")({
  head: () => ({ meta: [{ title: "Backup Data — Super Admin" }] }),
  component: AdminBackup,
});

const GROUPS: { label: string; tables: string[] }[] = [
  { label: "Anggota & Akses", tables: ["profiles", "user_roles", "member_cards", "permissions", "role_permissions"] },
  { label: "Keuangan Inti", tables: ["simpanan", "pinjaman", "angsuran", "shu", "shu_rewards", "wallets", "wallet_transactions", "transaksi", "tabungan_berjangka", "reserve_funds", "reserve_fund_movements"] },
  { label: "Pinjaman & Penagihan", tables: ["loan_agreements", "loan_guarantors", "loan_verifications", "loan_restructures", "collection_cases", "collection_logs"] },
  { label: "Approval & Audit", tables: ["approvals", "approval_histories", "audit_logs"] },
  { label: "Marketplace", tables: ["marketplace_stores", "marketplace_products", "marketplace_transactions", "marketplace_complaints", "marketplace_coupons", "marketplace_favorites", "marketplace_reviews", "marketplace_withdrawals"] },
  { label: "Dokumen & Komunikasi", tables: ["documents", "official_letters", "signatures", "notifications", "notification_log", "pengumuman", "pending_iuran", "support_tickets", "support_messages"] },
  { label: "RAT & Voting", tables: ["meetings", "meeting_notes", "meeting_attendances", "surveys", "survey_questions", "survey_responses", "rat_votings", "rat_votes"] },
  { label: "Operasional", tables: ["assets", "asset_depreciations", "opex_categories", "opex_expenses", "budget_plans", "budget_items", "bank_mutations", "qris_payments", "lowongan_kerja", "settings"] },
  { label: "Pengadaan Gereja", tables: ["church_divisions", "church_requesters", "church_vendors", "church_purchase_requests", "church_pr_items", "church_purchase_orders", "church_pr_payments", "church_pr_receipts", "church_pr_audit"] },
  { label: "Pengadaan Sekolah", tables: ["school_divisions", "school_requesters", "school_vendors", "school_purchase_requests", "school_pr_items", "school_purchase_orders", "school_pr_payments", "school_pr_receipts", "school_pr_audit"] },
];

function toCsv(rows: any[]): string {
  if (!rows.length) return "";
  const cols = Array.from(rows.reduce((s, r) => { Object.keys(r ?? {}).forEach((k) => s.add(k)); return s; }, new Set<string>())) as string[];
  const esc = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

function AdminBackup() {
  const { roles, loading } = useAuth();
  const isSA = roles.includes("super_admin");
  const runExport = useServerFn(exportBackup);
  const [selected, setSelected] = useState<Set<string>>(new Set(BACKUP_TABLES));
  const [busy, setBusy] = useState<"csv" | "json" | "xlsx" | "files" | null>(null);

  const toggle = (t: string) => setSelected((s) => { const n = new Set(s); n.has(t) ? n.delete(t) : n.add(t); return n; });
  const toggleGroup = (tables: string[]) => setSelected((s) => {
    const n = new Set(s); const allIn = tables.every((t) => n.has(t));
    tables.forEach((t) => allIn ? n.delete(t) : n.add(t));
    return n;
  });
  const selectAll = () => setSelected(new Set(BACKUP_TABLES));
  const clearAll = () => setSelected(new Set());

  const fetchData = async () => {
    const tables = Array.from(selected);
    if (!tables.length) { toast.error("Pilih minimal satu tabel."); return null; }
    const res = await runExport({ data: { tables: tables as any } });
    const failed = res.tables.filter((t) => t.error);
    if (failed.length) toast.warning(`${failed.length} tabel gagal: ${failed.map((f) => f.table).join(", ")}`);
    return res;
  };

  const stamp = () => new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

  const downloadBlob = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const handleCsvZip = async () => {
    setBusy("csv");
    try {
      const res = await fetchData(); if (!res) return;
      const zip = new JSZip();
      const folder = zip.folder(`backup-${stamp()}`)!;
      folder.file("manifest.json", JSON.stringify({ generated_at: res.generated_at, tables: res.tables.map((t) => ({ table: t.table, count: t.count, error: t.error })) }, null, 2));
      for (const t of res.tables) folder.file(`${t.table}.csv`, toCsv(t.rows));
      const blob = await zip.generateAsync({ type: "blob" });
      downloadBlob(blob, `koperasi-backup-${stamp()}.zip`);
      toast.success(`Backup ${res.tables.length} tabel berhasil diunduh.`);
    } catch (e: any) { toast.error(e?.message ?? "Gagal membuat backup."); } finally { setBusy(null); }
  };

  const handleJson = async () => {
    setBusy("json");
    try {
      const res = await fetchData(); if (!res) return;
      const blob = new Blob([JSON.stringify(res, null, 2)], { type: "application/json" });
      downloadBlob(blob, `koperasi-backup-${stamp()}.json`);
      toast.success("Backup JSON berhasil diunduh.");
    } catch (e: any) { toast.error(e?.message ?? "Gagal."); } finally { setBusy(null); }
  };

  const handleXlsx = async () => {
    setBusy("xlsx");
    try {
      const res = await fetchData(); if (!res) return;
      const wb = XLSX.utils.book_new();
      for (const t of res.tables) {
        const sheet = XLSX.utils.json_to_sheet(t.rows.length ? t.rows : [{ _empty: true }]);
        XLSX.utils.book_append_sheet(wb, sheet, t.table.slice(0, 31));
      }
      XLSX.writeFile(wb, `koperasi-backup-${stamp()}.xlsx`);
      toast.success("Backup Excel berhasil diunduh.");
    } catch (e: any) { toast.error(e?.message ?? "Gagal."); } finally { setBusy(null); }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!isSA) return (
    <Card className="p-8 text-center">
      <ShieldAlert className="mx-auto h-8 w-8 text-destructive" />
      <p className="mt-2 font-semibold">Akses Ditolak</p>
      <p className="text-xs text-muted-foreground">Backup hanya untuk Super Admin.</p>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-6 text-primary-foreground" style={{ background: "var(--gradient-hero)", boxShadow: "var(--shadow-elegant)" }}>
        <div className="flex items-center gap-2 text-sm text-[#312b2b]"><DatabaseBackup className="h-4 w-4" /> Super Admin · Backup</div>
        <h1 className="mt-2 text-2xl md:text-3xl font-bold text-[#2c2626]">Backup & Export Data</h1>
        <p className="mt-1 text-sm text-[#3e3232]">Unduh snapshot lengkap data koperasi (anggota, simpanan, pinjaman, marketplace, dll) sebagai ZIP/CSV, JSON, atau Excel.</p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <Badge variant="secondary">{selected.size} / {BACKUP_TABLES.length} tabel dipilih</Badge>
          <Button size="sm" variant="outline" onClick={selectAll}>Pilih semua</Button>
          <Button size="sm" variant="outline" onClick={clearAll}>Kosongkan</Button>
          <div className="flex-1" />
          <Button onClick={handleCsvZip} disabled={!!busy || !selected.size}>
            {busy === "csv" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            ZIP (CSV)
          </Button>
          <Button onClick={handleXlsx} variant="outline" disabled={!!busy || !selected.size}>
            {busy === "xlsx" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
            Excel
          </Button>
          <Button onClick={handleJson} variant="outline" disabled={!!busy || !selected.size}>
            {busy === "json" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileJson className="mr-2 h-4 w-4" />}
            JSON
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {GROUPS.map((g) => {
          const all = g.tables.every((t) => selected.has(t));
          const some = g.tables.some((t) => selected.has(t));
          return (
            <Card key={g.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm">{g.label}</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => toggleGroup(g.tables)} className="h-7 text-xs">
                  {all ? "Hapus semua" : some ? "Pilih semua" : "Pilih semua"}
                </Button>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2">
                {g.tables.map((t) => (
                  <label key={t} className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-xs hover:bg-accent cursor-pointer">
                    <Checkbox checked={selected.has(t)} onCheckedChange={() => toggle(t)} />
                    <span className="font-mono">{t}</span>
                  </label>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-dashed">
        <CardContent className="p-4 text-xs text-muted-foreground space-y-1">
          <p>• <strong>ZIP (CSV)</strong>: arsip terkompres berisi 1 file CSV per tabel + <code>manifest.json</code>. Direkomendasikan untuk arsip rutin.</p>
          <p>• <strong>Excel</strong>: 1 file <code>.xlsx</code>, 1 sheet per tabel — mudah dibuka oleh pengurus.</p>
          <p>• <strong>JSON</strong>: 1 file mentah untuk migrasi/restore teknis.</p>
          <p>• Maksimal 50.000 baris per tabel per ekspor. Lakukan backup berkala (mingguan/bulanan) untuk arsip eksternal.</p>
        </CardContent>
      </Card>
    </div>
  );
}
