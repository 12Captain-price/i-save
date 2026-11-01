import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  Briefcase,
  Building2,
  GraduationCap,
  Plane,
  Shield,
} from "lucide-react";
import { PublicLayout } from "@/components/site/PublicLayout";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: HomePage,
});

// Interest categories only. No amounts, terms or returns are shown until the owner approves them.
const GOALS = [
  {
    label: "Asset",
    purpose: "Save towards an asset or a significant purchase.",
    Icon: Building2,
  },
  {
    label: "Holiday",
    purpose: "Save towards a future holiday or travel goal.",
    Icon: Plane,
  },
  {
    label: "Emergency",
    purpose: "Set money aside for unexpected needs.",
    Icon: Shield,
  },
  {
    label: "Retrenchment",
    purpose: "Prepare a savings cushion for a possible loss of employment.",
    Icon: Briefcase,
  },
  {
    label: "Education",
    purpose: "Save towards future education costs.",
    Icon: GraduationCap,
  },
];

const STEPS = [
  ["Apply for membership", "Apply online, or ask the office to register you."],
  [
    "Pay the registration fee at the office",
    "Staff record your payment and give you a numbered receipt. A confirmed registration fee activates your account.",
  ],
  [
    "Choose a savings goal",
    "Once your account is active, pick a plan and save week by week. Every payment is recorded in your history.",
  ],
];

const EXPECT = [
  [
    "Payments are made in the office.",
    "There is no online payment yet. Keep your receipt.",
  ],
  [
    "Fees are separate from savings.",
    "Registration and subscription fees never add to your savings balance.",
  ],
  [
    "Plan terms are still being confirmed.",
    "Plans shown are not approved offers until the organisation publishes them.",
  ],
  [
    "Withdrawals are not open yet.",
    "The withdrawal policy is pending approval.",
  ],
];

function HomePage() {
  return (
    <PublicLayout>
      <section
        aria-labelledby="home-title"
        className="relative overflow-hidden"
      >
        <div
          className="grid-lines absolute inset-0 opacity-40"
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-7xl px-6 py-20 md:py-28">
          <div className="animate-rise max-w-2xl">
            <p className="text-sm font-semibold tracking-wide text-primary uppercase">
              Saving today. Planning for tomorrow.
            </p>
            <h1
              id="home-title"
              className="mt-4 text-4xl font-extrabold md:text-6xl"
            >
              Save for what{" "}
              <span className="text-primary">matters to you.</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground">
              Start with a goal. i-Save gives members a clear, recorded way to
              save week by week, with every payment on the record.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#goals" className={cn(buttonVariants({ size: "lg" }))}>
                Explore savings goals
                <ArrowRight aria-hidden="true" />
              </a>
              <a
                href="/apply"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                )}
              >
                Apply for membership
              </a>
            </div>
            <p className="mt-5 text-sm text-muted-foreground">
              Already a member?{" "}
              <a
                href="/login"
                className="text-primary underline underline-offset-4"
              >
                Log in
              </a>
              .
            </p>
          </div>
        </div>
      </section>

      <section
        id="goals"
        aria-labelledby="goals-title"
        className="border-y border-border bg-surface-deep"
      >
        <div className="mx-auto max-w-7xl px-6 py-16">
          <p className="text-sm font-semibold tracking-wide text-primary uppercase">
            Start with a purpose
          </p>
          <h2 id="goals-title" className="mt-2 text-3xl font-bold">
            What are you saving for?
          </h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {GOALS.map(({ label, purpose, Icon }) => (
              <li
                key={label}
                className="flex gap-4 rounded-md border border-border bg-card p-5"
              >
                <Icon
                  className="mt-1 h-6 w-6 shrink-0 text-portal-accent"
                  aria-hidden="true"
                />
                <div>
                  <h3 className="text-lg font-semibold">{label}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {purpose}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-6 max-w-2xl text-sm text-muted-foreground">
            Choosing a category only shows your interest. Plan amounts and terms
            are shown here once the organisation approves them.
          </p>
        </div>
      </section>

      <section
        aria-labelledby="journey-title"
        className="mx-auto max-w-7xl px-6 py-16"
      >
        <p className="text-sm font-semibold tracking-wide text-primary uppercase">
          A simple journey
        </p>
        <h2 id="journey-title" className="mt-2 text-3xl font-bold">
          Your next steps, clearly explained.
        </h2>
        <ol className="mt-8 grid gap-6 md:grid-cols-3">
          {STEPS.map(([title, text], index) => (
            <li
              key={title}
              className="rounded-md border border-border bg-card p-6"
            >
              <span
                className="font-display text-3xl font-bold text-primary"
                aria-hidden="true"
              >
                0{index + 1}
              </span>
              <h3 className="mt-3 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section
        aria-labelledby="expect-title"
        className="border-t border-border bg-surface-deep"
      >
        <div className="mx-auto max-w-7xl px-6 py-16">
          <p className="text-sm font-semibold tracking-wide text-primary uppercase">
            Know what to expect
          </p>
          <h2 id="expect-title" className="mt-2 text-3xl font-bold">
            A little clarity before you begin.
          </h2>
          <ul className="mt-8 grid gap-6 sm:grid-cols-2">
            {EXPECT.map(([title, text]) => (
              <li key={title}>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </PublicLayout>
  );
}
