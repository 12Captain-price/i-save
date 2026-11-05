import { useMemo, useState } from "react";
import { GoalShareDonut } from "@/components/site/GoalShareDonut";
import { Reveal } from "@/components/site/Reveal";
import {
  PHASE_LABEL,
  RANGE_LABEL,
  buildSeries,
  compactNumber,
  niceMax,
  sliceRange,
  summarise,
  type Metric,
  type MonthPoint,
  type RangeKey,
} from "@/lib/home-dashboard";
import {
  kpisFrom,
  useDashboardFigures,
  withOverrides,
} from "@/lib/dashboard-figures";
import { formatCount } from "@/lib/home-stats";
import { todayInHarare } from "@/lib/traffic-utils";
import { cn } from "@/lib/utils";
import "@/components/site/home-dashboard.css";

const METRICS: { key: Metric; label: string; unit: string; money: boolean }[] =
  [
    {
      key: "savings",
      label: "Savings recorded",
      unit: "per month",
      money: true,
    },
    {
      key: "members",
      label: "Members registered",
      unit: "per month",
      money: false,
    },
  ];
const RANGES: RangeKey[] = ["6m", "12m", "all"];

const W = 640;
const H = 280;
const PAD = { left: 52, right: 12, top: 16, bottom: 34 };

function show(value: number, money: boolean): string {
  return money ? `$${formatCount(value)}` : formatCount(value);
}

/**
 * Past, present and upcoming figures as month-by-month bars. Summary numbers only: nothing
 * about any single member. Months ahead are scheduled targets, never projected returns.
 * Hover or tab to a bar for its details.
 */
export function HomeDashboard() {
  const figures = useDashboardFigures();
  if (!figures) return null;
  return <Dashboard figures={figures} />;
}

function Dashboard({
  figures,
}: {
  figures: NonNullable<ReturnType<typeof useDashboardFigures>>;
}) {
  const [metric, setMetric] = useState<Metric>("savings");
  const [range, setRange] = useState<RangeKey>("12m");
  const [active, setActive] = useState<number | null>(null);

  const current = todayInHarare().slice(0, 7);
  const meta = METRICS.find((m) => m.key === metric)!;
  const points = useMemo(
    () =>
      sliceRange(
        withOverrides(buildSeries(metric, current), figures.monthly, metric),
        range,
      ),
    [metric, range, current, figures.monthly],
  );
  const summary = summarise(points);
  const top = niceMax(Math.max(...points.map((p) => p.value)));
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const slot = plotW / points.length;
  const barW = Math.min(34, slot * 0.62);
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => top * f);
  const tip: MonthPoint | null =
    active === null ? null : (points[active] ?? null);

  return (
    <section
      aria-labelledby="home-dash-title"
      className="home-width home-dash-wrap"
    >
      <Reveal className="home-section-heading">
        <p className="home-eyebrow">Our community at a glance</p>
        <h2 id="home-dash-title">Where i-Save is, and where it is heading.</h2>
      </Reveal>

      <Reveal className="home-dash">
        <dl className="home-kpis">
          {kpisFrom(figures).map((k) => (
            <div key={k.label}>
              <dd>{show(k.value, k.money)}</dd>
              <dt>{k.label}</dt>
            </div>
          ))}
        </dl>

        <div className="home-dash-controls">
          <div role="group" aria-label="What to show" className="home-seg">
            {METRICS.map((m) => (
              <button
                key={m.key}
                type="button"
                aria-pressed={metric === m.key}
                onClick={() => {
                  setMetric(m.key);
                  setActive(null);
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div role="group" aria-label="Time range" className="home-seg">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={range === r}
                onClick={() => {
                  setRange(r);
                  setActive(null);
                }}
              >
                {RANGE_LABEL[r]}
              </button>
            ))}
          </div>
        </div>

        <dl className="home-dash-summary">
          <div>
            <dt>Recorded so far</dt>
            <dd>{show(summary.recorded, meta.money)}</dd>
          </div>
          <div>
            <dt>This month so far</dt>
            <dd>{show(summary.thisMonth, meta.money)}</dd>
          </div>
          <div>
            <dt>Scheduled target ahead</dt>
            <dd>{show(summary.scheduled, meta.money)}</dd>
          </div>
        </dl>

        <div className="home-dash-chart">
          <svg
            key={`${metric}-${range}`}
            viewBox={`0 0 ${W} ${H}`}
            role="group"
            aria-label={`${meta.label}, ${meta.unit}. Use Tab to move between months.`}
            onMouseLeave={() => setActive(null)}
          >
            <defs>
              <pattern
                id="dash-hatch"
                width="6"
                height="6"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <rect width="6" height="6" fill="transparent" />
                <rect
                  width="2.5"
                  height="6"
                  fill="var(--primary)"
                  opacity="0.35"
                />
              </pattern>
            </defs>
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={PAD.left}
                  x2={W - PAD.right}
                  y1={y(t)}
                  y2={y(t)}
                  className="dash-grid"
                />
                <text
                  x={PAD.left - 8}
                  y={y(t) + 4}
                  textAnchor="end"
                  className="dash-axis"
                >
                  {meta.money ? "$" : ""}
                  {compactNumber(t)}
                </text>
              </g>
            ))}
            {points.map((p, i) => {
              const x = PAD.left + slot * i + (slot - barW) / 2;
              const h = Math.max(2, plotH - (y(p.value) - PAD.top));
              return (
                <g
                  key={p.key}
                  tabIndex={0}
                  role="img"
                  aria-label={`${p.fullLabel}: ${show(p.value, meta.money)}. ${PHASE_LABEL[p.phase]}.`}
                  className={cn(
                    "dash-bar",
                    `dash-${p.phase}`,
                    active === i && "is-active",
                  )}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                >
                  <rect
                    x={PAD.left + slot * i}
                    y={PAD.top}
                    width={slot}
                    height={plotH}
                    fill="transparent"
                  />
                  <rect
                    className="dash-fill"
                    x={x}
                    y={y(p.value)}
                    width={barW}
                    height={h}
                    rx="4"
                    style={{ ["--i" as string]: i }}
                  />
                  <text
                    x={PAD.left + slot * i + slot / 2}
                    y={H - 12}
                    textAnchor="middle"
                    className="dash-axis"
                  >
                    {p.label}
                  </text>
                </g>
              );
            })}
          </svg>
          {tip && active !== null && (
            <div
              className="dash-tip"
              role="status"
              style={{
                left: `${((PAD.left + slot * active + slot / 2) / W) * 100}%`,
              }}
            >
              <strong>{tip.fullLabel}</strong>
              <span className="dash-tip-value">
                {show(tip.value, meta.money)}
              </span>
              <span className="dash-tip-phase">{PHASE_LABEL[tip.phase]}</span>
            </div>
          )}
        </div>

        <h3 className="home-dash-subhead">Savers by goal</h3>
        <GoalShareDonut />

        <ul className="home-dash-legend" aria-label="Key">
          <li>
            <i className="k-past" /> Recorded
          </li>
          <li>
            <i className="k-current" /> This month so far
          </li>
          <li>
            <i className="k-upcoming" /> Scheduled target
          </li>
        </ul>
        <p className="home-dash-note">
          <strong>
            {figures.illustrative
              ? "Illustrative demo figures. "
              : "Figures supplied by the office. "}
          </strong>
          Monthly totals only, with nothing about any individual member. Months
          ahead are scheduled targets, not returns, and no returns are promised.
        </p>
      </Reveal>
    </section>
  );
}
