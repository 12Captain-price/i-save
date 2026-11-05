import { Logo } from "./Logo";

export function SiteFooter() {
  return (
    <footer className="print:hidden border-t border-border bg-surface-deep">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-6 py-14 text-center">
        <Logo />
        <p className="font-display text-2xl font-semibold sm:text-3xl">
          Saving today for a better tomorrow
        </p>
      </div>
      <div className="border-t border-border pt-6 pb-24 sm:pb-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-center gap-3 px-6 text-xs text-muted-foreground sm:flex-row sm:gap-4">
          <span>&copy; {new Date().getFullYear()} i-Save</span>
          <span className="hidden sm:inline" aria-hidden="true">
            ·
          </span>
          <span className="flex flex-col items-center gap-2 sm:flex-row sm:gap-3">
            An initiative of
            <img
              src="/images/zpyf-logo.webp"
              alt="Zimbabwe Progressive Youth Foundation"
              width={300}
              height={200}
              className="h-16 w-auto rounded-md bg-foreground/95 px-2 py-1 sm:h-20"
            />
          </span>
        </div>
      </div>
    </footer>
  );
}
