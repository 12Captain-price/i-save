import { useEffect, useRef, useState } from "react";
import { LogOut, Menu, X } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { Logo } from "./Logo";
import { InstallButton } from "./InstallButton";
import { NAV } from "./nav";
import { CountBadge } from "./Tags";
import { Button, buttonVariants } from "@/components/ui/button";
import { useSignOutWithGoodbye } from "@/components/site/GoodbyeToast";
import { Avatar } from "@/components/ui/motion";
import { useAuth } from "@/lib/auth";
import { SECTION_OF, useUpdateCounts } from "@/lib/update-counts";
import { badgeText } from "@/lib/updates";
import { cn } from "@/lib/utils";
import { firstNameOf } from "@/lib/welcome";

/** "Hi, Tanaka 👋" with a round initials avatar. On small screens only the avatar shows. */
function GreetingChip({
  name,
  compact = false,
  wide = false,
}: {
  name: string;
  compact?: boolean;
  /** On desktop, show the greeting text only when the screen is very wide. */
  wide?: boolean;
}) {
  const first = firstNameOf(name);
  return (
    <a
      href="/staff"
      aria-label={`Hi, ${first}. Open the admin area`}
      className={cn(
        "greet-chip inline-flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 text-sm font-semibold whitespace-nowrap hover:border-primary",
        wide ? "pr-1 2xl:pr-3" : "pr-3",
      )}
    >
      <Avatar name={name} size={32} />
      <span
        className={
          wide ? "hidden 2xl:inline" : compact ? "hidden sm:inline" : undefined
        }
      >
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
  const counts = useUpdateCounts();

  /** The number of new items behind a menu link, or 0 for links with no badge. */
  const newIn = (href: string) => {
    const section = SECTION_OF[href];
    return section ? counts[section] : 0;
  };

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
      <div className="mx-auto flex max-w-[96rem] items-center justify-between gap-6 px-6 py-4">
        <Logo />
        <nav aria-label="Main" className="hidden xl:block">
          <ul className="flex gap-5 text-sm font-medium whitespace-nowrap text-muted-foreground 2xl:gap-7">
            {NAV.map((n) => (
              <li key={n.href}>
                <a
                  href={n.href}
                  className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
                >
                  {n.label}
                  {newIn(n.href) > 0 && (
                    <CountBadge
                      text={badgeText(newIn(n.href))}
                      label={`${newIn(n.href)} new`}
                    />
                  )}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="hidden shrink-0 items-center gap-3 xl:flex 2xl:gap-4">
          <InstallButton compact />
          {session ? (
            <>
              {profile && <GreetingChip name={profile.fullName} wide />}
              <a
                href="/staff"
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "px-5 py-2.5 text-sm whitespace-nowrap",
                )}
              >
                Admin
              </a>
              <Button
                variant="outline"
                size="sm"
                className="px-4 py-2.5 text-sm whitespace-nowrap"
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
                className="text-sm font-semibold whitespace-nowrap hover:text-primary"
              >
                Log in
              </a>
              <a
                href="/apply"
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "px-5 py-2.5 text-sm whitespace-nowrap",
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
          <button
            ref={trigger}
            type="button"
            className="relative inline-flex h-11 w-11 items-center justify-center rounded-md border border-border"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen(!open)}
          >
            {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
            {!open && counts.total > 0 && (
              <CountBadge
                text={badgeText(counts.total)}
                label={`${counts.total} new updates`}
                className="absolute -top-1.5 -right-1.5 ring-2 ring-background"
              />
            )}
          </button>
        </div>
      </div>
      {open && (
        <nav
          id="mobile-nav"
          aria-label="Mobile"
          className="max-h-[calc(100dvh-76px)] overflow-y-auto border-t border-border bg-background px-6 pb-24 xl:hidden"
        >
          <ul className="flex flex-col py-2">
            {NAV.map((n) => (
              <li key={n.href}>
                <a
                  href={n.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 border-b border-border/50 py-4 font-display text-lg"
                >
                  {n.label}
                  {newIn(n.href) > 0 && (
                    <CountBadge
                      text={badgeText(newIn(n.href))}
                      label={`${newIn(n.href)} new`}
                    />
                  )}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <InstallButton size="default" className="w-full" />
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {session ? (
              <>
                <a href="/staff" className={cn(buttonVariants())}>
                  Admin
                </a>
                <Button
                  variant="outline"
                  className="sm:col-span-2"
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
