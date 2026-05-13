import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, RotateCw } from "lucide-react";

export function TableToolbar({
  search,
  onSearch,
  onRefresh,
  placeholder = "Cari...",
  loading,
  right,
}: {
  search: string;
  onSearch: (v: string) => void;
  onRefresh?: () => void;
  placeholder?: string;
  loading?: boolean;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-3">
      <div className="relative flex-1 min-w-[180px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={placeholder}
          className="pl-8"
        />
      </div>
      {onRefresh && (
        <Button variant="outline" size="icon" onClick={onRefresh} disabled={loading}>
          <RotateCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      )}
      {right}
    </div>
  );
}

export function TablePagination({
  page,
  totalPages,
  count,
  pageSize,
  onPage,
}: {
  page: number;
  totalPages: number;
  count: number;
  pageSize: number;
  onPage: (p: number) => void;
}) {
  const from = count === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, count);
  return (
    <div className="flex items-center justify-between mt-3 text-sm">
      <span className="text-muted-foreground">
        {from}–{to} dari {count}
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
        >
          Sebelumnya
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages}
        >
          Berikutnya
        </Button>
      </div>
    </div>
  );
}