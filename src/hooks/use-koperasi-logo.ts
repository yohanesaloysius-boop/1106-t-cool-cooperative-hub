import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Logo koperasi tunggal yang tersinkron di seluruh aplikasi (header, surat, AD/ART, dll). */
export function useKoperasiLogo() {
  const { data } = useQuery({
    queryKey: ["koperasi-logo"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from("settings").select("value").eq("key", "koperasi.logo_url").maybeSingle();
      const v = data?.value;
      return typeof v === "string" ? v : null;
    },
  });
  return data ?? null;
}
