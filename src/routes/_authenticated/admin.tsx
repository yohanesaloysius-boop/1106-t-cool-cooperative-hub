import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { canAccessAdminPath, PENGURUS_ROLES } from "@/lib/access";
import type { AppRole } from "@/hooks/use-auth";
import { ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async ({ location }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .is("deleted_at", null);
    const roleList = (roles ?? []).map((r) => r.role as AppRole);
    const isPengurus = roleList.some((r) => PENGURUS_ROLES.includes(r));
    // Anggota / non-pengurus tidak boleh masuk area admin sama sekali
    if (!isPengurus) throw redirect({ to: "/dashboard" });
    // Pengurus hanya boleh membuka menu sesuai job-desc-nya
    if (!canAccessAdminPath(roleList, location.pathname)) {
      throw redirect({ to: "/admin" });
    }
  },
  component: AdminGuard,
  errorComponent: () => (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border p-10 text-center">
      <ShieldAlert className="mb-2 h-6 w-6 text-destructive" />
      <p className="font-semibold">Akses Ditolak</p>
      <p className="text-xs text-muted-foreground">Halaman ini hanya untuk pengurus koperasi.</p>
    </div>
  ),
});

function AdminGuard() {
  return <Outlet />;
}

