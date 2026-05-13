import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toApiError, type ApiError } from "@/lib/api";

export type SortDir = "asc" | "desc";

export type UseTableOptions<TRow> = {
  /** Supabase table name */
  table: string;
  /** select clause */
  select?: string;
  /** initial page size */
  pageSize?: number;
  /** initial sort column */
  sortBy?: string;
  /** initial sort direction */
  sortDir?: SortDir;
  /** columns used for ILIKE search */
  searchColumns?: string[];
  /** static equality filters (column -> value) */
  filters?: Record<string, unknown>;
  /** apply additional query mutations */
  modify?: (
    q: ReturnType<ReturnType<typeof supabase.from>["select"]>
  ) => ReturnType<ReturnType<typeof supabase.from>["select"]>;
  /** realtime: subscribe to postgres_changes for this table */
  realtime?: boolean;
  /** transform rows after fetch */
  map?: (row: any) => TRow;
};

export function useTable<TRow = any>(opts: UseTableOptions<TRow>) {
  const {
    table,
    select = "*",
    pageSize: initialPageSize = 10,
    sortBy: initialSortBy,
    sortDir: initialSortDir = "desc",
    searchColumns = [],
    filters,
    modify,
    realtime = false,
    map,
  } = opts;

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<string | undefined>(initialSortBy);
  const [sortDir, setSortDir] = useState<SortDir>(initialSortDir);
  const [rows, setRows] = useState<TRow[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const filtersKey = JSON.stringify(filters || {});

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let q: any = (supabase.from(table as any) as any).select(select, { count: "exact" });
      if (filters) {
        for (const [k, v] of Object.entries(filters)) {
          if (v === undefined || v === null || v === "") continue;
          q = q.eq(k, v as any);
        }
      }
      if (search && searchColumns.length) {
        const term = `%${search}%`;
        q = q.or(searchColumns.map((c) => `${c}.ilike.${term}`).join(","));
      }
      if (sortBy) q = q.order(sortBy, { ascending: sortDir === "asc" });
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      q = q.range(from, to);
      if (modify) q = modify(q);
      const { data, error, count } = await q;
      if (error) throw error;
      setRows((map ? (data || []).map(map) : (data || [])) as TRow[]);
      setCount(count || 0);
    } catch (e) {
      setError(toApiError(e));
      setRows([]);
      setCount(0);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, select, page, pageSize, search, sortBy, sortDir, filtersKey]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  useEffect(() => {
    if (!realtime) return;
    const ch = supabase
      .channel(`tbl-${table}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => fetchRows()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [table, realtime, fetchRows]);

  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  const toggleSort = (col: string) => {
    if (sortBy === col) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortBy(col);
      setSortDir("asc");
    }
  };

  return useMemo(
    () => ({
      rows,
      count,
      loading,
      error,
      page,
      pageSize,
      totalPages,
      search,
      sortBy,
      sortDir,
      setPage,
      setPageSize,
      setSearch: (s: string) => {
        setPage(1);
        setSearch(s);
      },
      setSortBy,
      setSortDir,
      toggleSort,
      refetch: fetchRows,
    }),
    [rows, count, loading, error, page, pageSize, totalPages, search, sortBy, sortDir, fetchRows]
  );
}