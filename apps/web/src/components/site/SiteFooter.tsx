import { Logo } from "./Logo";
import { INFO_LINKS, NAV } from "./nav";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface-deep">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 md:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm text-muted-foreground">
            Structured savings for members of a Zimbabwean savings organisation.
          </p>
          <p className="mt-6 text-sm">
            <a href="/contact" className="text-primary hover:underline">
              Contact the team
            </a>
          </p>
        </div>
        <nav aria-label="Footer">
          <h3 className="mb-4 text-sm font-semibold">Explore</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {NAV.map((n) => (
              <li key={n.href}>
                <a href={n.href} className="hover:text-foreground">
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Information">
          <h3 className="mb-4 text-sm font-semibold">Information</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {INFO_LINKS.map((n) => (
              <li key={n.href}>
                <a href={n.href} className="hover:text-foreground">
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="border-t border-border py-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-center gap-3 px-6 text-xs text-muted-foreground sm:flex-row sm:gap-4">
          <span>&copy; {new Date().getFullYear()} i-Save</span>
          <span className="hidden sm:inline" aria-hidden="true">
            ·
          </span>
          <span className="flex items-center gap-2">
            An initiative of
            <img
              src="/images/zpyf-logo.webp"
              alt="Zimbabwe Progressive Youth Foundation"
              width={300}
              height={200}
              className="h-7 w-auto rounded-sm bg-foreground/95 px-1"
            />
          </span>
        </div>
      </div>
    </footer>
  );
}
