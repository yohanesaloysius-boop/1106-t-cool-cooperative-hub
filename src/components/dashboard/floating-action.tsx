import { useState } from "react";
import { Plus, PiggyBank, HandCoins, Receipt, X } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const actions = [
  { label: "Setor Simpanan", icon: PiggyBank, to: "/simpanan" as const },
  { label: "Ajukan Pinjaman", icon: HandCoins, to: "/pinjaman" as const },
  { label: "Bayar Angsuran", icon: Receipt, to: "/angsuran" as const },
];

export function FloatingActionButton() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  return (
    <div className="fixed bottom-20 right-4 z-40 flex flex-col items-end gap-3 lg:bottom-8 lg:right-8">
      {open && (
        <div className="flex flex-col items-end gap-2 animate-fade-in">
          {actions.map((a, i) => (
            <button
              key={a.to}
              onClick={() => { setOpen(false); navigate({ to: a.to }); }}
              className="group flex items-center gap-2 rounded-full bg-card pr-4 pl-2 py-2 text-sm font-medium shadow-lg transition-transform hover:scale-105"
              style={{ animationDelay: `${i * 40}ms`, boxShadow: "var(--shadow-elegant)" }}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <a.icon className="h-4 w-4" />
              </span>
              {a.label}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Aksi cepat"
        className={cn("flex h-14 w-14 items-center justify-center rounded-full text-primary-foreground transition-transform hover:scale-110 active:scale-95", open && "rotate-45")}
        style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-elegant)" }}
      >
        {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
      </button>
    </div>
  );
}
