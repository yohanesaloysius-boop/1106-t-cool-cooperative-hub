import { useEffect, useState } from "react";
import { UserPlus, X } from "lucide-react";

const NAMES = ["Dewi", "Yohanes", "Budi", "Maria", "Andi", "Rina", "David", "Sarah", "Putu", "Wayan", "Made", "Nyoman"];
const TIMES = [
  "23 jam yang lalu",
  "32 jam yang lalu",
  "1 hari yang lalu",
  "2 hari yang lalu",
  "3 hari yang lalu",
  "4 hari yang lalu",
  "5 hari yang lalu",
  "6 hari yang lalu",
  "1 minggu yang lalu",
];
const MESSAGES = [
  "baru saja mendaftar menjadi anggota koperasi kami.",
  "telah bergabung menjadi bagian dari keluarga besar koperasi kami.",
];

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

interface Item {
  id: number;
  name: string;
  time: string;
  message: string;
}

export function SocialProofNotification() {
  const [item, setItem] = useState<Item | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout>;
    let nextTimer: ReturnType<typeof setTimeout>;
    let mounted = true;

    const show = () => {
      if (!mounted) return;
      setItem({
        id: Date.now(),
        name: pick(NAMES),
        time: pick(TIMES),
        message: pick(MESSAGES),
      });
      setVisible(true);
      const dur = 5000 + Math.random() * 5000; // 5-10s
      hideTimer = setTimeout(() => {
        if (!mounted) return;
        setVisible(false);
        const gap = 15000 + Math.random() * 15000; // 15-30s
        nextTimer = setTimeout(show, gap);
      }, dur);
    };

    const initial = setTimeout(show, 4000);
    return () => {
      mounted = false;
      clearTimeout(initial);
      clearTimeout(hideTimer);
      clearTimeout(nextTimer);
    };
  }, []);

  if (!item) return null;

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 max-w-xs transition-all duration-500 ease-out ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-white p-3 pr-8 shadow-xl ring-1 ring-black/5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <UserPlus className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Aktifitas Baru!</p>
          <p className="text-sm leading-snug text-foreground">
            <span className="font-semibold">{item.name}</span>{" "}
            <span className="text-muted-foreground">{item.message}</span>
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{item.time}</p>
        </div>
        <button
          onClick={() => setVisible(false)}
          className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground/70 transition hover:bg-muted hover:text-foreground"
          aria-label="Tutup notifikasi"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
