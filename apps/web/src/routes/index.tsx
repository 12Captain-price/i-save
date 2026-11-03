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
import { HomeSections } from "@/components/site/HomeSections";
import { Reveal } from "@/components/site/Reveal";
import { NextChapter } from "@/components/site/NextChapter";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import "@/components/site/homepage.css";

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
  ["Apply for membership.", "Apply online, or ask the office to register you."],
  [
    "Pay the registration fee at the office.",
    "Staff record your payment and give you a numbered receipt. A confirmed registration fee activates your account.",
  ],
  [
    "Choose a savings goal.",
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
    "Plans are not approved offers until the organisation publishes them.",
  ],
  [
    "Withdrawals are not open yet.",
    "The withdrawal policy is pending approval.",
  ],
];

function HomePage() {
  return (
    <PublicLayout>
      <div className="home-page">
        <section aria-labelledby="home-title" className="home-hero home-width">
          <div className="home-hero-copy">
            <p
              className="home-eyebrow stagger-in"
              style={{ ["--i" as string]: 0 }}
            >
              Saving today. Planning for tomorrow.
            </p>
            <h1 id="home-title">
              {["Save", "for", "what"].map((w, i) => (
                <span
                  key={w}
                  className="hero-word"
                  style={{ ["--i" as string]: i }}
                >
                  {w}{" "}
                </span>
              ))}
              <span className="hero-accent">
                {["matters", "to", "you."].map((w, i) => (
                  <span
                    key={w}
                    className="hero-word"
                    style={{ ["--i" as string]: i + 3 }}
                  >
                    {w}
                    {i < 2 ? " " : ""}
                  </span>
                ))}
              </span>
            </h1>
            <p
              className="home-lead stagger-in"
              style={{ ["--i" as string]: 7 }}
            >
              From education to life’s unexpected moments, start with a goal and
              explore your next steps with i-Save.
            </p>
            <div
              className="home-actions stagger-in"
              style={{ ["--i" as string]: 9 }}
            >
              <a
                href="#goals"
                className={cn(buttonVariants({ size: "lg" }), "pulse-glow")}
              >
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
            <p className="home-login">
              Already have an activated account? <a href="/login">Log in</a>.
            </p>
          </div>
          <NextChapter />
        </section>

        <section
          id="goals"
          aria-labelledby="home-goals-title"
          className="home-goals-section"
        >
          <div className="home-width">
            <Reveal className="home-section-heading">
              <p className="home-eyebrow">Start with a purpose</p>
              <h2 id="home-goals-title">What are you saving for?</h2>
            </Reveal>
            <ul className="home-goals">
              {GOALS.map(({ label, purpose, Icon }, i) => (
                <Reveal as="li" index={i} key={label}>
                  <a
                    href="/plans"
                    aria-label={label + ": explore this category"}
                    className="home-goal"
                  >
                    <Icon className="home-goal-icon" aria-hidden="true" />
                    <div>
                      <h3>{label}</h3>
                      <p>{purpose}</p>
                    </div>
                    <ArrowRight
                      className="home-goal-arrow"
                      aria-hidden="true"
                    />
                  </a>
                </Reveal>
              ))}
            </ul>
            <p className="home-interest-note">
              Choosing a category only shows your interest. Plan amounts and
              terms are shown here once the organisation approves them.
            </p>
          </div>
        </section>

        <section
          aria-labelledby="home-journey-title"
          className="home-journey home-width"
        >
          <Reveal className="home-section-heading">
            <p className="home-eyebrow">A simple journey</p>
            <h2 id="home-journey-title">Your next steps, clearly explained.</h2>
          </Reveal>
          <Reveal as="ol" className="home-stages">
            {STEPS.map(([title, text], index) => (
              <li key={title} style={{ ["--i" as string]: index }}>
                <span className="home-stage-number" aria-hidden="true">
                  0{index + 1}
                </span>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </li>
            ))}
          </Reveal>
          <a href="/how-it-works" className="home-text-link">
            Read how it works
            <ArrowRight size={17} aria-hidden="true" />
          </a>
        </section>

        <section aria-labelledby="home-expect-title" className="home-expect">
          <div className="home-width home-expect-layout">
            <Reveal>
              <p className="home-eyebrow">Know what to expect</p>
              <h2 id="home-expect-title">A little clarity before you begin.</h2>
              <a href="/fees" className="home-text-link">
                Fees and office payments
                <ArrowRight size={17} aria-hidden="true" />
              </a>
            </Reveal>
            <ul>
              {EXPECT.map(([title, text], i) => (
                <Reveal as="li" index={i} key={title}>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>

        <HomeSections />

        <section
          aria-labelledby="home-closing-title"
          className="home-closing home-width"
        >
          <Reveal>
            <p className="home-eyebrow">Take your next step</p>
            <h2 id="home-closing-title">Ready to begin with a goal?</h2>
            <p className="mt-3 text-muted-foreground">
              Start with a membership application. The office team can help with
              questions along the way.
            </p>
            <a
              href="/apply"
              className={cn(buttonVariants({ size: "lg" }), "pulse-glow mt-6")}
            >
              Apply for membership
              <ArrowRight aria-hidden="true" />
            </a>
          </Reveal>
          <Reveal className="home-contact" index={1}>
            <a href="/contact" className="home-help-link">
              Need a hand? Contact the office
              <ArrowRight size={16} aria-hidden="true" />
            </a>
          </Reveal>
        </section>
      </div>
    </PublicLayout>
  );
}
