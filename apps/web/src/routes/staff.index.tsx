import { Link, createFileRoute } from "@tanstack/react-router";
import { buttonVariants } from "@/components/ui/button";

export const Route = createFileRoute("/staff/")({
  component: AdminOverview,
});

const SHORTCUTS = [
  {
    to: "/staff/announcements",
    title: "Announcements",
    text: "Post news for visitors and members.",
  },
  {
    to: "/staff/events",
    title: "Events",
    text: "Add and update upcoming and past events.",
  },
  {
    to: "/staff/plans",
    title: "Savings plans",
    text: "Write plan descriptions and manage the goal-based plan.",
  },
  {
    to: "/staff/team",
    title: "Team",
    text: "Manage the people shown on the Our team page.",
  },
  {
    to: "/staff/agents",
    title: "Agents",
    text: "Manage the registration buttons on the Apply page.",
  },
  {
    to: "/staff/traffic",
    title: "Traffic",
    text: "See visits, Apply clicks and handoffs per agent.",
  },
  {
    to: "/staff/content",
    title: "Pages, FAQs, contact",
    text: "Edit the public wording and contact details.",
  },
] as const;

function AdminOverview() {
  return (
    <div>
      <h1 className="text-3xl font-semibold md:text-4xl">Admin overview</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Manage what visitors see on the site.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {SHORTCUTS.map((s) => (
          <Link
            key={s.to}
            to={s.to}
            className="rounded-xl border border-border p-5 transition-colors hover:border-primary"
          >
            <h2 className="text-lg font-semibold">{s.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
          </Link>
        ))}
      </div>
      <div className="mt-8">
        <Link to="/" className={buttonVariants({ variant: "outline" })}>
          View the public site
        </Link>
      </div>
    </div>
  );
}
