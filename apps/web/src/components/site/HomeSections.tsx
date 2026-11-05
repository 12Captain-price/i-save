import { ArrowRight } from "lucide-react";
import { EventCard } from "@/components/site/EventCard";
import { Reveal } from "@/components/site/Reveal";
import { ReviewCard } from "@/components/site/ReviewCard";
import { RichText } from "@/components/site/RichText";
import { TeamCard } from "@/components/site/TeamCard";
import { useAnnouncements, useEvents, useTeam } from "@/lib/content";
import { useApprovedReviews } from "@/lib/reviews";
import { formatDate } from "@/lib/staff-utils";
import { groupByLevel } from "@/lib/team-utils";

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
  const events = useEvents(false, 3).data ?? [];
  const reviews = useApprovedReviews(3).data ?? [];
  const team = useTeam().data ?? [];
  const leaders = groupByLevel(team)[0] ?? [];

  return (
    <>
      {announcements.length > 0 && (
        <section aria-label="Announcements" className="home-width py-12">
          <Heading
            eyebrow="Latest news"
            title="Announcements"
            href="/announcements"
            linkText="All announcements"
          />
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {announcements.map((a, i) => (
              <Reveal
                as="article"
                index={i}
                key={a.id}
                className="lift-card rounded-md border border-border bg-card p-5"
              >
                {a.published_at && (
                  <p className="text-xs text-muted-foreground">
                    {formatDate(a.published_at)}
                  </p>
                )}
                <h3 className="mt-1 font-semibold">{a.title}</h3>
                <RichText
                  text={
                    a.body.length > 160
                      ? a.body.slice(0, 160).trimEnd() + "…"
                      : a.body
                  }
                  className="mt-2 space-y-2 text-sm text-muted-foreground"
                />
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {events.length > 0 && (
        <section aria-label="Events" className="home-width py-12">
          <Heading
            eyebrow="What we have been doing"
            title="Recent events"
            href="/events"
            linkText="All events"
          />
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((e, i) => (
              <Reveal key={e.id} index={i} className="h-full">
                <EventCard event={e} />
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {reviews.length > 0 && (
        <section aria-label="Reviews" className="home-width py-12">
          <Heading
            eyebrow="In their words"
            title="What members say"
            href="/reviews"
            linkText="All reviews"
          />
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {reviews.map((r, i) => (
              <Reveal key={r.id} index={i} className="h-full">
                <ReviewCard review={r} />
              </Reveal>
            ))}
          </div>
        </section>
      )}

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
