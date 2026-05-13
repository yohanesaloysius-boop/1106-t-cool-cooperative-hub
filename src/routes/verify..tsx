import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ShieldAlert, Loader2 } from "lucide-react";

export const Route = createFileRoute("/verify/")({
  head: () => ({ meta: [{ title: "Verifikasi Dokumen — T-COOL" }] }),
  component: VerifyPage,
});

function VerifyPage() {
  const { id } = Route.useParams();
  const [state, setState] = useState<"loading" | "ok" | "fail">("loading");
  const [data, setData] = useState<{ action: string; created_at: string; new_data: unknown } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: row } = await supabase.from("audit_logs").select("action,created_at,new_data").eq("entity_id", id).order("created_at", { ascending: false }).maybeSingle();
      if (row) { setData(row); setState("ok"); } else setState("fail");
    })();
  }, [id]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {state === "loading" ? <Loader2 className="h-5 w-5 animate-spin" /> : state === "ok" ? <ShieldCheck className="h-5 w-5 text-success" /> : <ShieldAlert className="h-5 w-5 text-destructive" />}
            Verifikasi Dokumen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs text-muted-foreground">ID Dokumen</p>
            <p className="font-mono break-all">{id}</p>
          </div>
          {state === "loading" && <p className="text-muted-foreground">Memeriksa keaslian...</p>}
          {state === "ok" && data && (
            <div className="space-y-2">
              <p className="font-semibold text-success">✓ Dokumen sah & tercatat</p>
              <p><span className="text-muted-foreground">Aksi:</span> <span className="font-mono">{data.action}</span></p>
              <p><span className="text-muted-foreground">Tanggal:</span> {new Date(data.created_at).toLocaleString("id-ID")}</p>
            </div>
          )}
          {state === "fail" && <p className="text-destructive">Dokumen tidak ditemukan atau tidak sah.</p>}
          <Button asChild variant="outline" className="w-full"><Link to="/">Kembali</Link></Button>
        </CardContent>
      </Card>
    </div>
  );
}
