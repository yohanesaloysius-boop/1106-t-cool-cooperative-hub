import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/simpanan")({
  head: () => ({ meta: [{ title: "Simpanan Saya — T-COOL Koperasi" }] }),
  component: () => (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Simpanan Saya</h1>
        <p className="text-sm text-muted-foreground">Riwayat simpanan pokok, wajib, dan sukarela.</p>
      </div>
      <Card style={{ boxShadow: "var(--shadow-card)" }}>
        <CardHeader><CardTitle>Riwayat Transaksi</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Belum ada simpanan. Form setor simpanan akan tersedia di iterasi berikutnya.
          </div>
        </CardContent>
      </Card>
    </div>
  ),
});