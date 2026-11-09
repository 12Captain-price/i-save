import { ArrowRight, Paperclip, PenLine, Star } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Tag } from "@/components/site/Tags";
import { buttonVariants } from "@/components/ui/button";
import { DateBadge } from "@/components/site/DateBadge";
import { EventCard } from "@/components/site/EventCard";
import { Reveal } from "@/components/site/Reveal";
import { ReviewCard } from "@/components/site/ReviewCard";
import { RichText } from "@/components/site/RichText";
import { TeamCard } from "@/components/site/TeamCard";
import { useAnnouncements, useEvents, useTeam } from "@/lib/content";
import { useApprovedReviews } from "@/lib/reviews";
import { formatDate } from "@/lib/staff-utils";
import { groupByLevel } from "@/lib/team-utils";
import { isRecent, shorten, splitEvents, timingLabel } from "@/lib/updates";

function Heading({
  eyebrow,
  title,
  href,
  linkText,
}: {
  eyebrow: string;
  title: string;
  href: string;
  linkText: string;
}) {
  return (
    <Reveal className="home-section-heading flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="home-eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      <a href={href} className="home-text-link">
        {linkText}
        <ArrowRight size={17} aria-hidden="true" />
      </a>
    </Reveal>
  );
}

/** Latest announcements, events and the leadership team. Each section hides itself when empty. */
export function HomeSections() {
  const announcements = useAnnouncements(false, 3).data ?? [];
  // What is coming up goes first, then the latest past events.
  const allEvents = useEvents(false, 12).data ?? [];
  const { upcoming, past } = splitEvents(allEvents);
  const events = [...upcoming, ...past].slice(0, 3);
  const reviews = useApprovedReviews(3).data ?? [];
  const team = useTeam().data ?? [];
  const leaders = groupByLevel(team)[0] ?? [];

  const soon = upcoming.slice(0, 3);

  return (
    <>
      {soon.length > 0 && (
        <section aria-label="Coming up" className="home-width pt-10">
          <Reveal>
            <p className="home-eyebrow">Coming up</p>
          </Reveal>
          <ul className="mt-3 flex snap-x gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-3 md:overflow-visible">
            {soon.map((e) => (
              <li key={e.id} className="w-[82%] shrink-0 snap-start md:w-auto">
                <Link
                  to="/events/$eventId"
                  params={{ eventId: e.id }}
                  className="lift-card flex h-full items-center gap-4 rounded-md border border-border bg-card p-3"
                >
                  <DateBadge day={e.event_date} />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">
                      {e.title}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[timingLabel(e.event_date), e.location]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {announcements.length > 0 && (
        <section aria-label="Announcements" className="home-width py-12">
          <Heading
            eyebrow="Latest news"
            title="Announcements"
            href="/announcements"
            linkText="All announcements"
          />
          <div className="mt-6 grid gap-4 lg:grid-cols-5">
            {announcements.map((a, i) => {
              const lead = i === 0;
              const preview = shorten(a.body, lead ? 260 : 120);
              return (
                <Reveal
                  as="article"
                  index={i}
                  key={a.id}
                  className={`lift-card rounded-md border p-5 ${
                    lead
                      ? "border-primary/40 bg-primary/5 lg:col-span-3 lg:row-span-2 lg:p-7"
                      : "border-border bg-card lg:col-span-2"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {a.published_at && <span>{formatDate(a.published_at)}</span>}
                    {isRecent(a.published_at) && <Tag tone="new">New</Tag>}
                  </div>
                  <h3
                    className={`mt-1 font-semibold ${lead ? "text-xl lg:text-2xl" : ""}`}
                  >
                    <Link
                      to="/announcements/$announcementId"
                      params={{ announcementId: a.id }}
                      className="hover:underline"
                    >
                      {a.title}
                    </Link>
                  </h3>
                  <RichText
                    text={preview.text}
                    className="mt-2 space-y-2 text-sm text-muted-foreground"
                  />
                  <div className="mt-3 flex items-center justify-between gap-2 text-xs font-semibold">
                    <Link
                      to="/announcements/$announcementId"
                      params={{ announcementId: a.id }}
                      className="text-primary hover:underline"
                    >
                      {preview.cut ? "Read more →" : "Open →"}
                    </Link>
                    {a.files.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Paperclip className="size-3.5" aria-hidden="true" />
                        {a.files.length} {a.files.length === 1 ? "file" : "files"}
                      </span>
                    )}
                  </div>
                </Reveal>
              );
            })}
          </div>
        </section>
      )}

      {events.length > 0 && (
        <section aria-label="Events" className="home-width py-12">
          <Heading
            eyebrow="What is on and what we have been doing"
            title="Events"
            href="/events"
            linkText="All events"
          />
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((e, i) => {
              // With three events, the first is wide and the other two stack beside it.
              const wide = events.length === 3 && i === 0;
              return (
                <Reveal
                  key={e.id}
                  index={i}
                  className={`h-full ${wide ? "sm:col-span-2 lg:row-span-2" : ""}`}
                >
                  <EventCard event={e} featured={wide} />
                </Reveal>
              );
            })}
          </div>
        </section>
      )}

      <section aria-label="Reviews" className="home-width py-12">
        <Heading
          eyebrow="In their words"
          title="What our clients say"
          href="/reviews"
          linkText={reviews.length > 0 ? "All reviews" : "Reviews page"}
        />
        {reviews.length > 0 ? (
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {reviews.map((r, i) => (
              <Reveal key={r.id} index={i} className="h-full">
                <ReviewCard review={r} />
              </Reveal>
            ))}
          </div>
        ) : (
          <Reveal className="mt-6">
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card px-6 py-10 text-center">
              <span
                aria-hidden="true"
                className="flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary"
              >
                <Star className="size-6" />
              </span>
              <p className="text-lg font-semibold">Be the first to review us</p>
              <p className="max-w-md text-sm text-muted-foreground">
                Used i-Save? Tell others what it is like. It takes a minute.
              </p>
            </div>
          </Reveal>
        )}
        <div className="mt-6 flex justify-center">
          <a
            href="/reviews#write-review"
            className={buttonVariants({ variant: "default", size: "lg" })}
          >
            <PenLine aria-hidden="true" />
            Write a review
          </a>
        </div>
      </section>

      {leaders.length > 0 && (
        <section aria-label="Our team" className="home-width py-12">
          <Heading
            eyebrow="Meet the team"
            title="The people behind i-Save"
            href="/team"
            linkText="Whole team"
          />
          <div className="mt-8 flex flex-wrap justify-center gap-x-8 gap-y-10">
            {leaders.map((m, i) => (
              <Reveal key={m.id} index={i}>
                <TeamCard member={m} large />
              </Reveal>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
