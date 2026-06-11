// Verify caller of /api/public/hooks/* using Supabase apikey header.
// pg_cron must send: headers:='{"apikey":"<SUPABASE_PUBLISHABLE_KEY>"}'
export function verifyCronAuth(request: Request): Response | null {
  const expected =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    "";
  if (!expected) {
    return Response.json(
      { ok: false, error: "Server tidak terkonfigurasi (apikey)" },
      { status: 500 },
    );
  }
  const got =
    request.headers.get("apikey") ||
    request.headers.get("x-api-key") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    "";
  if (got !== expected) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
