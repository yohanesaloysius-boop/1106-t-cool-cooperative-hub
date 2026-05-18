import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(url, key, { auth: { persistSession: false } });

const SA = {
  email: "yohanesaloysius@gmail.com",
  password: "Admin123!",
  nama: "Yohanes Aloysius",
  no_hp: "+6281372776788",
  nik: "3201010101010001",
  alamat: "Jakarta",
};

const firstNames = ["Budi","Siti","Andi","Dewi","Rina","Agus","Tono","Yuni","Joko","Sri","Hadi","Wati","Bambang","Lestari","Iwan","Maya","Rudi","Indah","Slamet","Putri","Eko","Nia","Hendra","Anita","Fajar","Mega","Gunawan","Tari","Heri","Linda"];
const lastNames = ["Santoso","Wijaya","Pratama","Sari","Hidayat","Susanto","Kusuma","Permata","Nugroho","Rahmawati","Lestari","Putra","Wibowo","Anggraini"];

function pad(n: number, w = 4) { return String(n).padStart(w, "0"); }

async function upsert(email: string, password: string, meta: any) {
  // Try to find existing
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (existing) {
    await admin.auth.admin.updateUserById(existing.id, { password, user_metadata: meta, email_confirm: true });
    return existing.id;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: meta,
  });
  if (error) throw error;
  return data.user!.id;
}

async function main() {
  // SA first
  const saId = await upsert(SA.email, SA.password, {
    nama_lengkap: SA.nama, no_hp: SA.no_hp, nik: SA.nik, alamat: SA.alamat,
  });
  console.log("SA:", SA.email, "/", SA.password, "->", saId);

  // 31 dummy members
  for (let i = 1; i <= 31; i++) {
    const fn = firstNames[i % firstNames.length];
    const ln = lastNames[i % lastNames.length];
    const nama = `${fn} ${ln}`;
    const email = `anggota${pad(i, 2)}@tcool.id`;
    const phone = `+62812${pad(10000000 + i, 8)}`;
    const nik = `3201${pad(i, 12)}`;
    const id = await upsert(email, "Anggota123!", {
      nama_lengkap: nama, no_hp: phone, nik, alamat: `Alamat ${nama}`,
    });
    // activate them (default trigger sets pending)
    await admin.from("profiles").update({ status: "active", no_hp: phone }).eq("id", id);
    console.log(`#${i}`, email, "->", id);
  }
  console.log("DONE");
}

main().catch((e) => { console.error(e); process.exit(1); });
