
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tabungan_status') THEN
    CREATE TYPE tabungan_status AS ENUM ('pending','active','matured','withdrawn','rejected');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.tabungan_berjangka (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nominal numeric NOT NULL CHECK (nominal >= 100000),
  tenor_bulan int NOT NULL CHECK (tenor_bulan IN (3,6,12,24)),
  bunga_persen numeric NOT NULL DEFAULT 0.5,
  tanggal_mulai date,
  tanggal_jatuh_tempo date,
  total_bagi_hasil numeric DEFAULT 0,
  status tabungan_status NOT NULL DEFAULT 'pending',
  bukti_url text,
  catatan text,
  verified_by uuid,
  verified_at timestamptz,
  withdrawn_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE public.tabungan_berjangka ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tabjangka view own or pengurus" ON public.tabungan_berjangka FOR SELECT TO authenticated USING (auth.uid() = user_id OR is_pengurus(auth.uid()));
CREATE POLICY "tabjangka insert own" ON public.tabungan_berjangka FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tabjangka pengurus update" ON public.tabungan_berjangka FOR UPDATE TO authenticated USING (is_pengurus(auth.uid()));
CREATE TRIGGER trg_tabjangka_updated BEFORE UPDATE ON public.tabungan_berjangka FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.shu_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tahun int NOT NULL,
  poin_keaktifan int NOT NULL DEFAULT 0,
  poin_kehadiran_rapat int NOT NULL DEFAULT 0,
  poin_pelunasan_pinjaman int NOT NULL DEFAULT 0,
  poin_referral int NOT NULL DEFAULT 0,
  bonus_loyalitas numeric NOT NULL DEFAULT 0,
  total_poin int GENERATED ALWAYS AS (poin_keaktifan + poin_kehadiran_rapat + poin_pelunasan_pinjaman + poin_referral) STORED,
  total_bonus numeric NOT NULL DEFAULT 0,
  catatan text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, tahun)
);
ALTER TABLE public.shu_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rewards view own or pengurus" ON public.shu_rewards FOR SELECT TO authenticated USING (auth.uid() = user_id OR is_pengurus(auth.uid()));
CREATE POLICY "rewards pengurus manage" ON public.shu_rewards FOR ALL TO authenticated USING (is_pengurus(auth.uid())) WITH CHECK (is_pengurus(auth.uid()));
CREATE TRIGGER trg_rewards_updated BEFORE UPDATE ON public.shu_rewards FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.settings (key, value, description, is_public) VALUES
  ('pinjaman.bunga_persen', '1.5'::jsonb, 'Bunga pinjaman per bulan (%)', true),
  ('pinjaman.tenor_max', '24'::jsonb, 'Tenor maksimum pinjaman (bulan)', true),
  ('pinjaman.bunga_jenis', '"flat"'::jsonb, 'Jenis bunga pinjaman (flat/menurun)', true),
  ('simpanan.pokok_min', '500000'::jsonb, 'Simpanan pokok minimum (Rp)', true),
  ('simpanan.wajib_bulanan', '100000'::jsonb, 'Simpanan wajib per bulan (Rp)', true),
  ('shu.persen_jasa_modal', '30'::jsonb, 'Persentase SHU jasa modal (%)', true),
  ('shu.persen_jasa_usaha', '25'::jsonb, 'Persentase SHU jasa usaha (%)', true),
  ('shu.persen_dana_cadangan', '25'::jsonb, 'Persentase SHU dana cadangan (%)', true),
  ('shu.persen_dana_sosial', '10'::jsonb, 'Persentase SHU dana sosial (%)', true),
  ('shu.persen_pengurus', '10'::jsonb, 'Persentase SHU jasa pengurus (%)', true),
  ('tabungan_berjangka.bunga_3bln', '0.4'::jsonb, 'Bunga deposito tenor 3 bulan (%/bulan)', true),
  ('tabungan_berjangka.bunga_6bln', '0.5'::jsonb, 'Bunga deposito tenor 6 bulan (%/bulan)', true),
  ('tabungan_berjangka.bunga_12bln', '0.6'::jsonb, 'Bunga deposito tenor 12 bulan (%/bulan)', true),
  ('tabungan_berjangka.bunga_24bln', '0.75'::jsonb, 'Bunga deposito tenor 24 bulan (%/bulan)', true),
  ('rewards.poin_setor_wajib', '10'::jsonb, 'Poin per setor simpanan wajib tepat waktu', true),
  ('rewards.poin_hadir_rapat', '20'::jsonb, 'Poin per kehadiran rapat', true),
  ('rewards.poin_lunas_pinjaman', '50'::jsonb, 'Poin per pelunasan pinjaman tepat waktu', true),
  ('rewards.poin_referral', '100'::jsonb, 'Poin per referral anggota baru aktif', true),
  ('rewards.loyalitas_tahun_min', '2'::jsonb, 'Tahun minimum keanggotaan untuk bonus loyalitas', true),
  ('rewards.loyalitas_persen', '5'::jsonb, 'Bonus loyalitas (% dari SHU dasar)', true)
ON CONFLICT (key) DO NOTHING;

DO $$
DECLARE
  v_id uuid;
  v_status member_status;
  v_nama text;
  v_email text;
  v_seed_marker uuid := '00000000-0000-0000-0000-000000000001';
  i int;
  j int;
  nama_array text[] := ARRAY[
    'Budi Santoso','Siti Nurhaliza','Ahmad Fauzi','Dewi Lestari','Eko Prasetyo',
    'Rina Marlina','Joko Widodo','Sri Wahyuni','Bambang Sutrisno','Indah Permata',
    'Rudi Hartono','Maya Anggraini','Hendra Gunawan','Putri Ayu','Agus Salim',
    'Lina Kurniawati','Dodi Setiawan','Yuni Astuti','Hadi Pranoto','Citra Dewi',
    'Wahyu Hidayat','Ratna Sari','Iwan Setyawan','Endang Susanti','Faisal Rahman',
    'Tuti Handayani','Rahmat Hidayat','Nining Suryani','Anton Wijaya','Mega Puspita'
  ];
  kota_array text[] := ARRAY['Jakarta','Bandung','Surabaya','Yogyakarta','Semarang','Medan','Makassar','Denpasar','Palembang','Malang'];
  pekerjaan_array text[] := ARRAY['Karyawan Swasta','Wiraswasta','Guru','Petani','PNS','Pedagang','Sopir','Buruh','Mahasiswa','Ibu Rumah Tangga'];
BEGIN
  FOR i IN 1..30 LOOP
    v_id := gen_random_uuid();
    v_nama := nama_array[i];
    v_email := lower(replace(split_part(v_nama,' ',1),' ','')) || (1000+i)::text || '@demo.tcool.id';

    IF i <= 20 THEN v_status := 'active';
    ELSIF i <= 27 THEN v_status := 'pending';
    ELSE v_status := 'suspended';
    END IF;

    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user
    ) VALUES (
      v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      v_email, crypt('DemoTcool2026!', gen_salt('bf')), now(),
      now() - ((i*7)::text || ' days')::interval,
      now() - ((i*7)::text || ' days')::interval,
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object(
        'nama_lengkap', v_nama,
        'no_hp', '0812' || LPAD((10000000 + i*131)::text, 8, '0'),
        'nik', '32' || LPAD((71000000 + i*37)::text, 14, '0'),
        'alamat', 'Jl. Kenanga No. ' || i || ', ' || kota_array[1 + (i % 10)]
      ),
      false
    );

    UPDATE public.profiles SET
      pekerjaan = pekerjaan_array[1 + (i % 10)],
      jenis_kelamin = CASE WHEN i % 2 = 0 THEN 'L' ELSE 'P' END,
      status = v_status,
      joined_at = now() - ((i*7)::text || ' days')::interval,
      created_by = v_seed_marker
    WHERE id = v_id;

    IF v_status = 'active' THEN
      INSERT INTO public.simpanan (user_id, jenis, nominal, status, verified_at, created_by, catatan)
      VALUES (v_id, 'pokok', 500000, 'verified', now() - ((i*7)::text || ' days')::interval, v_seed_marker, '[DEMO] Setoran awal');

      FOR j IN 1..LEAST(i, 6) LOOP
        INSERT INTO public.simpanan (user_id, jenis, nominal, status, verified_at, created_by, created_at, catatan)
        VALUES (v_id, 'wajib', 100000, 'verified', now() - (j::text || ' months')::interval, v_seed_marker,
                now() - (j::text || ' months')::interval, '[DEMO] Wajib bulanan');
      END LOOP;

      IF i % 3 = 0 THEN
        INSERT INTO public.simpanan (user_id, jenis, nominal, status, verified_at, created_by, catatan)
        VALUES (v_id, 'sukarela', 250000 + (i*10000), 'verified', now() - '15 days'::interval, v_seed_marker, '[DEMO] Sukarela');
      END IF;

      IF i % 5 = 0 THEN
        INSERT INTO public.pinjaman (user_id, nominal, tenor_bulan, bunga_persen, bunga_jenis, status, cicilan_per_bulan, total_bayar, tujuan, approved_at, disbursed_at, created_by)
        VALUES (v_id, 5000000, 12, 1.5, 'flat', 'disbursed'::pinjaman_status,
                round((5000000.0/12) + (5000000*0.015), 0),
                5000000 + (5000000*0.015*12),
                '[DEMO] Modal usaha', now() - '60 days'::interval, now() - '55 days'::interval, v_seed_marker);
      END IF;
    END IF;
  END LOOP;
END $$;
