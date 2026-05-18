import { createClient } from "@supabase/supabase-js";
const a = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false }});
const UID = "52ce0fe4-ce11-4fef-bd9d-9b20bb7032a3";
const year = new Date().getFullYear();
const { count } = await a.from("profiles").select("*",{count:"exact",head:true}).like("nomor_anggota",`TCOOL-${year}-%`);
const nomor = `TCOOL-${year}-${String((count??0)+1).padStart(4,"0")}`;
const { error: e1 } = await a.from("profiles").upsert({
  id: UID, nama_lengkap: "Yohanes Aloysius", email: "yohanesaloysius@gmail.com",
  no_hp: "+6281372776788", nomor_anggota: nomor, status: "active",
}, { onConflict: "id" });
console.log("profile:", e1?.message ?? "ok", nomor);
const { error: e2 } = await a.from("user_roles").upsert({ user_id: UID, role: "super_admin" }, { onConflict: "user_id,role" });
console.log("role:", e2?.message ?? "ok");
