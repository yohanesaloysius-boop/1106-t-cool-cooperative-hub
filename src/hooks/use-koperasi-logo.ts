import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { LogoFit, LogoBg } from "@/lib/image-data";

export type KoperasiLogo = { url: string | null; fit: LogoFit; bg: LogoBg };

/** Logo koperasi + mode tampilan (contain/cover) yang tersinkron di seluruh aplikasi. */
export function useKoperasiLogo(): KoperasiLogo {
  const { data } = useQuery({
    queryKey: ["koperasi-logo"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<KoperasiLogo> => {
      const { data, error } = await (supabase.rpc as any)("get_public_tentang");
      if (error) return { url: null, fit: "contain", bg: "transparent" };
      const rec = (data as Record<string, unknown> | null) ?? {};
      const url = typeof rec.logo_url === "string" && rec.logo_url ? rec.logo_url : null;
      const fit: LogoFit = rec.logo_fit === "cover" ? "cover" : "contain";
      const bg: LogoBg = rec.logo_bg === "white" ? "white" : "transparent";
      return { url, fit, bg };
    },
  });
  return data ?? { url: null, fit: "contain", bg: "transparent" };
}
