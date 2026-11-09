import { LoadingSkeleton } from "@/components/ui/motion";
import {
  Outlet,
  createFileRoute,
  useChildMatches,
} from "@tanstack/react-router";
import { EventCard } from "@/components/site/EventCard";
import { PageShell } from "@/components/site/PageShell";
import { useEvents } from "@/lib/content";

export const Route = createFileRoute("/events")({
  component: EventsPage,
});

function EventsPage() {
  const { data, isPending, isError } = useEvents();
  // The page of a single event (/events/<id>) is a child of this route. When one is open,
  // show it instead of the list; without this the address changes but the list stays on screen.
  const showingOneEvent = useChildMatches().length > 0;
  if (showingOneEvent) return <Outlet />;
  return (
    <PageShell
      eyebrow="Events"
      title="Recent events."
      lead="Pictures and details from what the organisation has been doing."
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
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {data?.map((e) => (
          <EventCard key={e.id} event={e} />
        ))}
      </div>
    </PageShell>
  );
}
