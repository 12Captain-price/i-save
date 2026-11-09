import { ClipboardList, CreditCard, UserCheck } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/site/PageShell";
import { Photo } from "@/components/site/Photo";
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
    if (!isStaffRole(roles))
      void recordTraffic("agent_click", "/apply", agentId);
  };
  return (
    <PageShell
      eyebrow="Apply"
      title="Apply for membership."
      lead="Choose your registration agent below. The button opens that agent's registration form."
    >
      <ol className="mb-10 grid gap-4 sm:grid-cols-3" aria-label="What happens next">
        {[
          {
            icon: <ClipboardList className="size-5" />,
            title: "1. Register",
            text: "Choose your agent below and fill in the registration form.",
          },
          {
            icon: <UserCheck className="size-5" />,
            title: "2. Visit the office",
            text: "Bring your ID so the office can check it and confirm your plan.",
          },
          {
            icon: <CreditCard className="size-5" />,
            title: "3. Start saving",
            text: "Pay your contributions at the office and follow them on your account.",
          },
        ].map((step) => (
          <li
            key={step.title}
            className="rounded-xl border border-border bg-card p-5"
          >
            <span
              aria-hidden="true"
              className="flex size-10 items-center justify-center rounded-full bg-primary/15 text-primary"
            >
              {step.icon}
            </span>
            <p className="mt-3 font-semibold">{step.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{step.text}</p>
          </li>
        ))}
      </ol>
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
            className="zoom-photo flex flex-col overflow-hidden rounded-xl border border-border bg-card"
          >
            <Photo
              path={agent.photo_path}
              alt={`${agent.name}`}
              fallbackName={agent.name}
              className="aspect-[4/3] w-full text-5xl"
            />
            <div className="flex flex-1 flex-col justify-between gap-4 p-5">
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
            </div>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
