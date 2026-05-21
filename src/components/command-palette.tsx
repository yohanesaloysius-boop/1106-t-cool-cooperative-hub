import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { navGroups } from "@/routes/_authenticated";
import { useAuth } from "@/hooks/use-auth";
import { LogOut, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { isPengurus, signOut } = useAuth();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const visibleGroups = navGroups
    .filter((g) => !g.adminOnly || isPengurus)
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.adminOnly || isPengurus) }));

  const go = (to: string) => {
    setOpen(false);
    navigate({ to });
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="hidden md:inline-flex items-center gap-2 rounded-full text-muted-foreground"
        aria-label="Cari menu (Ctrl+K)"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="text-xs">Cari menu…</span>
        <kbd className="ml-1 hidden lg:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 text-[10px] font-mono">
          ⌘K
        </kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Cari halaman, tindakan…" />
        <CommandList>
          <CommandEmpty>Tidak ditemukan.</CommandEmpty>
          {visibleGroups.map((g) => (
            <CommandGroup key={g.id} heading={g.label}>
              {g.items.map((i) => (
                <CommandItem
                  key={i.to}
                  value={`${g.label} ${i.label} ${i.to}`}
                  onSelect={() => go(i.to)}
                >
                  <i.icon className="mr-2 h-4 w-4" />
                  {i.label}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
          <CommandSeparator />
          <CommandGroup heading="Akun">
            <CommandItem
              value="logout keluar signout"
              onSelect={() => {
                setOpen(false);
                void signOut();
              }}
            >
              <LogOut className="mr-2 h-4 w-4" /> Keluar
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
