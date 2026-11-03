import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/motion";
import { GOODBYE_EVENT, rememberGoodbye, takeGoodbye } from "@/lib/goodbye";
import { useAuth } from "@/lib/auth";
import { firstNameOf } from "@/lib/welcome";

const SHOW_MS = 3800;

/** Signs the person out and says goodbye by name. Use this wherever there is a Log out button. */
export function useSignOutWithGoodbye(): () => Promise<void> {
  const { profile, signOut } = useAuth();
  const name = profile?.fullName;
  return async () => {
    if (name) rememberGoodbye(firstNameOf(name));
    await signOut();
  };
}

/** The "See you soon, Tanaka" message. Mounted once at the top of the app. */
export function GoodbyeToast() {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    const check = () => {
      const next = takeGoodbye();
      if (next) setName(next);
    };
    check();
    window.addEventListener(GOODBYE_EVENT, check);
    return () => window.removeEventListener(GOODBYE_EVENT, check);
  }, []);

  useEffect(() => {
    if (!name) return;
    const timer = window.setTimeout(() => setName(null), SHOW_MS);
    return () => window.clearTimeout(timer);
  }, [name]);

  if (!name) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[90] flex justify-center px-4 print:hidden">
      <div
        role="status"
        className="goodbye-toast flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-3 shadow-2xl"
      >
        <Avatar name={name} size={36} />
        <p className="text-sm">
          <strong className="font-display">See you soon, {name}</strong>{" "}
          <span aria-hidden="true">👋</span>
          <span className="block text-xs text-muted-foreground">
            Stay safe.
          </span>
        </p>
      </div>
    </div>
  );
}
