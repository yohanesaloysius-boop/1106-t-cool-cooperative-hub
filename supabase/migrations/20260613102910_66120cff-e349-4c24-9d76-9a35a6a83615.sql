-- Struktur pengurus koperasi disimpan di settings (editable dari Pengaturan Koperasi)
INSERT INTO public.settings (key, value, description, is_public)
VALUES (
  'koperasi.pengurus',
  '[
    {"jabatan":"Ketua","nama":"","foto_url":""},
    {"jabatan":"Sekretaris","nama":"","foto_url":""},
    {"jabatan":"Bendahara","nama":"","foto_url":""},
    {"jabatan":"Dewan Pengawas 1","nama":"","foto_url":""},
    {"jabatan":"Dewan Pengawas 2","nama":"","foto_url":""}
  ]'::jsonb,
  'Struktur pengurus koperasi yang tampil di halaman utama',
  true
)
ON CONFLICT (key) DO NOTHING;

-- RPC publik agar struktur bisa dibaca di halaman utama (anonim)
CREATE OR REPLACE FUNCTION public.get_public_pengurus()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT value FROM public.settings WHERE key = 'koperasi.pengurus'), '[]'::jsonb);
$$;

GRANT EXECUTE ON FUNCTION public.get_public_pengurus() TO anon, authenticated;