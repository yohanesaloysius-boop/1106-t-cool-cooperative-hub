-- Public aggregate stats for landing page (no PII)
CREATE OR REPLACE FUNCTION public.get_public_koperasi_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total int;
  v_aktif int;
  v_pending int;
  v_nonaktif int;
  v_baru30 int;
  v_growth jsonb;
  v_dist jsonb;
BEGIN
  SELECT COUNT(*) INTO v_total FROM public.profiles WHERE deleted_at IS NULL;
  SELECT COUNT(*) INTO v_aktif FROM public.profiles WHERE deleted_at IS NULL AND status = 'active';
  SELECT COUNT(*) INTO v_pending FROM public.profiles WHERE deleted_at IS NULL AND status = 'pending';
  SELECT COUNT(*) INTO v_nonaktif FROM public.profiles WHERE deleted_at IS NULL AND status IN ('suspended','rejected');
  SELECT COUNT(*) INTO v_baru30 FROM public.profiles WHERE deleted_at IS NULL AND created_at >= now() - interval '30 days';

  -- Cumulative growth, last 6 months
  WITH months AS (
    SELECT date_trunc('month', now()) - (i || ' months')::interval AS m
    FROM generate_series(0,5) i
  ),
  agg AS (
    SELECT
      to_char(m, 'Mon') AS label,
      m,
      (SELECT COUNT(*) FROM public.profiles
        WHERE deleted_at IS NULL AND created_at < (m + interval '1 month')) AS total,
      (SELECT COUNT(*) FROM public.profiles
        WHERE deleted_at IS NULL AND created_at >= m AND created_at < (m + interval '1 month')) AS baru
    FROM months
  )
  SELECT jsonb_agg(jsonb_build_object('m', label, 'v', total, 'baru', baru) ORDER BY m) INTO v_growth FROM agg;

  -- Status distribution
  SELECT jsonb_build_object(
    'aktif', v_aktif,
    'pending', v_pending,
    'suspended', (SELECT COUNT(*) FROM public.profiles WHERE deleted_at IS NULL AND status='suspended'),
    'rejected', (SELECT COUNT(*) FROM public.profiles WHERE deleted_at IS NULL AND status='rejected')
  ) INTO v_dist;

  RETURN jsonb_build_object(
    'total', v_total,
    'aktif', v_aktif,
    'pending', v_pending,
    'nonaktif', v_nonaktif,
    'baru30', v_baru30,
    'growth', COALESCE(v_growth, '[]'::jsonb),
    'distribusi', v_dist
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_koperasi_stats() TO anon, authenticated;

-- Public-safe recent activity feed (no user PII, only event types + timestamps)
CREATE OR REPLACE FUNCTION public.get_public_recent_activity(limit_count int DEFAULT 6)
RETURNS TABLE (kind text, title text, descr text, ts timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  (
    SELECT 'member'::text AS kind,
           'Anggota baru bergabung'::text AS title,
           ('Anggota ' || COALESCE(nomor_anggota, 'baru') || ' mendaftar')::text AS descr,
           created_at AS ts
    FROM public.profiles
    WHERE deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT limit_count
  )
  UNION ALL
  (
    SELECT 'simpanan'::text, 'Setor simpanan'::text,
           ('Setoran ' || jenis::text)::text,
           created_at
    FROM public.simpanan
    WHERE deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT limit_count
  )
  UNION ALL
  (
    SELECT 'pinjaman'::text, 'Pengajuan pinjaman'::text,
           ('Status: ' || status::text)::text,
           created_at
    FROM public.pinjaman
    WHERE deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT limit_count
  )
  ORDER BY ts DESC
  LIMIT limit_count;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_recent_activity(int) TO anon, authenticated;