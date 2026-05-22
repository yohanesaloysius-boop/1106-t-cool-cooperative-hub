import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "tcool_browser_notif_enabled";

export function useBrowserNotifications(userId?: string | null) {
  const supported = typeof window !== "undefined" && "Notification" in window;
  const [permission, setPermission] = useState<NotificationPermission>(
    supported ? Notification.permission : "default"
  );
  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY) === "1";
  });

  const request = useCallback(async () => {
    if (!supported) return false;
    const p = await Notification.requestPermission();
    setPermission(p);
    if (p === "granted") {
      localStorage.setItem(STORAGE_KEY, "1");
      setEnabled(true);
      return true;
    }
    return false;
  }, [supported]);

  const disable = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setEnabled(false);
  }, []);

  // Realtime subscribe to notifications table → show browser notification
  useEffect(() => {
    if (!supported || !enabled || permission !== "granted" || !userId) return;

    const ch = supabase
      .channel(`browser-notif-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const row: any = payload.new;
          if (!row) return;
          try {
            const n = new Notification(row.judul ?? "T-COOL", {
              body: row.pesan ?? "",
              icon: "/favicon.ico",
              tag: row.id,
            });
            n.onclick = () => {
              window.focus();
              if (row.url) window.location.href = row.url;
              n.close();
            };
          } catch {
            // ignored
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [supported, enabled, permission, userId]);

  return { supported, permission, enabled, request, disable };
}
