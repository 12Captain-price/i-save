import { Link, createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/site/PageShell";
import { RichText } from "@/components/site/RichText";
import { mediaUrl, useEvent } from "@/lib/content";
import { formatDate } from "@/lib/staff-utils";

export const Route = createFileRoute("/events/$eventId")({
  component: EventPage,
});

function EventPage() {
  const { eventId } = Route.useParams();
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
      {data.images.length > 0 && (
        <ul className="mt-10 grid gap-4 sm:grid-cols-2">
          {data.images.map((img) => (
            <li key={img.id}>
              <a
                href={mediaUrl(img.path) ?? undefined}
                target="_blank"
                rel="noreferrer"
              >
                <img
                  src={mediaUrl(img.path) ?? undefined}
                  alt={img.caption ?? data.title}
                  loading="lazy"
                  className="h-auto w-full rounded-md border border-border bg-muted object-contain"
                />
              </a>
              {img.caption && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {img.caption}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-10 text-sm">
        <Link to="/events" className="underline underline-offset-4">
          ← All events
        </Link>
      </p>
    </PageShell>
  );
}
