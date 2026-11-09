import { useEffect } from "react";
import { LoadingSkeleton } from "@/components/ui/motion";
import {
  Outlet,
  createFileRoute,
  useChildMatches,
} from "@tanstack/react-router";
import { AnnouncementCard } from "@/components/site/AnnouncementCard";
import { PageShell } from "@/components/site/PageShell";
import { useAnnouncements } from "@/lib/content";
import { markSeen } from "@/lib/updates";

export const Route = createFileRoute("/announcements")({
  component: AnnouncementsPage,
});

function AnnouncementsPage() {
  const { data, isPending, isError } = useAnnouncements();
  // The page of a single announcement (/announcements/<id>) is a child of this route. When
  // one is open, show it instead of the list.
  const showingOne = useChildMatches().length > 0;

  // Opening the list clears the "new" badge in the header.
  useEffect(() => {
    if (!showingOne) markSeen("announcements");
  }, [showingOne]);

  if (showingOne) return <Outlet />;
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
          <AnnouncementCard key={a.id} announcement={a} />
        ))}
      </div>
    </PageShell>
  );
}
