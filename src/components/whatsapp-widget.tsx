import { useState } from "react";
import { MessageCircle, X, Send } from "lucide-react";
import { cn } from "@/lib/utils";

const PHONE = "6281959171997"; // 0819 5917 1997
const DISPLAY = "0819 5917 1997";
const DEFAULT_MSG =
  "Halo Customer Service T-COOL Koperasi, saya butuh bantuan terkait:";

export function WhatsAppWidget() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  const send = (msg?: string) => {
    const body = encodeURIComponent((msg ?? text ?? "").trim() || DEFAULT_MSG);
    window.open(`https://wa.me/${PHONE}?text=${body}`, "_blank", "noopener,noreferrer");
    setOpen(false);
    setText("");
  };

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Hubungi via WhatsApp"
        className={cn(
          "fixed bottom-36 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-all hover:scale-105 active:scale-95 lg:bottom-24 lg:right-6",
          open && "rotate-90",
        )}
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {open && (
        <div className="fixed inset-x-3 bottom-52 z-40 overflow-hidden rounded-2xl border border-border bg-background shadow-2xl animate-fade-in sm:inset-x-auto sm:right-4 sm:w-[340px] lg:right-6 lg:bottom-44">
          <div className="flex items-center gap-3 bg-[#25D366] px-4 py-3 text-white">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">Customer Service T-COOL</p>
              <p className="text-xs text-white/90">WhatsApp · {DISPLAY}</p>
            </div>
          </div>

          <div className="space-y-3 p-4">
            <div className="rounded-xl rounded-tl-sm bg-muted px-3 py-2 text-sm">
              Halo! 👋 Saya CS T-COOL Koperasi. Ada yang bisa saya bantu? Klik kirim untuk lanjut chat di WhatsApp.
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[
                "Info pendaftaran anggota",
                "Bantuan simpanan",
                "Bantuan pinjaman",
                "Verifikasi akun",
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs hover:bg-muted"
                >
                  {q}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="flex items-center gap-2"
            >
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Tulis pesan..."
                className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#25D366]/40"
              />
              <button
                type="submit"
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#25D366] text-white hover:opacity-90"
                aria-label="Kirim ke WhatsApp"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
            <p className="text-center text-[10px] text-muted-foreground">
              Akan dibuka di WhatsApp. CS akan menjawab otomatis & dilanjutkan oleh tim.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
