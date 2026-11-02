import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { staffErrorMessage } from "@/lib/staff-utils";

/**
 * For office staff the manager has approved to act as administrators. Admin mode is off by
 * default; switching it on unlocks the admin screens (plans, content, staff accounts) and is
 * recorded in the audit log. Real administrators never see this.
 */
export function AdminModeSwitch({ compact = false }: { compact?: boolean }) {
  const { canSwitchToAdmin, adminMode, setAdminMode } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!canSwitchToAdmin) return null;

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      await setAdminMode(!adminMode);
    } catch (e) {
      setError(staffErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={
        "flex flex-wrap items-center justify-between gap-3 rounded-md border px-4 py-3 " +
        (adminMode ? "border-primary/50 bg-primary/5" : "border-border bg-card")
      }
    >
      <div className="min-w-0 text-sm">
        <p className="font-semibold">
          {adminMode ? "Admin mode is on" : "Working as staff"}
        </p>
        {!compact && (
          <p className="text-xs text-muted-foreground">
            {adminMode
              ? "You can manage plans, site content and create staff accounts. Switch it off when you are done."
              : "Switch to admin mode to manage plans, site content and create staff accounts. Each switch is logged."}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-1 text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
      <Button
        size="sm"
        variant={adminMode ? "outline" : "default"}
        disabled={busy}
        onClick={() => void toggle()}
      >
        {busy
          ? "Please wait…"
          : adminMode
            ? "Switch to staff"
            : "Switch to admin"}
      </Button>
    </div>
  );
}
