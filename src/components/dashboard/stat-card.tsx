import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

interface StatCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  format?: "currency" | "number";
  trend?: number;
  hint?: string;
  accent?: "primary" | "success" | "warning" | "destructive";
  loading?: boolean;
}

const fmtIDR = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const fmtNum = new Intl.NumberFormat("id-ID");

function useCountUp(target: number, duration = 900) {
  const [val, setVal] = useState(0);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(0);
  useEffect(() => {
    const from = fromRef.current;
    startRef.current = null;
    let raf = 0;
    const step = (t: number) => {
      if (startRef.current === null) startRef.current = t;
      const p = Math.min(1, (t - startRef.current) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(from + (target - from) * eased);
      if (p < 1) raf = requestAnimationFrame(step);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

const accentMap = {
  primary: "from-primary/15 to-primary/0 text-primary",
  success: "from-success/15 to-success/0 text-success",
  warning: "from-warning/20 to-warning/0 text-warning",
  destructive: "from-destructive/15 to-destructive/0 text-destructive",
};

export function StatCard({ label, value, icon: Icon, format = "currency", trend, hint, accent = "primary", loading }: StatCardProps) {
  const animated = useCountUp(loading ? 0 : value);
  const display = format === "currency" ? fmtIDR.format(Math.round(animated)) : fmtNum.format(Math.round(animated));
  return (
    <Card className="group relative overflow-hidden border-border/60 transition-all hover:-translate-y-0.5 hover:shadow-lg" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br opacity-60", accentMap[accent])} />
      <CardContent className="relative p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <div className={cn("rounded-lg bg-background/70 p-2 backdrop-blur", accentMap[accent].split(" ").pop())}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <p className="mt-3 text-2xl font-bold tracking-tight tabular-nums">
          {loading ? <span className="inline-block h-7 w-32 animate-pulse rounded bg-muted" /> : display}
        </p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="truncate text-[11px] text-muted-foreground">{hint}</p>
          {typeof trend === "number" && (
            <span className={cn("inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold", trend >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
              {trend >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(trend).toFixed(1)}%
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function StatCardSkeleton() {
  return (
    <Card className="border-border/60" style={{ boxShadow: "var(--shadow-card)" }}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="h-3 w-20 animate-pulse rounded bg-muted" />
          <div className="h-8 w-8 animate-pulse rounded-lg bg-muted" />
        </div>
        <div className="mt-4 h-7 w-32 animate-pulse rounded bg-muted" />
        <div className="mt-3 h-3 w-24 animate-pulse rounded bg-muted" />
      </CardContent>
    </Card>
  );
}
