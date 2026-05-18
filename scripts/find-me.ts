import { createClient } from "@supabase/supabase-js";
const a = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false }});
const { data } = await a.auth.admin.listUsers({ page: 1, perPage: 200 });
for (const u of data.users) {
  console.log(u.id, u.email, u.phone, u.last_sign_in_at);
}
