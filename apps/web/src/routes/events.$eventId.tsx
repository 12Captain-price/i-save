import { Link, createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/site/PageShell";
import { RichText } from "@/components/site/RichText";
import { EventGallery } from "@/components/site/EventGallery";
import { useEvent } from "@/lib/content";
import { formatDate } from "@/lib/staff-utils";

export const Route = createFileRoute("/events/$eventId")({
  // ?m=<id> opens one picture, video or flier straight away (this is what a shared link uses).
  validateSearch: (search: Record<string, unknown>): { m?: string } => ({
    m: typeof search.m === "string" && search.m ? search.m : undefined,
  }),
  component: EventPage,
});

function EventPage() {
  const { eventId } = Route.useParams();
  const { m } = Route.useSearch();
  const { data, isPending, isError } = useEvent(eventId);

  if (isPending || isError || !data) {
    return (
      <PageShell eyebrow="Events" title="Event">
        {isPending && (
          <p role="status" className="text-sm text-muted-foreground">
            Loading…
          </p>
        )}
        {isError && (
          <p role="alert" className="text-sm text-destructive">
            This event could not be loaded. Please try again in a moment.
          </p>
        )}
        {!isPending && !isError && (
          <p className="text-sm text-muted-foreground">
            This event is not available.
          </p>
        )}
        <p className="mt-6 text-sm">
          <Link to="/events" className="underline underline-offset-4">
            All events
          </Link>
        </p>
      </PageShell>
    );
  }

  return (
    <PageShell
      eyebrow={`Events · ${formatDate(data.event_date)}`}
      title={data.title}
      lead={data.location ?? undefined}
    >
      {data.summary && <p className="mb-6 text-base">{data.summary}</p>}
      {data.details && <RichText text={data.details} />}
      <EventGallery event={data} initialOpenId={m} />
      <p className="mt-10 text-sm">
        <Link to="/events" className="underline underline-offset-4">
          ← All events
        </Link>
      </p>
    </PageShell>
  );
}
