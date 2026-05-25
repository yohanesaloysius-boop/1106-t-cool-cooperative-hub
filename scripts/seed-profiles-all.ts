import { createClient } from "@supabase/supabase-js";
const a = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false }});
const { data: list } = await a.auth.admin.listUsers({ page: 1, perPage: 1000 });
const year = new Date().getFullYear();
let i = 0;
const sorted = [...list.users].sort((x,y) => (x.created_at||"").localeCompare(y.created_at||""));
for (const u of sorted) {
  i++;
  const meta: any = u.user_metadata || {};
  const isSA = u.email === "yohanesaloysius@gmail.com";
  const nomor = `TCOOL-${year}-${String(i).padStart(4,"0")}`;
  const { error } = await a.from("profiles").upsert({
    id: u.id,
    email: u.email,
    nama_lengkap: meta.nama_lengkap || u.email,
    no_hp: meta.no_hp || null,
    nomor_anggota: nomor,
    status: "active",
  }, { onConflict: "id" });
  console.log(i, u.email, error?.message ?? "ok");
  if (isSA) {
    const { error: re } = await a.from("user_roles").upsert({ user_id: u.id, role: "super_admin" }, { onConflict: "user_id,role" });
    console.log("  role:", re?.message ?? "ok");
  }
}
