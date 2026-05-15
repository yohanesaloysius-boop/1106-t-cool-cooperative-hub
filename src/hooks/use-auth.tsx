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

const VIEW_AS_KEY = "tcool.viewAsMember";

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (uid: string) => {
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("id,nomor_anggota,nama_lengkap,email,no_hp,status,foto_url").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);
    setProfile((p as Profile) ?? null);
    setRoles(((r ?? []) as { role: AppRole }[]).map((x) => x.role));
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => void loadProfile(s.user.id), 0);
        if (event === "SIGNED_IN") {
          setTimeout(() => {
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
      } else {
        setProfile(null);
        setRoles([]);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) void loadProfile(data.session.user.id);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthCtx = {
    user,
    session,
    profile,
    roles,
    loading,
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