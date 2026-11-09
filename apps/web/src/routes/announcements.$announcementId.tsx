import { Link, createFileRoute } from "@tanstack/react-router";
import { AnnouncementCard } from "@/components/site/AnnouncementCard";
import { PageShell } from "@/components/site/PageShell";
import { useAnnouncement } from "@/lib/content";

export const Route = createFileRoute("/announcements/$announcementId")({
  // ?m=<id> opens one attached file straight away (this is what a shared link uses).
  validateSearch: (search: Record<string, unknown>): { m?: string } => ({
    m: typeof search.m === "string" && search.m ? search.m : undefined,
  }),
  component: AnnouncementPage,
});

function AnnouncementPage() {
  const { announcementId } = Route.useParams();
  const { m } = Route.useSearch();
  const { data, isPending, isError } = useAnnouncement(announcementId);

  return (
    <PageShell eyebrow="Announcements" title={data?.title ?? "Announcement"}>
      {isPending && (
        <p role="status" className="text-sm text-muted-foreground">
          Loading…
        </p>
      )}
      {isError && (
        <p role="alert" className="text-sm text-destructive">
          This announcement could not be loaded. Please try again in a moment.
        </p>
      )}
      {!isPending && !isError && !data && (
        <p className="text-sm text-muted-foreground">
          This announcement is not available.
        </p>
      )}
      {data && (
        <AnnouncementCard announcement={data} single initialOpenId={m} />
      )}
      <p className="mt-10 text-sm">
        <Link to="/announcements" className="underline underline-offset-4">
          ← All announcements
        </Link>
      </p>
    </PageShell>
  );
}
