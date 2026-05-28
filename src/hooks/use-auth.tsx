import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "super_admin" | "ketua" | "sekretaris" | "bendahara" | "anggota";

interface Profile {
  id: string;
  nomor_anggota: string | null;
  nama_lengkap: string;
  email: string | null;
  no_hp: string | null;
  status: "pending" | "active" | "suspended" | "rejected";
  foto_url: string | null;
}

interface AuthCtx {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  isPengurus: boolean;
  viewAsMember: boolean;
  setViewAsMember: (v: boolean) => void;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewAsMember, setViewAsMemberState] = useState(false);
  const setViewAsMember = (v: boolean) => {
    setViewAsMemberState(v);
  };
  const realPengurus = roles.some((r) => ["super_admin", "ketua", "sekretaris", "bendahara"].includes(r));
  const isPengurus = realPengurus && !viewAsMember;

  const loadProfile = async (uid: string) => {
    try {
      const [{ data: p, error: profileError }, { data: r, error: roleError }] = await Promise.all([
        supabase.from("profiles").select("id,nomor_anggota,nama_lengkap,email,no_hp,status,foto_url").eq("id", uid).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", uid).is("deleted_at", null),
      ]);

      if (profileError) throw profileError;
      if (roleError) throw roleError;

      setProfile((p as Profile) ?? null);
      setRoles(((r ?? []) as { role: AppRole }[]).map((x) => x.role));
    } catch (error) {
      console.error("Gagal memuat profil/role", error);
      setProfile(null);
      setRoles([]);
    }
  };

  const hydrateAuthState = async (nextSession: Session | null) => {
    setLoading(true);
    setSession(nextSession);
    setUser(nextSession?.user ?? null);

    if (!nextSession?.user) {
      setProfile(null);
      setRoles([]);
      setViewAsMemberState(false);
      setLoading(false);
      return;
    }

    setViewAsMemberState(false);
    try {
      await loadProfile(nextSession.user.id);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      void hydrateAuthState(s);
      if (event === "SIGNED_IN" && s?.user) {
        setTimeout(() => {
          void (supabase.rpc as any)("ensure_super_admin").then((res: any) => {
            if (res?.data === true) void loadProfile(s.user.id);
          });
          void supabase.from("audit_logs").insert({
            actor_id: s.user.id,
            action: "auth.login",
            entity: "auth",
            entity_id: s.user.id,
            user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
            new_data: { email: s.user.email, at: new Date().toISOString() },
          });
        }, 0);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      void hydrateAuthState(data.session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthCtx = {
    user,
    session,
    profile,
    roles,
    loading,
    isPengurus,
    viewAsMember: realPengurus ? viewAsMember : false,
    setViewAsMember: realPengurus ? setViewAsMember : () => {},
    signOut: async () => {
      await supabase.auth.signOut();
    },
    refresh: async () => {
      if (user) await loadProfile(user.id);
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}