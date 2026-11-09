import { useState } from "react";
import { Images } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "@/components/site/EmptyState";
import { MediaThumb } from "@/components/site/MediaThumb";
import { MediaViewer } from "@/components/site/MediaViewer";
import { PageShell } from "@/components/site/PageShell";
import { LoadingSkeleton } from "@/components/ui/motion";
import { useEvents, type EventMedia } from "@/lib/content";
import { MEDIA_LABEL } from "@/lib/event-media";
import { yearOf, yearsOf } from "@/lib/list-filter";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/gallery")({
  component: GalleryPage,
});

type Entry = { media: EventMedia; eventId: string; title: string; day: string };

function GalleryPage() {
  const { data, isPending, isError } = useEvents();
  const [year, setYear] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);

  // Every picture and video of every published event, newest event first. Fliers (PDFs)
  // stay on their event page.
  const entries: Entry[] = [...(data ?? [])]
    .sort((a, b) => b.event_date.localeCompare(a.event_date))
    .flatMap((e) =>
      e.images
        .filter((m) => m.media_type !== "pdf")
        .map((m) => ({ media: m, eventId: e.id, title: e.title, day: e.event_date })),
    );
  const years = yearsOf(entries.map((e) => e.day));
  const activeYear = years.includes(year) ? year : "all";
  const shown = entries.filter(
    (e) => activeYear === "all" || yearOf(e.day) === activeYear,
  );
  const index = openId ? shown.findIndex((e) => e.media.id === openId) : -1;
  const current = index >= 0 ? shown[index] : null;

  return (
    <PageShell
      eyebrow="Gallery"
      title="Pictures and videos."
      lead="Moments from our events. Tap one to see it full size, and swipe to see the next."
    >
      {isPending && <LoadingSkeleton />}
      {isError && (
        <p role="alert" className="text-sm text-destructive">
          The gallery could not be loaded. Please try again in a moment.
        </p>
      )}
      {data && entries.length === 0 && (
        <EmptyState icon={<Images />} title="No pictures yet">
          Pictures and videos from our events will appear here.
        </EmptyState>
      )}
      {years.length > 1 && (
        <div
          className="mb-6 flex flex-wrap gap-2"
          role="group"
          aria-label="Filter by year"
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
      {shown.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((e) => (
            <li key={e.media.id}>
              <button
                type="button"
                onClick={() => setOpenId(e.media.id)}
                aria-label={`Open ${MEDIA_LABEL[e.media.media_type].toLowerCase()} from ${e.title}`}
                className="zoom-photo block w-full cursor-zoom-in overflow-hidden rounded-md border border-border focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <MediaThumb item={e.media} backdrop className="aspect-square w-full" />
              </button>
              <p className="mt-1.5 line-clamp-1 text-xs text-muted-foreground">
                {e.title}
              </p>
            </li>
          ))}
        </ul>
      )}
      {current && (
        <MediaViewer
          items={shown.map((e) => ({ ...e.media, caption: e.media.caption ?? e.title }))}
          index={index}
          title="Gallery"
          shareUrl={(m) => {
            const owner = shown.find((e) => e.media.id === m.id);
            return `${window.location.origin}/events/${owner?.eventId ?? ""}?m=${m.id}`;
          }}
          onIndexChange={(i) => setOpenId(shown[i].media.id)}
          onClose={() => setOpenId(null)}
        />
      )}
    </PageShell>
  );
}
