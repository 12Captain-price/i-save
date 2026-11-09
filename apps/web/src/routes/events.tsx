import { useEffect } from "react";
import { LoadingSkeleton } from "@/components/ui/motion";
import {
  Outlet,
  createFileRoute,
  useChildMatches,
} from "@tanstack/react-router";
import { EventCard } from "@/components/site/EventCard";
import { PageShell } from "@/components/site/PageShell";
import { useEvents, type SiteEvent } from "@/lib/content";
import { markSeen, splitEvents } from "@/lib/updates";

export const Route = createFileRoute("/events")({
  component: EventsPage,
});

function EventGrid({ events }: { events: SiteEvent[] }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {events.map((e) => (
        <EventCard key={e.id} event={e} />
      ))}
    </div>
  );
}

function EventsPage() {
  const { data, isPending, isError } = useEvents();
  // The page of a single event (/events/<id>) is a child of this route. When one is open,
  // show it instead of the list; without this the address changes but the list stays on screen.
  const showingOneEvent = useChildMatches().length > 0;

  // Opening the list clears the "new" badge in the header.
  useEffect(() => {
    if (!showingOneEvent) markSeen("events");
  }, [showingOneEvent]);

  if (showingOneEvent) return <Outlet />;
  const { upcoming, past } = splitEvents(data ?? []);
  return (
    <PageShell
      eyebrow="Events"
      title="Events."
      lead="What is coming up, and pictures and details from what the organisation has been doing."
    >
      {isPending && <LoadingSkeleton />}
      {isError && (
        <p role="alert" className="text-sm text-destructive">
          Events could not be loaded. Please try again in a moment.
        </p>
      )}
      {data?.length === 0 && (
        <p className="text-sm text-muted-foreground">No events to show yet.</p>
      )}
      {upcoming.length > 0 && (
        <section aria-labelledby="upcoming-events">
          <h2 id="upcoming-events" className="mb-4 text-2xl font-semibold">
            Upcoming
          </h2>
          <EventGrid events={upcoming} />
        </section>
      )}
      {past.length > 0 && (
        <section
          aria-labelledby="past-events"
          className={upcoming.length > 0 ? "mt-12" : undefined}
        >
          <h2 id="past-events" className="mb-4 text-2xl font-semibold">
            {upcoming.length > 0 ? "Past events" : "Recent events"}
          </h2>
          <EventGrid events={past} />
        </section>
      )}
    </PageShell>
  );
}
