import { Skeleton } from "@/components/ui/motion";

/** Placeholder with the same shape as an EventCard, so the page does not jump when it loads. */
export function EventCardSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-md border border-border bg-card">
      <Skeleton className="aspect-[16/10] h-auto w-full rounded-none" />
      <div className="grid gap-2.5 p-5">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  );
}

export function AnnouncementSkeleton() {
  return (
    <div className="grid gap-2.5 rounded-md border border-border bg-card p-6">
      <Skeleton className="h-3 w-1/4" />
      <Skeleton className="h-5 w-3/5" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
    </div>
  );
}

export function EventGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div
      role="status"
      className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
    >
      <span className="sr-only">Loading…</span>
      {Array.from({ length: count }, (_, i) => (
        <EventCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function AnnouncementListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div role="status" className="grid gap-5">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: count }, (_, i) => (
        <AnnouncementSkeleton key={i} />
      ))}
    </div>
  );
}
