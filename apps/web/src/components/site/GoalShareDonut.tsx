import { useState } from "react";
import { DEMO_GOAL_SHARES, donutSegments } from "@/lib/home-dashboard";
import { cn } from "@/lib/utils";

const COLORS = ["#e0a526", "#7cc4f0", "#34d399", "#f87171", "#a78bfa"];
const R = 15.9155; // circumference 100, so a slice's length is its percentage

/** Share of savers by goal as a donut. Hover, tap or tab to a slice or a legend row. */
export function GoalShareDonut() {
  const segments = donutSegments(DEMO_GOAL_SHARES);
  const [active, setActive] = useState<number | null>(null);
  const shown = active === null ? null : segments[active];

  return (
    <div className="home-donut">
      <div className="home-donut-chart">
        <svg
          viewBox="0 0 42 42"
          role="img"
          aria-label={`Savers by goal: ${segments
            .map((s) => `${s.label} ${s.percent}%`)
            .join(", ")}.`}
        >
          <circle
            cx="21"
            cy="21"
            r={R}
            fill="none"
            className="home-donut-track"
            strokeWidth="6"
          />
          {segments.map((s, i) => (
            <circle
              key={s.label}
              cx="21"
              cy="21"
              r={R}
              fill="none"
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={active === i ? 7.5 : 6}
              strokeDasharray={`${Math.max(0, s.length * 100 - 0.8)} ${100 - Math.max(0, s.length * 100 - 0.8)}`}
              strokeDashoffset={-s.start * 100}
              transform="rotate(-90 21 21)"
              className="home-donut-slice"
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onClick={() => setActive(i)}
            />
          ))}
        </svg>
        <div className="home-donut-centre" aria-live="polite">
          <strong>{shown ? `${shown.percent}%` : "5 goals"}</strong>
          <span>{shown ? shown.label : "Share of savers"}</span>
        </div>
      </div>
      <ul className="home-donut-legend">
        {segments.map((s, i) => (
          <li key={s.label}>
            <button
              type="button"
              className={cn(active === i && "is-active")}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
            >
              <i style={{ background: COLORS[i % COLORS.length] }} />
              {s.label}
              <b>{s.percent}%</b>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
