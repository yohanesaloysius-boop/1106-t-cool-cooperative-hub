import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Logo koperasi tunggal yang tersinkron di seluruh aplikasi (header, surat, AD/ART, dll). */
export function useKoperasiLogo() {
  const { data } = useQuery({
    queryKey: ["koperasi-logo"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_public_tentang");
      if (error) return null;
      const url = (data as Record<string, unknown> | null)?.logo_url;
      return typeof url === "string" && url ? url : null;
    },
  });
  return data ?? null;
}
