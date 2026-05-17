import { useState, useRef, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { askAssistant } from "@/lib/ai-assistant.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, X, Send, Loader2, Bot, User as UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

const QUICK_PROMPTS = [
  "Berapa total simpanan saya?",
  "Simulasi pinjaman 10 juta tenor 12 bulan",
  "Apa itu simpanan wajib?",
  "Kapan SHU dibagikan?",
  "Hubungi admin",
];

const ADMIN_WA_URL = "https://wa.me/6281959171997?text=" + encodeURIComponent("Selamat datang di TCool Koperasi");

export function AiAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Halo! Saya T-Cool Assistant 🌿\nTanyakan saldo, simulasi pinjaman, atau hal lain seputar koperasi." },
  ]);
  const ask = useServerFn(askAssistant);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;
    if (content.toLowerCase() === "hubungi admin") {
      window.open(ADMIN_WA_URL, "_blank", "noopener,noreferrer");
      return;
    }
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await ask({ data: { messages: next.slice(-12) } });
      setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Maaf, terjadi kesalahan. Coba lagi." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Launcher */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Buka asisten AI"
        className={cn(
          "fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition-all hover:scale-105 active:scale-95 lg:bottom-6 lg:right-6",
          open ? "rotate-90" : "animate-pulse-soft",
        )}
        style={{ background: "var(--gradient-primary)" }}
      >
        {open ? <X className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed inset-x-3 bottom-36 z-40 flex max-h-[70vh] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl animate-fade-in sm:inset-x-auto sm:right-4 sm:bottom-36 sm:w-[380px] lg:right-6 lg:bottom-24">
          <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl text-white" style={{ background: "var(--gradient-primary)" }}>
              <Bot className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">T-Cool Assistant</p>
              <p className="text-xs text-muted-foreground">Selalu siap membantu</p>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((m, i) => (
              <div key={i} className={cn("flex gap-2", m.role === "user" && "flex-row-reverse")}>
                <div className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white",
                  m.role === "user" ? "bg-foreground/80" : "",
                )} style={m.role === "assistant" ? { background: "var(--gradient-primary)" } : undefined}>
                  {m.role === "user" ? <UserIcon className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                </div>
                <div className={cn(
                  "max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm",
                  m.role === "user" ? "rounded-tr-sm bg-primary text-primary-foreground" : "rounded-tl-sm bg-muted text-foreground",
                )}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full text-white" style={{ background: "var(--gradient-primary)" }}>
                  <Bot className="h-3.5 w-3.5" />
                </div>
                <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm bg-muted px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> mengetik...
                </div>
              </div>
            )}
          </div>

          {messages.length <= 1 && (
            <div className="flex flex-wrap gap-1.5 border-t border-border px-3 py-2">
              {QUICK_PROMPTS.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs text-foreground/80 hover:bg-muted"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={(e) => { e.preventDefault(); send(input); }}
            className="flex items-center gap-2 border-t border-border bg-card p-3"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Tanya apa saja..."
              disabled={loading}
              className="flex-1"
            />
            <Button type="submit" size="icon" disabled={loading || !input.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
