import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminGuard,
});

function AdminGuard() {
  const { roles, loading, viewAsMember } = useAuth();
  const navigate = useNavigate();
  const allowed = !viewAsMember && roles.some((r) => ["super_admin", "ketua", "sekretaris", "bendahara"].includes(r));

  useEffect(() => {
    if (!loading && !allowed) navigate({ to: "/dashboard" });
  }, [loading, allowed, navigate]);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  if (!allowed) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border p-10 text-center">
        <ShieldAlert className="mb-2 h-6 w-6 text-destructive" />
        <p className="font-semibold">Akses Ditolak</p>
        <p className="text-xs text-muted-foreground">Halaman ini hanya untuk pengurus koperasi.</p>
      </div>
    );
  }
  return <Outlet />;
}
