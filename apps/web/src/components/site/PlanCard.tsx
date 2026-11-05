import { useEffect, useRef, useState } from "react";
import { PlanAnimation } from "@/components/site/PlanAnimation";
import { RichText } from "@/components/site/RichText";
import type { PlanTerms } from "@/lib/member";
import { describeDuration, describePlanAmount } from "@/lib/plan-utils";
import "./plan-card.css";

const PLAY_MS = 3000;

/** A plan on the public Plans page. Clicking the picture plays its animation. */
export function PlanCard({ plan }: { plan: PlanTerms }) {
  const [run, setRun] = useState(0); // changes on each click so the animation restarts
  const [playing, setPlaying] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  function play() {
    window.clearTimeout(timer.current);
    setRun((n) => n + 1);
    setPlaying(true);
    timer.current = window.setTimeout(() => setPlaying(false), PLAY_MS);
  }

  return (
    <li className="relative overflow-hidden rounded-xl border border-border bg-card">
      {plan.isGoalBased && <span className="plan-ribbon">COMBO</span>}
      <button
        type="button"
        className="pa-stage"
        onClick={play}
        aria-label={`Play the animation for ${plan.planName}`}
      >
        <PlanAnimation key={run} theme={plan.theme} playing={playing} />
      </button>
      <div className="p-6">
        <h2 className="text-lg font-semibold">{plan.planName}</h2>
        {plan.isGoalBased && (
          <p className="mt-1 text-sm font-medium text-primary">
            Save for more than one goal in one plan
          </p>
        )}
        {plan.comboGoals.length > 0 && (
          <ul
            className="mt-2 flex flex-wrap gap-1.5"
            aria-label="Goals in this plan"
          >
            {plan.comboGoals.map((g) => (
              <li
                key={g}
                className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium"
              >
                {g}
              </li>
            ))}
          </ul>
        )}
        {plan.planDescription && (
          <p className="mt-2 text-sm text-muted-foreground">
            {plan.planDescription}
          </p>
        )}
        <p className="mt-3 font-display text-2xl font-semibold text-primary">
          {describePlanAmount(plan)}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {describeDuration(plan.durationWeeks)}
          {plan.durationWeeks === null ? "" : " in total"}
        </p>
        {plan.planLongDescription && (
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer text-primary underline underline-offset-4">
              About this plan
            </summary>
            <RichText
              text={plan.planLongDescription}
              className="mt-2 space-y-3 text-sm"
            />
          </details>
        )}
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-primary underline underline-offset-4">
            Read the terms
          </summary>
          <p className="mt-2 whitespace-pre-wrap">{plan.termsText}</p>
        </details>
      </div>
    </li>
  );
}
