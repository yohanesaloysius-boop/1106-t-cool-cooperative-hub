-- RPC aman untuk kelola role anggota — hanya super_admin yang boleh menjalankan.
CREATE OR REPLACE FUNCTION public.admin_set_role(
  target_user uuid,
  target_role public.app_role,
  enable boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  active_super_admins int;
BEGIN
  -- Otorisasi: hanya super_admin
  IF caller IS NULL OR NOT public.has_role(caller, 'super_admin') THEN
    RAISE EXCEPTION 'Hanya super admin yang dapat mengubah role';
  END IF;

  IF target_user IS NULL THEN
    RAISE EXCEPTION 'Target user tidak valid';
  END IF;

  IF enable THEN
    -- Tambah role bila belum ada
    INSERT INTO public.user_roles (user_id, role, created_by)
    SELECT target_user, target_role, caller
    WHERE NOT EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = target_user AND role = target_role
    );
  ELSE
    -- Pengaman: jangan sampai super_admin terakhir dicabut
    IF target_role = 'super_admin' THEN
      SELECT count(DISTINCT user_id) INTO active_super_admins
      FROM public.user_roles WHERE role = 'super_admin';
      IF active_super_admins <= 1 THEN
        RAISE EXCEPTION 'Tidak dapat mencabut super admin terakhir';
      END IF;
    END IF;
    -- Hard delete (has_role tidak memfilter deleted_at, jadi harus dihapus)
    DELETE FROM public.user_roles WHERE user_id = target_user AND role = target_role;
  END IF;

  -- Catat ke audit log
  INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, new_data)
  VALUES (
    caller,
    CASE WHEN enable THEN 'role.grant' ELSE 'role.revoke' END,
    'user_roles',
    target_user,
    jsonb_build_object('role', target_role, 'enable', enable)
  );

  RETURN jsonb_build_object('ok', true, 'user_id', target_user, 'role', target_role, 'enabled', enable);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_role(uuid, public.app_role, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_role(uuid, public.app_role, boolean) TO authenticated;