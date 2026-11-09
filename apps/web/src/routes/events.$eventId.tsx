import { Link, createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/site/PageShell";
import { RichText } from "@/components/site/RichText";
import { DateBadge } from "@/components/site/DateBadge";
import { EventActions } from "@/components/site/EventActions";
import { EventGallery } from "@/components/site/EventGallery";
import { ShareButton } from "@/components/site/ShareButton";
import { Tag } from "@/components/site/Tags";
import { useEvent } from "@/lib/content";
import { formatDate } from "@/lib/staff-utils";
import { timingLabel } from "@/lib/updates";

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
    >
      <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-md border border-border bg-card p-4">
        <DateBadge day={data.event_date} />
        <div className="min-w-0 flex-1 basis-40">
          <p className="font-semibold">{formatDate(data.event_date)}</p>
          {data.location && (
            <p className="text-sm text-muted-foreground">{data.location}</p>
          )}
          {timingLabel(data.event_date) && (
            <Tag tone="soon" className="mt-1.5">
              {timingLabel(data.event_date)}
            </Tag>
          )}
        </div>
        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
          <EventActions event={data} />
          <ShareButton
            title={data.title}
            url={`${window.location.origin}/events/${data.id}`}
          />
        </div>
      </div>
      <EventGallery event={data} initialOpenId={m}>
        {data.summary && <p className="mb-6 text-base">{data.summary}</p>}
        {data.details && <RichText text={data.details} />}
      </EventGallery>
      <p className="mt-10 text-sm">
        <Link to="/events" className="underline underline-offset-4">
          ← All events
        </Link>
      </p>
    </PageShell>
  );
}
