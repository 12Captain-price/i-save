import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/site/PageShell";
import { TeamCard } from "@/components/site/TeamCard";
import { useTeam } from "@/lib/content";
import { groupByLevel } from "@/lib/team-utils";

export const Route = createFileRoute("/team")({
  component: TeamPage,
});

function TeamPage() {
  const { data, isPending, isError } = useTeam();
  const tiers = data ? groupByLevel(data) : [];
  return (
    <PageShell
      eyebrow="Our team"
      title="The people behind i-Save."
      lead="Meet the team that looks after your membership and your savings records."
    >
      {isPending && (
        <p role="status" className="text-sm text-muted-foreground">
          Loading…
        </p>
      )}
      {isError && (
        <p role="alert" className="text-sm text-destructive">
          The team could not be loaded. Please try again in a moment.
        </p>
      )}
      {data?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          The team will be introduced here soon.
        </p>
      )}
      <div className="grid gap-12">
        {tiers.map((tier, index) => (
          <section
            key={tier[0].level}
            aria-label={`Team level ${index + 1}`}
            className="flex flex-wrap justify-center gap-x-8 gap-y-10 border-t border-border pt-10 first:border-t-0 first:pt-0"
          >
            {tier.map((m) => (
              <TeamCard key={m.id} member={m} large={index === 0} />
            ))}
          </section>
        ))}
      </div>
    </PageShell>
  );
}
