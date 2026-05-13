import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/pinjaman")({
  validateSearch: (s: Record<string, unknown>) => ({
    nominal: typeof s.nominal === "number" ? s.nominal : undefined,
    tenor: typeof s.tenor === "number" ? s.tenor : undefined,
    bunga: typeof s.bunga === "number" ? s.bunga : undefined,
    jenis: typeof s.jenis === "string" ? (s.jenis as string) : undefined,
  }),
  head: () => ({ meta: [{ title: "Pinjaman Saya — T-COOL Koperasi" }] }),
  component: () => {
    const s = Route.useSearch();
    const fmt = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pinjaman Saya</h1>
          <p className="text-sm text-muted-foreground">Pengajuan dan status pinjaman Anda.</p>
        </div>
        {s.nominal ? (
          <Card style={{ boxShadow: "var(--shadow-card)" }}>
            <CardHeader><CardTitle>Simulasi dari Kalkulator</CardTitle></CardHeader>
            <CardContent className="text-sm">
              <p>Nominal: <strong>{fmt.format(s.nominal)}</strong> · Tenor: <strong>{s.tenor} bulan</strong> · Bunga: <strong>{s.bunga}% ({s.jenis})</strong></p>
              <p className="mt-2 text-muted-foreground">Form pengajuan resmi tersedia di iterasi berikutnya.</p>
            </CardContent>
          </Card>
        ) : null}
        <Card style={{ boxShadow: "var(--shadow-card)" }}>
          <CardHeader><CardTitle>Daftar Pinjaman</CardTitle></CardHeader>
          <CardContent>
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Belum ada pinjaman.</div>
          </CardContent>
        </Card>
      </div>
    );
  },
});