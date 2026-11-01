import type { ReactNode } from "react";
import { PageShell } from "./PageShell";

/** Draft legal text. Shows a clear notice until the owner and a lawyer have approved it. */
export const LEGAL_REVIEWED = false;

export function LegalPage({
  eyebrow,
  title,
  lead,
  sections,
  children,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  sections: Array<{ heading: string; body: ReactNode }>;
  children?: ReactNode;
}) {
  return (
    <PageShell eyebrow={eyebrow} title={title} lead={lead}>
      {!LEGAL_REVIEWED && (
        <p
          role="status"
          className="mb-10 rounded-md border border-border bg-card p-5 text-sm text-muted-foreground"
        >
          <strong className="text-foreground">Draft.</strong> This text is
          waiting for the organisation’s approval and a legal review. It
          describes how the system works today and may change before launch.
        </p>
      )}
      <div className="grid gap-8">
        {sections.map((s, i) => (
          <section key={s.heading}>
            <h2 className="text-lg font-semibold">
              {i + 1}. {s.heading}
            </h2>
            <div className="mt-2 space-y-3 text-sm text-muted-foreground">
              {s.body}
            </div>
          </section>
        ))}
      </div>
      {children}
    </PageShell>
  );
}
