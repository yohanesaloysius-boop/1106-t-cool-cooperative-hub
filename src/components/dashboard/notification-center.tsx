import { useEffect, useState } from "react";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { useNavigate } from "@tanstack/react-router";

interface Notif {
  id: string;
  judul: string;
  pesan: string;
  kategori: string;
  url: string | null;
  is_read: boolean;
  created_at: string;
}

const kategoriColor: Record<string, string> = {
  info: "bg-primary/15 text-primary",
  success: "bg-success/15 text-success",
  warning: "bg-warning/20 text-warning",
  error: "bg-destructive/15 text-destructive",
};

export function NotificationCenter() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("notifications").select("id,judul,pesan,kategori,url,is_read,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20);
    setItems((data ?? []) as Notif[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    load();
    const ch = supabase
      .channel(`notif-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const unread = items.filter((i) => !i.is_read).length;

  const markAll = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ is_read: true, read_at: new Date().toISOString() }).eq("user_id", user.id).eq("is_read", false);
    load();
  };

  const open_one = async (n: Notif) => {
    if (!n.is_read) await supabase.from("notifications").update({ is_read: true, read_at: new Date().toISOString() }).eq("id", n.id);
    setOpen(false);
    if (n.url) navigate({ to: n.url });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Notifikasi</p>
            <p className="text-[11px] text-muted-foreground">{unread} belum dibaca</p>
          </div>
          {unread > 0 && (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={markAll}>
              <CheckCheck className="mr-1 h-3 w-3" />Tandai semua
            </Button>
          )}
        </div>
        <ScrollArea className="h-80">
          {loading ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div>
          ) : items.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
              <Bell className="h-8 w-8 opacity-40" />
              <p>Belum ada notifikasi</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((n) => (
                <li key={n.id}>
                  <button onClick={() => open_one(n)} className={cn("flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50", !n.is_read && "bg-primary/5")}>
                    <span className={cn("mt-0.5 inline-flex h-2 w-2 shrink-0 rounded-full", n.is_read ? "bg-transparent" : "bg-primary")} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium">{n.judul}</p>
                        <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase", kategoriColor[n.kategori] ?? "bg-muted text-muted-foreground")}>{n.kategori}</span>
                      </div>
                      <p className="line-clamp-2 text-xs text-muted-foreground">{n.pesan}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString("id-ID")}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
