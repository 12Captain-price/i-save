import type { ReactNode } from "react";
import { PublicLayout } from "./PublicLayout";

/** Standard public content page: eyebrow, title, lead paragraph, then the page body. */
export function PageShell({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
  children: ReactNode;
}) {
  return (
    <PublicLayout>
      <div className="mx-auto max-w-4xl px-6 py-12 md:py-16">
        <p className="mb-3 text-[0.7rem] font-bold tracking-[0.16em] text-primary uppercase">
          {eyebrow}
        </p>
        <h1 className="text-4xl font-semibold md:text-5xl">{title}</h1>
        {lead && (
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">{lead}</p>
        )}
        <div className="mt-10">{children}</div>
      </div>
    </PublicLayout>
  );
}
