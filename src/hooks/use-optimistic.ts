import { useState, useCallback } from "react";
import { toast } from "sonner";
import { toApiError } from "@/lib/api";

/**
 * Generic optimistic mutation hook with automatic rollback + toast.
 *
 * Usage:
 *   const [items, setItems] = useState<Item[]>([])
 *   const { run, isPending } = useOptimistic({
 *     mutate: async (id) => supabase.from('x').delete().eq('id', id),
 *     apply: (id) => setItems(prev => prev.filter(i => i.id !== id)),
 *     rollback: () => setItems(prevSnapshot),
 *     successMessage: 'Terhapus',
 *   })
 */
export function useOptimistic<TArgs, TResult = unknown>(opts: {
  mutate: (args: TArgs) => Promise<{ data: TResult | null; error: unknown } | unknown>;
  apply?: (args: TArgs) => void;
  rollback?: (args: TArgs) => void;
  successMessage?: string;
  errorMessage?: string;
  silent?: boolean;
  onSuccess?: (data: TResult | null, args: TArgs) => void;
  onError?: (err: ReturnType<typeof toApiError>, args: TArgs) => void;
}) {
  const [isPending, setPending] = useState(false);

  const run = useCallback(
    async (args: TArgs) => {
      setPending(true);
      opts.apply?.(args);
      try {
        const res: any = await opts.mutate(args);
        if (res && res.error) throw res.error;
        if (opts.successMessage && !opts.silent) toast.success(opts.successMessage);
        opts.onSuccess?.(res?.data ?? null, args);
        return { data: res?.data ?? null, error: null };
      } catch (e) {
        const apiErr = toApiError(e);
        opts.rollback?.(args);
        if (!opts.silent) toast.error(opts.errorMessage || apiErr.message);
        opts.onError?.(apiErr, args);
        return { data: null, error: apiErr };
      } finally {
        setPending(false);
      }
    },
    [opts]
  );

  return { run, isPending };
}