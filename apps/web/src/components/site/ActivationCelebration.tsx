import { useEffect, useRef, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { FallingPieces, readSeen, writeSeen } from "@/components/ui/motion";
import type { Profile } from "@/lib/auth";

/**
 * Watches the member's own status. When a member who was last seen waiting for activation is
 * now active, the database has confirmed it, and this plays a bigger celebration with the
 * member number card flipping in. It plays once per member.
 */
export function ActivationWatcher({ profile }: { profile: Profile }) {
  const [show, setShow] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const key = `isave:last-status:${profile.id}`;

  useEffect(() => {
    const before = readSeen(key);
    if (profile.status === "active" && before === "pending") setShow(true);
    if (before !== profile.status) writeSeen(key, profile.status);
  }, [key, profile.status]);

  useEffect(() => {
    if (!show) return;
    button.current?.focus();
    const timer = window.setTimeout(() => setShow(false), 12000);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShow(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, [show]);

  if (!show) return null;
  return (
    <div
      className="welcome-overlay print:hidden fixed inset-0 z-[85] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      onClick={() => setShow(false)}
    >
      <FallingPieces kind="confetti" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="activated-title"
        className="welcome-card relative z-[90] w-full max-w-md rounded-2xl border border-border bg-card px-6 py-8 text-center shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          id="activated-title"
          className="font-display text-2xl font-semibold md:text-3xl"
        >
          You’re officially a member <span aria-hidden="true">🎊</span>
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account is now active. You can start saving.
        </p>
        <div className="flip-stage mt-6">
          <div className="flip-card mx-auto max-w-xs rounded-xl border border-primary/50 bg-gradient-to-br from-primary/25 to-surface-deep p-5 text-left shadow-xl">
            <p className="text-[0.7rem] font-semibold tracking-[0.2em] text-primary uppercase">
              i-Save member
            </p>
            <p className="mt-5 font-display text-xl font-semibold">
              {profile.fullName}
            </p>
            <p className="mt-1 font-mono text-sm tracking-widest text-muted-foreground">
              {profile.memberNumber}
            </p>
          </div>
        </div>
        <button
          ref={button}
          type="button"
          className={buttonVariants({ className: "mt-7 w-full sm:w-auto" })}
          onClick={() => setShow(false)}
        >
          Let’s start saving 🚀
        </button>
      </div>
    </div>
  );
}
