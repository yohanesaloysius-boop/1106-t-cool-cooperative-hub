CREATE OR REPLACE FUNCTION public.prevent_self_privilege_escalation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Definer/service_role (auth.uid() NULL) atau pengurus boleh apa saja.
  IF auth.uid() IS NULL OR public.is_pengurus(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Anggota biasa: tidak boleh mengubah field privilese pada baris mana pun
  -- (termasuk baris miliknya sendiri). Paksa nilai lama bila ada perubahan.
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status := OLD.status;
  END IF;
  IF NEW.nomor_anggota IS DISTINCT FROM OLD.nomor_anggota THEN
    NEW.nomor_anggota := OLD.nomor_anggota;
  END IF;
  IF NEW.member_card_number IS DISTINCT FROM OLD.member_card_number THEN
    NEW.member_card_number := OLD.member_card_number;
  END IF;
  IF NEW.card_status IS DISTINCT FROM OLD.card_status THEN
    NEW.card_status := OLD.card_status;
  END IF;
  IF NEW.card_expired_at IS DISTINCT FROM OLD.card_expired_at THEN
    NEW.card_expired_at := OLD.card_expired_at;
  END IF;
  IF NEW.qr_code IS DISTINCT FROM OLD.qr_code THEN
    NEW.qr_code := OLD.qr_code;
  END IF;
  IF NEW.barcode IS DISTINCT FROM OLD.barcode THEN
    NEW.barcode := OLD.barcode;
  END IF;
  IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
    NEW.deleted_at := OLD.deleted_at;
  END IF;
  IF NEW.joined_at IS DISTINCT FROM OLD.joined_at THEN
    NEW.joined_at := OLD.joined_at;
  END IF;
  IF NEW.phone_verified IS DISTINCT FROM OLD.phone_verified THEN
    NEW.phone_verified := OLD.phone_verified;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_prevent_self_privilege_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_self_privilege_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_self_privilege_escalation();