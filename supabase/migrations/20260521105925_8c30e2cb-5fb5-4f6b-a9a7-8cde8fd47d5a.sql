
CREATE OR REPLACE FUNCTION public.get_jurnal_umum(_from date DEFAULT NULL, _to date DEFAULT NULL)
RETURNS TABLE(
  tanggal timestamptz, user_id uuid, nama_anggota text, nomor_anggota text,
  jenis text, keterangan text, arah text, debit numeric, kredit numeric,
  ref_table text, ref_id uuid, status text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_pengurus(auth.uid()) THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;

  RETURN QUERY
  WITH rows AS (
    SELECT s.created_at AS tanggal, s.user_id,
      'Simpanan'::text AS jenis,
      ('Setoran ' || s.jenis::text)::text AS keterangan,
      'in'::text AS arah, 0::numeric AS debit, s.nominal AS kredit,
      'simpanan'::text AS ref_table, s.id AS ref_id, s.status::text AS status
    FROM public.simpanan s WHERE s.deleted_at IS NULL
    UNION ALL
    SELECT COALESCE(p.disbursed_at, p.created_at), p.user_id, 'Pencairan Pinjaman',
      'Pinjaman cair (tujuan: ' || COALESCE(p.tujuan,'-') || ')',
      'in', p.nominal, 0, 'pinjaman', p.id, p.status::text
    FROM public.pinjaman p
    WHERE p.deleted_at IS NULL AND p.status = 'disbursed'
    UNION ALL
    SELECT COALESCE(a.paid_at, a.created_at), a.user_id, 'Angsuran',
      'Cicilan ke-' || a.cicilan_ke,
      'out', a.nominal, 0, 'angsuran', a.id, a.status::text
    FROM public.angsuran a WHERE a.deleted_at IS NULL AND a.status = 'paid'
    UNION ALL
    SELECT COALESCE(a.paid_at, a.denda_updated_at, a.created_at), a.user_id, 'Denda',
      'Denda cicilan ke-' || a.cicilan_ke,
      'out', a.denda, 0, 'angsuran', a.id, a.status::text
    FROM public.angsuran a WHERE a.deleted_at IS NULL AND a.denda > 0 AND a.status = 'paid'
    UNION ALL
    SELECT COALESCE(sh.dibagikan_at, sh.created_at), sh.user_id, 'SHU',
      'Pembagian SHU tahun ' || sh.tahun,
      'in', 0, sh.nominal, 'shu', sh.id, NULL
    FROM public.shu sh WHERE sh.deleted_at IS NULL AND sh.dibagikan_at IS NOT NULL
  )
  SELECT r.tanggal, r.user_id,
    COALESCE(pr.nama_lengkap, '-')::text AS nama_anggota,
    pr.nomor_anggota::text,
    r.jenis, r.keterangan, r.arah, r.debit, r.kredit, r.ref_table, r.ref_id, r.status
  FROM rows r
  LEFT JOIN public.profiles pr ON pr.id = r.user_id
  WHERE (_from IS NULL OR r.tanggal::date >= _from)
    AND (_to IS NULL OR r.tanggal::date <= _to)
  ORDER BY r.tanggal DESC;
END $$;
