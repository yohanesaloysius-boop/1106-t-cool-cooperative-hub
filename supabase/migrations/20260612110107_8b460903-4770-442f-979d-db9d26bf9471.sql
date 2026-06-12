INSERT INTO public.reserve_funds (jenis, nama, deskripsi, persen_dari_shu)
SELECT * FROM (VALUES
  ('cadangan'::reserve_fund_jenis, 'Dana Cadangan', 'Dana cadangan koperasi untuk memperkuat modal dan menutup kerugian.', 25),
  ('sosial'::reserve_fund_jenis, 'Dana Sosial', 'Dana untuk kegiatan sosial dan bantuan anggota.', 5),
  ('pendidikan'::reserve_fund_jenis, 'Dana Pendidikan', 'Dana untuk pendidikan dan pelatihan anggota serta pengurus.', 5),
  ('pengembangan'::reserve_fund_jenis, 'Dana Pengembangan', 'Dana untuk pengembangan usaha dan daerah kerja koperasi.', 5)
) AS v(jenis, nama, deskripsi, persen_dari_shu)
WHERE NOT EXISTS (SELECT 1 FROM public.reserve_funds);