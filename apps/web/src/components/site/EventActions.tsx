import { useEffect, useRef, useState } from "react";
import { CalendarPlus, ChevronDown, MapPin } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  buildIcs,
  directionsUrl,
  googleCalendarUrl,
  type CalendarEvent,
} from "@/lib/calendar";
import type { SiteEvent } from "@/lib/content";
import { isUpcoming } from "@/lib/updates";
import { cn } from "@/lib/utils";

function toCalendarEvent(event: SiteEvent): CalendarEvent {
  return {
    title: event.title,
    day: event.event_date,
    location: event.location,
    details: event.summary,
  };
}

function downloadIcs(event: SiteEvent) {
  const blob = new Blob([buildIcs(toCalendarEvent(event), { uid: `${event.id}@i-save` })], {
    type: "text/calendar;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "event.ics";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * "Add to calendar" (upcoming events only: Google, or an .ics file for Apple and Outlook)
 * and "Get directions" (when the event has a place).
 */
export function EventActions({
  event,
  className,
}: {
  event: SiteEvent;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const upcoming = isUpcoming(event.event_date);
  const place = event.location?.trim();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: Event) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!upcoming && !place) return null;

  const item =
    "block w-full rounded-md px-3 py-3 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none";

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      {upcoming && (
        <div ref={rootRef} className="relative">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-haspopup="true"
            aria-expanded={open}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <CalendarPlus aria-hidden="true" /> Add to calendar
            <ChevronDown aria-hidden="true" />
          </button>
          {open && (
            <div className="absolute left-0 z-20 mt-2 w-64 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-xl">
              <a
                href={googleCalendarUrl(toCalendarEvent(event))}
                target="_blank"
                rel="noreferrer"
                onClick={() => setOpen(false)}
                className={item}
              >
                Google Calendar
              </a>
              <button
                type="button"
                onClick={() => {
                  downloadIcs(event);
                  setOpen(false);
                }}
                className={item}
              >
                Apple, Outlook or other (.ics file)
              </button>
            </div>
          )}
        </div>
      )}
      {place && (
        <a
          href={directionsUrl(place)}
          target="_blank"
          rel="noreferrer"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <MapPin aria-hidden="true" /> Get directions
        </a>
      )}
    </div>
  );
}
