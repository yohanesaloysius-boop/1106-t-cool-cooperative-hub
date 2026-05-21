UPDATE public.profiles
SET no_hp = public.normalize_phone_id(no_hp)
WHERE no_hp IS NOT NULL
  AND no_hp <> public.normalize_phone_id(no_hp);