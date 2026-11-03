import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useIdleTimeout } from "@/lib/idle";
import { cn } from "@/lib/utils";

/**
 * Account safety for everyone who is signed in, members and staff alike.
 * After IDLE_LIMIT_MS with no activity the person is signed out. During the last
 * WARN_MS a progress bar counts down; any movement, tap or key press cancels it.
 * To change the timing, change only these two numbers.
 */
const IDLE_LIMIT_MS = 5 * 60 * 1000;
const WARN_MS = 60 * 1000;
const WARN_SECONDS = WARN_MS / 1000;

export function SessionGuard() {
  const { session, signOut } = useAuth();
  const navigate = useNavigate();
  const [signedOutForSafety, setSignedOutForSafety] = useState(false);

  const { secondsLeft } = useIdleTimeout({
    timeoutMs: IDLE_LIMIT_MS,
    warnMs: WARN_MS,
    enabled: Boolean(session),
    // Activity in any open tab keeps every tab signed in.
    shareKey: "isave:last-activity",
    onTimeout: () => {
      setSignedOutForSafety(true);
      void signOut();
      void navigate({ to: "/login" });
    },
  });

  // The notice disappears by itself, and as soon as the person logs in again.
  useEffect(() => {
    if (!signedOutForSafety) return;
    if (session) {
      setSignedOutForSafety(false);
      return;
    }
    const timer = window.setTimeout(() => setSignedOutForSafety(false), 12_000);
    return () => window.clearTimeout(timer);
  }, [signedOutForSafety, session]);

  if (session && secondsLeft !== null) {
    const percent = Math.max(0, Math.min(100, (secondsLeft / WARN_SECONDS) * 100));
    const urgent = secondsLeft <= 10;
    return (
      <div className="print:hidden fixed inset-x-0 top-0 z-[70]">
        <div
          role="progressbar"
          aria-label="Time left before you are signed out"
          aria-valuemin={0}
          aria-valuemax={WARN_SECONDS}
          aria-valuenow={secondsLeft}
          className="h-2 w-full bg-muted"
        >
          <div
            className={cn(
              "h-full transition-[width,background-color] duration-1000 ease-linear",
              urgent ? "bg-destructive" : "bg-primary",
            )}
            style={{ width: `${percent}%` }}
          />
        </div>
        <div
          role="alert"
          className="mx-auto mt-3 flex max-w-lg flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-2xl sm:flex-row sm:items-center"
        >
          <p className="flex-1 text-sm">
            <span aria-hidden="true">⏳ </span>
            Still there? For your safety you will be signed out soon.{" "}
            <strong aria-hidden="true" className="tabular-nums">
              {secondsLeft}s
            </strong>
          </p>
          {/* Pressing this counts as activity, which cancels the countdown. */}
          <Button size="sm">Stay signed in</Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void signOut();
              void navigate({ to: "/" });
            }}
          >
            Log out now
          </Button>
        </div>
      </div>
    );
  }

  if (!session && signedOutForSafety) {
    return (
      <div className="print:hidden fixed inset-x-0 top-4 z-[70] px-4">
        <div
          role="status"
          className="mx-auto flex max-w-lg items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-2xl"
        >
          <ShieldCheck
            aria-hidden="true"
            className="mt-0.5 size-5 shrink-0 text-primary"
          />
          <p className="flex-1 text-sm">
            You were signed out because you were away for a while. This keeps
            your account safe. Log in again whenever you are ready.
          </p>
          <button
            type="button"
            aria-label="Close this message"
            className="rounded-md p-1 text-muted-foreground hover:text-foreground"
            onClick={() => setSignedOutForSafety(false)}
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
      </div>
    );
  }

  return null;
}
