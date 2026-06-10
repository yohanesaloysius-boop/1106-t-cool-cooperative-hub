
INSERT INTO public.settings (key, value, description) VALUES
  ('shu.persen_jasa_modal',       to_jsonb(40), 'Persen pot SHU untuk jasa modal (simpanan)'),
  ('shu.persen_jasa_usaha',       to_jsonb(40), 'Persen pot SHU untuk jasa usaha (transaksi)'),
  ('shu.persen_dana_cadangan',    to_jsonb(20), 'Persen pot SHU untuk dana cadangan'),
  ('shu.bobot_simpanan_pokok',    to_jsonb(1.0), 'Bobot simpanan pokok pada jasa modal'),
  ('shu.bobot_simpanan_wajib',    to_jsonb(1.5), 'Bobot simpanan wajib pada jasa modal'),
  ('shu.bobot_simpanan_sukarela', to_jsonb(0.5), 'Bobot simpanan sukarela pada jasa modal'),
  ('shu.bobot_jasa_pinjaman',     to_jsonb(1.0), 'Bobot bunga pinjaman pada jasa usaha'),
  ('shu.bobot_jasa_belanja',      to_jsonb(0.5), 'Bobot belanja marketplace pada jasa usaha'),
  ('shu.bobot_jasa_deposito',     to_jsonb(0.3), 'Bobot tabungan berjangka pada jasa usaha'),
  ('shu.min_keaktifan_persen',    to_jsonb(0),   'Anggota dengan keaktifan di bawah persen ini SHU-nya 0'),
  ('shu.penalti_tunggakan_persen',to_jsonb(20),  'Potongan SHU (%) jika anggota memiliki tunggakan angsuran')
ON CONFLICT (key) DO NOTHING;
