import { useState } from "react";
import { Megaphone, Paperclip } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { MediaGallery } from "@/components/site/MediaGallery";
import { RichText } from "@/components/site/RichText";
import { ShareButton } from "@/components/site/ShareButton";
import { Tag } from "@/components/site/Tags";
import type { Announcement } from "@/lib/content";
import { formatDate } from "@/lib/staff-utils";
import { isRecent, shorten } from "@/lib/updates";
import { cn } from "@/lib/utils";

/**
 * One announcement: date and "New" tag, title, text with "Read more" when it is long, any
 * attached pictures or fliers, and a Share button. On the list the title opens the
 * announcement's own page; on that page (`single`) the whole text is shown.
 */
export function AnnouncementCard({
  announcement: a,
  single = false,
  featured = false,
  initialOpenId,
}: {
  announcement: Announcement;
  single?: boolean;
  /** The newest notice, shown larger and tinted at the top of the list. */
  featured?: boolean;
  initialOpenId?: string;
}) {
  const [expanded, setExpanded] = useState(single);
  const { text, cut } = shorten(a.body);
  const pageUrl = `/announcements/${a.id}`;

  return (
    <article
      className={cn(
        "rounded-md border border-border bg-card p-6",
        featured && "border-primary/40 bg-primary/5 p-6 md:p-8",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span
            aria-hidden="true"
            className="flex size-7 items-center justify-center rounded-full bg-primary/15 text-primary"
          >
            {a.files.length > 0 ? (
              <Paperclip className="size-3.5" />
            ) : (
              <Megaphone className="size-3.5" />
            )}
          </span>
          {a.published_at && <span>{formatDate(a.published_at)}</span>}
          {isRecent(a.published_at) && <Tag tone="new">New</Tag>}
        </div>
        <ShareButton
          title={a.title}
          url={`${window.location.origin}${pageUrl}`}
        />
      </div>

      {/* On the announcement's own page the page heading already shows the title. */}
      {!single && (
        <h2
          className={cn(
            "mt-2 font-semibold",
            featured ? "text-2xl" : "text-xl",
          )}
        >
          <Link
            to="/announcements/$announcementId"
            params={{ announcementId: a.id }}
            className="hover:underline"
          >
            {a.title}
          </Link>
        </h2>
      )}

      <RichText
        text={expanded ? a.body : text}
        className={`space-y-2 text-sm text-muted-foreground ${single ? "mt-1" : "mt-3"}`}
      />
      {cut && !single && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          className="mt-2 text-sm font-semibold text-primary hover:underline"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      )}

      {a.files.length > 0 && (
        <div className="mt-5">
          <MediaGallery
            items={a.files}
            title={a.title}
            pageUrl={pageUrl}
            initialOpenId={initialOpenId}
            columns={single ? "sm:grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}
          />
        </div>
      )}
    </article>
  );
}
