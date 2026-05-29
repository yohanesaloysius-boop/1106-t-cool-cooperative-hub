import { createClient } from "@supabase/supabase-js";
const a = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false }});
const EMAIL = "yohanesaloysius@gmail.com";
const PHONE = "+6281372776788";
const PASS = "Admin123!";

const { data: list } = await a.auth.admin.listUsers({ page: 1, perPage: 1000 });
let user = list.users.find(u => u.email?.toLowerCase() === EMAIL);
if (user) {
  await a.auth.admin.updateUserById(user.id, { password: PASS, email_confirm: true, phone: PHONE, phone_confirm: true });
  console.log("Updated existing:", user.id);
} else {
  const { data, error } = await a.auth.admin.createUser({
    email: EMAIL, password: PASS, email_confirm: true,
    phone: PHONE, phone_confirm: true,
    user_metadata: { nama_lengkap: "Yohanes Aloysius", no_hp: PHONE },
  });
  if (error) { console.error(error); process.exit(1); }
  user = data.user!;
  console.log("Created:", user.id);
}

const year = new Date().getFullYear();
const { count } = await a.from("profiles").select("*",{count:"exact",head:true}).like("nomor_anggota",`TCOOL-${year}-%`);
const nomor = `TCOOL-${year}-${String((count??0)+1).padStart(4,"0")}`;

const { error: pe } = await a.from("profiles").upsert({
  id: user.id, email: EMAIL, nama_lengkap: "Yohanes Aloysius",
  no_hp: PHONE, nomor_anggota: nomor, status: "active",
}, { onConflict: "id" });
console.log("profile:", pe?.message ?? "ok", nomor);

const { error: re } = await a.from("user_roles").upsert({ user_id: user.id, role: "super_admin" }, { onConflict: "user_id,role" });
console.log("role super_admin:", re?.message ?? "ok");

console.log("\n=== LOGIN ===\nEmail: " + EMAIL + "\nPass : " + PASS);
