import { LoadingSkeleton } from "@/components/ui/motion";
import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/site/PageShell";
import { RichText } from "@/components/site/RichText";
import { useAnnouncements } from "@/lib/content";
import { formatDate } from "@/lib/staff-utils";

export const Route = createFileRoute("/announcements")({
  component: AnnouncementsPage,
});

function AnnouncementsPage() {
  const { data, isPending, isError } = useAnnouncements();
  return (
    <PageShell
      eyebrow="Announcements"
      title="News from the office."
      lead="Notices for members. Members who opt in also receive these by email and WhatsApp."
    >
      {isPending && <LoadingSkeleton />}
      {isError && (
        <p role="alert" className="text-sm text-destructive">
          Announcements could not be loaded. Please try again in a moment.
        </p>
      )}
      {data?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          There are no announcements right now.
        </p>
      )}
      <div className="grid gap-5">
        {data?.map((a) => (
          <article
            key={a.id}
            className="rounded-md border border-border bg-card p-6"
          >
            {a.published_at && (
              <p className="text-xs text-muted-foreground">
                {formatDate(a.published_at)}
              </p>
            )}
            <h2 className="mt-1 text-xl font-semibold">{a.title}</h2>
            <RichText
              text={a.body}
              className="mt-3 space-y-2 text-sm text-muted-foreground"
            />
          </article>
        ))}
      </div>
    </PageShell>
  );
}
