import { useEffect, useState } from "react";
import { useFeedDates } from "@/lib/content";
import { SEEN_EVENT, countUnseen, readSeen, type Section } from "@/lib/updates";

export type UpdateCounts = Record<Section, number> & { total: number };

/**
 * How many announcements and events are new to this visitor, for the header badges.
 * Opening the Announcements or Events page clears its count (see markSeen).
 */
export function useUpdateCounts(): UpdateCounts {
  const { data } = useFeedDates();
  // Bumped whenever a section is opened (here or in another tab) so the counts are re-read.
  const [, bump] = useState(0);
  useEffect(() => {
    const again = () => bump((n) => n + 1);
    window.addEventListener(SEEN_EVENT, again);
    window.addEventListener("storage", again);
    return () => {
      window.removeEventListener(SEEN_EVENT, again);
      window.removeEventListener("storage", again);
    };
  }, []);

  const now = new Date();
  const announcements = countUnseen(
    data?.announcements ?? [],
    readSeen("announcements"),
    now,
  );
  const events = countUnseen(data?.events ?? [], readSeen("events"), now);
  return { announcements, events, total: announcements + events };
}

/** Which menu link carries which badge. */
export const SECTION_OF: Record<string, Section | undefined> = {
  "/announcements": "announcements",
  "/events": "events",
};
