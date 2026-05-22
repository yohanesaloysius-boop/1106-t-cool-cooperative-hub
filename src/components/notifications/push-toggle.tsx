import { useBrowserNotifications } from "@/hooks/use-browser-notifications";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, BellRing } from "lucide-react";
import { toast } from "sonner";

export function PushToggle({ variant = "outline" }: { variant?: "outline" | "ghost" | "secondary" }) {
  const { user } = useAuth();
  const { supported, permission, enabled, request, disable } = useBrowserNotifications(user?.id);

  if (!supported) return null;

  if (permission === "denied") {
    return (
      <Button variant={variant} size="sm" disabled title="Notifikasi diblokir di pengaturan browser">
        <BellOff className="h-4 w-4" /> Notif diblokir
      </Button>
    );
  }

  if (enabled && permission === "granted") {
    return (
      <Button variant={variant} size="sm" onClick={() => { disable(); toast.info("Notifikasi browser dimatikan"); }}>
        <BellRing className="h-4 w-4 text-primary" /> Notif aktif
      </Button>
    );
  }

  return (
    <Button
      variant={variant}
      size="sm"
      onClick={async () => {
        const ok = await request();
        if (ok) toast.success("Notifikasi browser diaktifkan");
        else toast.error("Izin notifikasi ditolak");
      }}
    >
      <Bell className="h-4 w-4" /> Aktifkan notifikasi
    </Button>
  );
}
