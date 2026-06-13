// Verify caller of /api/public/hooks/* using a dedicated, high-entropy secret.
// This secret is server-only (never compiled into the browser bundle).
// pg_cron / external schedulers must send:
//   headers:='{"Authorization":"Bearer <CRON_SECRET>"}'
export function verifyCronAuth(request: Request): Response | null {
  const expected = process.env.CRON_SECRET || "";
  if (!expected) {
    return Response.json(
      { ok: false, error: "Server tidak terkonfigurasi (CRON_SECRET)" },
      { status: 500 },
    );
  }
  const got =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    request.headers.get("x-cron-secret") ||
    "";
  // Constant-time-ish comparison
  if (got.length !== expected.length || got !== expected) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
