import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/site/PageShell";
import { buttonVariants } from "@/components/ui/button";
import { LoadingSkeleton } from "@/components/ui/motion";
import { useAgents } from "@/lib/agents";
import { useAuth } from "@/lib/auth";
import { isStaffRole } from "@/lib/staff-utils";
import { recordTraffic } from "@/lib/traffic";

export const Route = createFileRoute("/apply")({
  component: ApplyPage,
});

function ApplyPage() {
  const { data, isPending, isError } = useAgents();
  const { roles } = useAuth();
  // A click on an agent button is the count for that agent. Staff testing the links are not counted.
  const countClick = (agentId: string) => {
    if (!isStaffRole(roles)) void recordTraffic("agent_click", "/apply", agentId);
  };
  return (
    <PageShell
      eyebrow="Apply"
      title="Apply for membership."
      lead="Choose your registration agent below. The button opens that agent's registration form."
    >
      {isPending && <LoadingSkeleton />}
      {isError && (
        <p role="alert" className="text-sm text-destructive">
          The list of agents could not be loaded. Please try again in a moment.
        </p>
      )}
      {data?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Registration links are being set up. Please check back soon, or visit
          the office to register in person.
        </p>
      )}
      <ul className="grid gap-4 sm:grid-cols-2">
        {data?.map((agent) => (
          <li
            key={agent.id}
            className="flex flex-col justify-between gap-4 rounded-md border border-border p-5"
          >
            <div>
              <h2 className="text-lg font-semibold">{agent.name}</h2>
              {agent.note && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {agent.note}
                </p>
              )}
            </div>
            <a
              href={agent.registration_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => countClick(agent.id)}
              className={buttonVariants({ size: "lg" })}
            >
              Register with {agent.name}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
