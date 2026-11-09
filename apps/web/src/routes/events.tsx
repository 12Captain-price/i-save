import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import {
  Outlet,
  createFileRoute,
  useChildMatches,
} from "@tanstack/react-router";
import { EventCard } from "@/components/site/EventCard";
import { EmptyState } from "@/components/site/EmptyState";
import { EventGridSkeleton } from "@/components/site/Skeletons";
import { SearchBox } from "@/components/site/SearchBox";
import { PageShell } from "@/components/site/PageShell";
import { useEvents, type SiteEvent } from "@/lib/content";
import { matchesQuery, yearOf, yearsOf } from "@/lib/list-filter";
import { markSeen, splitEvents } from "@/lib/updates";
import { cn } from "@/lib/utils";

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
  const [query, setQuery] = useState("");
  const [year, setYear] = useState("all");

  // Opening the list clears the "new" badge in the header.
  useEffect(() => {
    if (!showingOneEvent) markSeen("events");
  }, [showingOneEvent]);

  if (showingOneEvent) return <Outlet />;
  const years = yearsOf((data ?? []).map((e) => e.event_date));
  const activeYear = years.includes(year) ? year : "all";
  const visible = (data ?? []).filter(
    (e) =>
      (activeYear === "all" || yearOf(e.event_date) === activeYear) &&
      matchesQuery([e.title, e.location, e.summary], query),
  );
  const filtering = query.trim() !== "" || activeYear !== "all";
  const { upcoming, past } = splitEvents(visible);
  return (
    <PageShell
      eyebrow="Events"
      title="Events."
      lead="What is coming up, and pictures and details from what the organisation has been doing."
    >
      {isPending && <EventGridSkeleton />}
      {isError && (
        <p role="alert" className="text-sm text-destructive">
          Events could not be loaded. Please try again in a moment.
        </p>
      )}
      {data?.length === 0 && (
        <EmptyState icon={<CalendarDays />} title="No events yet">
          Upcoming events and pictures from what we have been doing will show up
          here.
        </EmptyState>
      )}
      {(data?.length ?? 0) > 3 && (
        <div className="mb-8 grid gap-3">
          <SearchBox
            id="event-search"
            label="Search events"
            value={query}
            onChange={setQuery}
            className="max-w-md"
          />
          {years.length > 1 && (
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label="Filter events by year"
            >
              {["all", ...years].map((y) => (
                <button
                  key={y}
                  type="button"
                  aria-pressed={activeYear === y}
                  onClick={() => setYear(y)}
                  className={cn(
                    "min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors",
                    activeYear === y
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:border-primary hover:text-primary",
                  )}
                >
                  {y === "all" ? "All years" : y}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {filtering && data && data.length > 0 && visible.length === 0 && (
        <EmptyState icon={<CalendarDays />} title="No events match">
          Try a different word, or choose another year.
        </EmptyState>
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
