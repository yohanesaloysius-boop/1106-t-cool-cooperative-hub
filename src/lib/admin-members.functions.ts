import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const DEMO_CREATOR = "00000000-0000-0000-0000-000000000001";

const inviteSchema = z.object({
  rows: z.array(z.object({
    email: z.string().email(),
    nama_lengkap: z.string().min(1).max(120),
    no_hp: z.string().max(30).optional(),
    nik: z.string().max(30).optional(),
    alamat: z.string().max(500).optional(),
  })).min(1).max(200),
});

async function assertPengurus(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error(error.message);
  const allowed = (data ?? []).some((r) =>
    ["super_admin", "ketua", "sekretaris", "bendahara"].includes(r.role));
  if (!allowed) throw new Error("Hanya pengurus.");
}

export const importMembersCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inviteSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertPengurus(context.userId);
    let ok = 0; const errors: string[] = [];
    for (const row of data.rows) {
      const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(row.email, {
        data: {
          nama_lengkap: row.nama_lengkap,
          no_hp: row.no_hp ?? null,
          nik: row.nik ?? null,
          alamat: row.alamat ?? null,
        },
      });
      if (error) errors.push(`${row.email}: ${error.message}`); else ok++;
    }
    return { ok, errors };
  });

export const deleteDemoMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPengurus(context.userId);
    const { data: profs, error } = await supabaseAdmin
      .from("profiles").select("id").eq("created_by", DEMO_CREATOR);
    if (error) throw new Error(error.message);
    const ids = (profs ?? []).map((p) => p.id);
    let removed = 0;
    for (const id of ids) {
      const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(id);
      if (!delErr) removed++;
    }
    return { removed, total: ids.length };
  });
