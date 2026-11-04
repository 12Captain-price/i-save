import { useState } from "react";
import { ArrowRight, Flag, Target } from "lucide-react";
import { RichText } from "@/components/site/RichText";
import { buttonVariants } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import {
  WEEK_PRESETS,
  planGoal,
} from "@/lib/goal-plan-utils";
import type { PlanTerms } from "@/lib/member";
import { formatMoney } from "@/lib/money";
import { describeDuration, describePlanAmount } from "@/lib/plan-utils";
import { cn } from "@/lib/utils";
import "@/components/site/goal-showcase.css";

/** Eight steps climbing to a flag. Decoration only. */
function Steps() {
  return (
    <svg
      viewBox="0 0 240 130"
      className="goal-steps"
      aria-hidden="true"
      focusable="false"
    >
      {Array.from({ length: 8 }, (_, i) => (
        <rect
          key={i}
          className="goal-step"
          style={{ ["--i" as string]: i }}
          x={6 + i * 28}
          y={112 - (i + 1) * 12}
          width="22"
          height={(i + 1) * 12 + 6}
          rx="4"
        />
      ))}
      <line x1="218" y1="14" x2="218" y2="34" stroke="currentColor" strokeWidth="2" />
      <path d="M218 14 l18 6 l-18 6 z" fill="currentColor" />
    </svg>
  );
}

/**
 * The large, featured goal-based plan. The goal planner on the right only divides a target
 * amount by a number of weeks. It adds no interest or returns and is not an approved offer.
 */
export function GoalPlanShowcase({ plan }: { plan: PlanTerms }) {
  const [target, setTarget] = useState("");
  const [weeks, setWeeks] = useState("52");
  const result = planGoal(target, weeks);
  const touched = target.trim() !== "";

  return (
    <section
      aria-labelledby="goal-plan-title"
      className="goal-showcase"
    >
      <div className="goal-copy">
        <p className="goal-badge">
          <Target aria-hidden="true" />
          Goal-based saving
        </p>
        <h2 id="goal-plan-title">{plan.planName}</h2>
        {plan.planDescription && (
          <p className="goal-lead">{plan.planDescription}</p>
        )}
        <ul className="goal-facts">
          <li>{describePlanAmount(plan)}</li>
          <li>{describeDuration(plan.durationWeeks)}</li>
        </ul>
        {plan.planLongDescription && (
          <RichText
            text={plan.planLongDescription}
            className="goal-body space-y-3 text-sm"
          />
        )}
        <details className="goal-terms">
          <summary>Read the terms</summary>
          <p>{plan.termsText}</p>
        </details>
        <a href="/apply" className={cn(buttonVariants({ size: "lg" }), "goal-cta")}>
          Start with a goal
          <ArrowRight aria-hidden="true" />
        </a>
      </div>

      <div className="goal-planner">
        <Steps />
        <h3>Plan your goal</h3>
        <p className="goal-planner-note">
          Enter what you want to reach and how long you give yourself.
        </p>
        <div className="goal-fields">
          <Field
            id="goal-target"
            label={`Your goal (${plan.currency})`}
            inputMode="decimal"
            autoComplete="off"
            placeholder="for example 2,000"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            error={touched && !result.ok ? result.targetError : undefined}
          />
          <Field
            id="goal-weeks"
            label="Number of weeks"
            inputMode="numeric"
            autoComplete="off"
            value={weeks}
            onChange={(e) => setWeeks(e.target.value)}
            error={!result.ok ? result.weeksError : undefined}
          />
        </div>
        <div className="goal-presets" role="group" aria-label="Quick choices">
          {WEEK_PRESETS.map((p) => (
            <button
              key={p.weeks}
              type="button"
              className="goal-preset"
              aria-pressed={weeks === String(p.weeks)}
              onClick={() => setWeeks(String(p.weeks))}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="goal-result" aria-live="polite">
          {result.ok ? (
            <>
              <p className="goal-result-label">Set aside about</p>
              <p className="goal-result-number">
                {formatMoney(result.weekly, plan.currency)}
                <span> a week</span>
              </p>
              <p className="goal-result-note">
                for {result.weeks} {result.weeks === 1 ? "week" : "weeks"} to reach{" "}
                {formatMoney(result.target, plan.currency)}.
              </p>
            </>
          ) : (
            <p className="goal-result-empty">
              <Flag aria-hidden="true" />
              Your weekly amount appears here.
            </p>
          )}
        </div>
        <p className="goal-fineprint">
          A planning guide only. It does not include interest or returns, and it is not an
          approved offer. The plan’s terms above decide what you actually save.
        </p>
      </div>
    </section>
  );
}
