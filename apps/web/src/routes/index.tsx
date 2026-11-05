import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  Briefcase,
  Building2,
  GraduationCap,
  Plane,
  Shield,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { PublicLayout } from "@/components/site/PublicLayout";
import { HeroRibbons } from "@/components/site/HeroRibbons";
import { GoalPanel } from "@/components/site/GoalPanel";
import { HomeDashboard } from "@/components/site/HomeDashboard";
import { HomeSections } from "@/components/site/HomeSections";
import { Reveal } from "@/components/site/Reveal";
import { NextChapter } from "@/components/site/NextChapter";
import { StatTiles } from "@/components/site/StatTiles";
import { buttonVariants } from "@/components/ui/button";
import { GOAL_CONTENT, type GoalKey } from "@/lib/goal-content";
import { cn } from "@/lib/utils";
import "@/components/site/homepage.css";
import "@/components/site/home-marketing.css";

export const Route = createFileRoute("/")({
  component: HomePage,
});

// Icons for the goal tiles. The wording and sample figures live in lib/goal-content.ts.
const GOAL_ICONS: Record<GoalKey, LucideIcon> = {
  asset: Building2,
  holiday: Plane,
  emergency: Shield,
  retrenchment: Briefcase,
  education: GraduationCap,
};

const STEPS = [
  ["Apply for membership.", "Apply online, or ask the office to register you."],
  [
    "Register with your agent.",
    "The agent's registration form opens in a new tab. Fill it in and the agent takes you from there.",
  ],
  [
    "Choose a savings goal.",
    "Pick the goal and plan that suit you, and save week by week.",
  ],
];

const EXPECT = [
  [
    "Registration goes through an agent.",
    "Choose your agent on the Apply page. Each agent has their own registration form.",
  ],
  [
    "Fees are separate from savings.",
    "Registration and subscription fees never add to your savings balance.",
  ],
  [
    "Plan terms are confirmed before you join.",
    "Plans are not offers until the organisation publishes them.",
  ],
  [
    "No returns are promised.",
    "Savings goals and targets show direction, not guaranteed outcomes.",
  ],
];

function HomePage() {
  const [openGoal, setOpenGoal] = useState<GoalKey | null>(null);
  return (
    <PublicLayout>
      <div className="home-page">
        <section aria-labelledby="home-title" className="home-hero home-width">
          <HeroRibbons />
          <div className="home-hero-copy">
            <p
              className="home-welcome stagger-in"
              style={{ ["--i" as string]: 0 }}
            >
              <Sparkles aria-hidden="true" />
              Welcome to i-Save
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
              Join i-Save and start with a goal. From education to life’s
              unexpected moments, pick what you are saving for, apply for
              membership and take your first step today.
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

        <StatTiles />

        <HomeDashboard />

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
              {GOAL_CONTENT.map((g, i) => {
                const Icon = GOAL_ICONS[g.key];
                return (
                  <Reveal as="li" index={i} key={g.key}>
                    <button
                      type="button"
                      aria-haspopup="dialog"
                      aria-label={g.label + ": open details"}
                      onClick={() => setOpenGoal(g.key)}
                      className="home-goal w-full text-left"
                    >
                      <Icon className="home-goal-icon" aria-hidden="true" />
                      <div>
                        <h3>{g.label}</h3>
                        <p>{g.purpose}</p>
                      </div>
                      <ArrowRight
                        className="home-goal-arrow"
                        aria-hidden="true"
                      />
                    </button>
                  </Reveal>
                );
              })}
            </ul>
            <p className="home-interest-note">
              Open a goal to see how it works. Plan amounts and terms are shown
              on the Plans page once the organisation approves them.
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
          <div className="home-mid-cta">
            <a href="/apply" className={buttonVariants({ size: "lg" })}>
              Apply for membership
              <ArrowRight aria-hidden="true" />
            </a>
            <a href="/how-it-works" className="home-text-link">
              Read how it works
              <ArrowRight size={17} aria-hidden="true" />
            </a>
          </div>
        </section>

        <HomeSections />

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
      <GoalPanel
        goal={GOAL_CONTENT.find((g) => g.key === openGoal) ?? null}
        onClose={() => setOpenGoal(null)}
      />
    </PublicLayout>
  );
}
