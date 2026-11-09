import type { ReactNode } from "react";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { BackToTop } from "./BackToTop";

export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <a href="#public-main" className="skip-link print:hidden">
        Skip to main content
      </a>
      <SiteHeader />
      <main id="public-main" tabIndex={-1}>
        {children}
      </main>
      <SiteFooter />
      <BackToTop />
    </div>
  );
}
