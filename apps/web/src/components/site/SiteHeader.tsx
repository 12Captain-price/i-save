import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "./Logo";
import { NAV } from "./nav";
import { buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const { session } = useAuth();

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
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Logo />
        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex gap-8 text-sm font-medium text-muted-foreground">
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
        <div className="hidden items-center gap-6 lg:flex">
          {session ? (
            <a
              href="/account"
              className={cn(
                buttonVariants({ size: "sm" }),
                "px-5 py-2.5 text-sm",
              )}
            >
              My account
            </a>
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
        <button
          ref={trigger}
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-border lg:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen(!open)}
        >
          {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </div>
      {open && (
        <nav
          id="mobile-nav"
          aria-label="Mobile"
          className="max-h-[calc(100dvh-76px)] overflow-y-auto border-t border-border bg-background px-6 pb-6 lg:hidden"
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
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
