import { PageShell } from "./PageShell";

/** Clearly marked placeholder for pages whose final text is waiting on the owner or a lawyer. */
export function PlaceholderPage({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}) {
  return (
    <PageShell eyebrow={eyebrow} title={title}>
      <p
        role="status"
        className="rounded-md border border-border bg-card p-6 text-sm text-muted-foreground"
      >
        This page is a placeholder. The final text will be published after the
        organisation has approved it and it has been reviewed.
      </p>
    </PageShell>
  );
}
