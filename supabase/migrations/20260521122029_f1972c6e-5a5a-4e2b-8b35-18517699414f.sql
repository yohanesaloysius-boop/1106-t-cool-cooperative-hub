-- Seed default settings (idempotent)
INSERT INTO public.settings (key, value, description, is_public) VALUES
  ('simpanan.pokok_min', '100000'::jsonb, 'Nominal minimum simpanan pokok saat pendaftaran', true),
  ('simpanan.wajib_bulanan', '25000'::jsonb, 'Nominal simpanan wajib bulanan', true)
ON CONFLICT (key) DO NOTHING;

-- RPC: approve_member — aktivasi anggota + dompet + tagihan simpanan pokok + notifikasi
CREATE OR REPLACE FUNCTION public.approve_member(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pokok_min numeric;
  v_existing_pokok int;
  v_simpanan_id uuid;
  v_wallet_id uuid;
  v_nama text;
BEGIN
  IF NOT public.is_pengurus(auth.uid()) THEN
    RAISE EXCEPTION 'Hanya pengurus yang dapat mengaktifkan anggota';
  END IF;

  -- Ambil nominal pokok minimum
  SELECT COALESCE((value)::numeric, 100000) INTO v_pokok_min
  FROM public.settings WHERE key = 'simpanan.pokok_min';
  IF v_pokok_min IS NULL THEN v_pokok_min := 100000; END IF;

  -- Update status profil
  UPDATE public.profiles SET status = 'active', updated_at = now()
  WHERE id = p_user_id
  RETURNING nama_lengkap INTO v_nama;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Anggota tidak ditemukan';
  END IF;

  -- Buat dompet otomatis
  v_wallet_id := public.get_or_create_wallet(p_user_id);

  -- Cek apakah sudah pernah ada simpanan pokok (verified atau pending)
  SELECT COUNT(*) INTO v_existing_pokok
  FROM public.simpanan
  WHERE user_id = p_user_id AND jenis = 'pokok' AND deleted_at IS NULL;

  IF v_existing_pokok = 0 THEN
    INSERT INTO public.simpanan (user_id, jenis, nominal, status, catatan, created_by)
    VALUES (p_user_id, 'pokok', v_pokok_min, 'pending',
            'Tagihan simpanan pokok wajib saat pendaftaran. Segera lakukan pembayaran.',
            auth.uid())
    RETURNING id INTO v_simpanan_id;
  END IF;

  -- Notifikasi aktivasi
  INSERT INTO public.notifications (user_id, judul, pesan, kategori, ref_table, ref_id, url)
  VALUES (
    p_user_id,
    'Akun Anda telah diaktifkan',
    CASE WHEN v_simpanan_id IS NOT NULL
      THEN 'Selamat! Akun Anda aktif. Langkah selanjutnya: bayar simpanan pokok sebesar Rp ' || to_char(v_pokok_min, 'FM999G999G999') || ' untuk menyelesaikan onboarding.'
      ELSE 'Selamat! Akun Anda telah diverifikasi pengurus dan dapat digunakan sepenuhnya.'
    END,
    'sukses',
    'profiles',
    p_user_id,
    '/simpanan'
  );

  -- Audit log
  INSERT INTO public.audit_logs (actor_id, entity, entity_id, action, new_data)
  VALUES (auth.uid(), 'profiles', p_user_id, 'member_approved',
    jsonb_build_object('wallet_id', v_wallet_id, 'simpanan_pokok_id', v_simpanan_id, 'nominal_pokok', v_pokok_min));

  RETURN jsonb_build_object(
    'user_id', p_user_id,
    'wallet_id', v_wallet_id,
    'simpanan_pokok_id', v_simpanan_id,
    'nominal_pokok', v_pokok_min
  );
END $$;

GRANT EXECUTE ON FUNCTION public.approve_member(uuid) TO authenticated;