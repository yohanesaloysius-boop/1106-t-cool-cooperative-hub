import { createClient } from "@supabase/supabase-js";
const a = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false }});
const { data } = await a.auth.admin.listUsers({ page: 1, perPage: 200 });
const year = new Date().getFullYear();
const anggota = data.users.filter(u => u.email?.match(/^anggota\d+@tcool\.id$/i)).sort((x,y)=>x.email!.localeCompare(y.email!));
let { count } = await a.from("profiles").select("*",{count:"exact",head:true}).like("nomor_anggota",`TCOOL-${year}-%`);
let n = count ?? 0;
for (const u of anggota) {
  const m = u.user_metadata || {};
  // check existing
  const { data: ex } = await a.from("profiles").select("id,nomor_anggota").eq("id", u.id).maybeSingle();
  let nomor = ex?.nomor_anggota;
  if (!nomor) { n++; nomor = `TCOOL-${year}-${String(n).padStart(4,"0")}`; }
  const { error: e1 } = await a.from("profiles").upsert({
    id: u.id, nama_lengkap: m.nama_lengkap || u.email, email: u.email,
    no_hp: m.no_hp, nik: m.nik, alamat: m.alamat, nomor_anggota: nomor, status: "active",
  }, { onConflict: "id" });
  const { error: e2 } = await a.from("user_roles").upsert({ user_id: u.id, role: "anggota" }, { onConflict: "user_id,role" });
  console.log(u.email, nomor, e1?.message ?? "ok", e2?.message ?? "ok");
}
console.log("TOTAL:", anggota.length);
