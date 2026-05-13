import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribe to postgres_changes for a table and run a callback on each event.
 * Cleans up channel on unmount.
 */
export function useRealtime(
  table: string,
  onChange: (payload: any) => void,
  opts: { event?: "INSERT" | "UPDATE" | "DELETE" | "*"; filter?: string } = {}
) {
  const { event = "*", filter } = opts;
  useEffect(() => {
    const ch = supabase
      .channel(`rt-${table}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event, schema: "public", table, ...(filter ? { filter } : {}) } as any,
        (payload) => onChange(payload)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, event, filter]);
}