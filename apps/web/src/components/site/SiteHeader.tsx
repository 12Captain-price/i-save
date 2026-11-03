import { useEffect, useRef, useState } from "react";
import { LogOut, Menu, X } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { Logo } from "./Logo";
import { InstallButton } from "./InstallButton";
import { NAV } from "./nav";
import { Button, buttonVariants } from "@/components/ui/button";
import { useSignOutWithGoodbye } from "@/components/site/GoodbyeToast";
import { Avatar } from "@/components/ui/motion";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { firstNameOf } from "@/lib/welcome";

/** "Hi, Tanaka 👋" with a round initials avatar. On small screens only the avatar shows. */
function GreetingChip({
  name,
  compact = false,
}: {
  name: string;
  compact?: boolean;
}) {
  const first = firstNameOf(name);
  return (
    <a
      href="/account"
      aria-label={`Hi, ${first}. Open my account`}
      className="greet-chip inline-flex items-center gap-2 rounded-full border border-border bg-card py-1 pr-3 pl-1 text-sm font-semibold hover:border-primary"
    >
      <Avatar name={name} size={32} />
      <span className={compact ? "hidden sm:inline" : undefined}>
        Hi, {first} <span aria-hidden="true">👋</span>
      </span>
    </a>
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const { session, profile } = useAuth();
  const signOut = useSignOutWithGoodbye();
  const navigate = useNavigate();

  async function logOut() {
    setOpen(false);
    await signOut();
    await navigate({ to: "/" });
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="print:hidden sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Logo />
        <nav aria-label="Main" className="hidden xl:block">
          <ul className="flex gap-6 text-sm font-medium text-muted-foreground">
            {NAV.map((n) => (
              <li key={n.href}>
                <a
                  href={n.href}
                  className="transition-colors hover:text-foreground"
                >
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="hidden items-center gap-6 xl:flex">
          <InstallButton />
          {session ? (
            <>
              {profile && <GreetingChip name={profile.fullName} />}
              <a
                href="/account"
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "px-5 py-2.5 text-sm",
                )}
              >
                My account
              </a>
              <Button
                variant="outline"
                size="sm"
                className="px-4 py-2.5 text-sm"
                onClick={() => void logOut()}
              >
                <LogOut aria-hidden="true" />
                Log out
              </Button>
            </>
          ) : (
            <>
              <a
                href="/login"
                className="text-sm font-semibold hover:text-primary"
              >
                Log in
              </a>
              <a
                href="/apply"
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "px-5 py-2.5 text-sm",
                )}
              >
                Apply for membership
              </a>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 xl:hidden">
          {session && profile && (
            <GreetingChip name={profile.fullName} compact />
          )}
          {session && (
            <Button
              variant="outline"
              className="h-11 px-3"
              aria-label="Log out"
              onClick={() => void logOut()}
            >
              <LogOut aria-hidden="true" />
              <span className="hidden sm:inline">Log out</span>
            </Button>
          )}
          <button
            ref={trigger}
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-border"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen(!open)}
          >
            {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
      </div>
      {open && (
        <nav
          id="mobile-nav"
          aria-label="Mobile"
          className="max-h-[calc(100dvh-76px)] overflow-y-auto border-t border-border bg-background px-6 pb-6 xl:hidden"
        >
          <ul className="flex flex-col py-2">
            {NAV.map((n) => (
              <li key={n.href}>
                <a
                  href={n.href}
                  onClick={() => setOpen(false)}
                  className="block border-b border-border/50 py-4 font-display text-lg"
                >
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <InstallButton size="default" className="w-full" />
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {session ? (
              <a href="/account" className={cn(buttonVariants())}>
                My account
              </a>
            ) : (
              <>
                <a
                  href="/login"
                  className={cn(buttonVariants({ variant: "outline" }))}
                >
                  Log in
                </a>
                <a href="/apply" className={cn(buttonVariants())}>
                  Apply for membership
                </a>
              </>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
