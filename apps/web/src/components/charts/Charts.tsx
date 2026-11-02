import {
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { Legend } from "@/components/charts/ChartParts";
import { compactNumber, niceScale, percentOf } from "@/lib/chart-utils";

/*
 * Small SVG charts with no chart library. Each one is interactive: hover or touch shows the
 * exact figures, and the keyboard arrow keys do the same. Values arrive as plain numbers for
 * drawing; the exact text to show (money, counts) arrives as `format`, so no money is ever
 * rounded or added up here.
 */

const W = 640;
const H = 260;
const PAD = { top: 16, right: 16, bottom: 28, left: 44 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

export type Series = {
  key: string;
  label: string;
  color: string;
  values: number[];
};

type Format = (n: number) => string;

function Tooltip({
  leftPct,
  title,
  rows,
}: {
  leftPct: number;
  title: string;
  rows: { label: string; value: string; color: string }[];
}) {
  const flip = leftPct > 62;
  return (
    <div
      role="status"
      className="pointer-events-none absolute top-2 z-10 min-w-36 rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg"
      style={
        flip ? { right: `${100 - leftPct + 2}%` } : { left: `${leftPct + 2}%` }
      }
    >
      <p className="mb-1 font-semibold">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <span
              aria-hidden
              className="size-2 rounded-full"
              style={{ background: r.color }}
            />
            {r.label}
          </span>
          <span className="font-semibold tabular-nums">{r.value}</span>
        </p>
      ))}
    </div>
  );
}

function useActiveIndex(count: number) {
  const [active, setActive] = useState<number | null>(null);
  const ref = useRef<SVGSVGElement>(null);

  function fromPointer(e: PointerEvent<SVGSVGElement>) {
    const box = ref.current?.getBoundingClientRect();
    if (!box || box.width === 0 || count === 0) return;
    const x = ((e.clientX - box.left) / box.width) * W - PAD.left;
    const slot = PLOT_W / count;
    setActive(Math.min(count - 1, Math.max(0, Math.floor(x / slot))));
  }
  function onKeyDown(e: KeyboardEvent<SVGSVGElement>) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setActive((a) => Math.min(count - 1, (a ?? -1) + 1));
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setActive((a) => Math.max(0, (a ?? count) - 1));
    } else if (e.key === "Escape") setActive(null);
  }
  return { active, setActive, ref, fromPointer, onKeyDown };
}

function Grid({
  ticks,
  top,
  axisFormat,
}: {
  ticks: number[];
  top: number;
  axisFormat: Format;
}) {
  return (
    <g>
      {ticks.map((t) => {
        const y = PAD.top + PLOT_H - (t / top) * PLOT_H;
        return (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y}
              y2={y}
              stroke="var(--border)"
              strokeDasharray={t === 0 ? undefined : "3 4"}
            />
            <text
              x={PAD.left - 8}
              y={y + 4}
              textAnchor="end"
              fontSize="11"
              fill="var(--muted-foreground)"
            >
              {axisFormat(t)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/** One or more lines, optionally filled, with a goal line. */
export function LineChart({
  title,
  labels,
  tooltipLabels,
  series,
  format,
  area = true,
  goal,
  integerAxis = false,
}: {
  title: string;
  labels: string[];
  tooltipLabels?: string[];
  series: Series[];
  format: Format;
  area?: boolean;
  goal?: { value: number; label: string };
  integerAxis?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const n = labels.length;
  const { active, setActive, ref, fromPointer, onKeyDown } = useActiveIndex(n);
  const max = Math.max(0, goal?.value ?? 0, ...series.flatMap((s) => s.values));
  const { top, ticks } = niceScale(integerAxis ? Math.max(max, 4) : max);
  const x = (i: number) =>
    PAD.left + (n <= 1 ? PLOT_W / 2 : (i / (n - 1)) * PLOT_W);
  const y = (v: number) => PAD.top + PLOT_H - (v / top) * PLOT_H;
  const step = Math.ceil(n / 8);

  return (
    <div className="relative">
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={title}
        tabIndex={0}
        className="h-auto w-full touch-pan-y rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        onPointerMove={fromPointer}
        onPointerDown={fromPointer}
        onPointerLeave={() => setActive(null)}
        onBlur={() => setActive(null)}
        onKeyDown={onKeyDown}
      >
        <defs>
          {series.map((s) => (
            <linearGradient
              key={s.key}
              id={`${uid}-${s.key}`}
              x1="0"
              x2="0"
              y1="0"
              y2="1"
            >
              <stop offset="0%" stopColor={s.color} stopOpacity="0.38" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        <Grid ticks={ticks} top={top} axisFormat={(t) => compactNumber(t)} />
        {goal && goal.value > 0 && (
          <g>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(goal.value)}
              y2={y(goal.value)}
              stroke="var(--portal-warm)"
              strokeDasharray="6 4"
            />
            <text
              x={W - PAD.right}
              y={y(goal.value) - 6}
              textAnchor="end"
              fontSize="11"
              fill="var(--portal-warm)"
            >
              {goal.label}
            </text>
          </g>
        )}
        {labels.map((l, i) =>
          i % step === 0 || i === n - 1 ? (
            <text
              key={l + i}
              x={x(i)}
              y={H - 8}
              textAnchor="middle"
              fontSize="11"
              fill="var(--muted-foreground)"
            >
              {l}
            </text>
          ) : null,
        )}
        {series.map((s) => {
          const line = s.values
            .map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`)
            .join(" ");
          const fill = `${line} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z`;
          return (
            <g key={s.key}>
              {area && n > 1 && (
                <path d={fill} fill={`url(#${uid}-${s.key})`} />
              )}
              <path
                d={line}
                fill="none"
                stroke={s.color}
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {n === 1 && (
                <circle
                  cx={x(0)}
                  cy={y(s.values[0] ?? 0)}
                  r="4"
                  fill={s.color}
                />
              )}
            </g>
          );
        })}
        {active !== null && (
          <g>
            <line
              x1={x(active)}
              x2={x(active)}
              y1={PAD.top}
              y2={PAD.top + PLOT_H}
              stroke="var(--muted-foreground)"
              strokeOpacity="0.5"
            />
            {series.map((s) => (
              <circle
                key={s.key}
                cx={x(active)}
                cy={y(s.values[active] ?? 0)}
                r="5"
                fill={s.color}
                stroke="var(--card)"
                strokeWidth="2"
              />
            ))}
          </g>
        )}
      </svg>
      {active !== null && (
        <Tooltip
          leftPct={(x(active) / W) * 100}
          title={tooltipLabels?.[active] ?? labels[active] ?? ""}
          rows={series.map((s) => ({
            label: s.label,
            value: format(s.values[active] ?? 0),
            color: s.color,
          }))}
        />
      )}
      {series.length > 1 && (
        <div className="mt-2">
          <Legend
            items={series.map((s) => ({
              key: s.key,
              label: s.label,
              color: s.color,
            }))}
          />
        </div>
      )}
    </div>
  );
}

/** Stacked bars. Click a legend name to hide or show that part. */
export function StackedBars({
  title,
  labels,
  tooltipLabels,
  series,
  format,
}: {
  title: string;
  labels: string[];
  tooltipLabels?: string[];
  series: Series[];
  format: Format;
}) {
  const n = labels.length;
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const { active, setActive, ref, fromPointer, onKeyDown } = useActiveIndex(n);
  const shown = series.filter((s) => !hidden.has(s.key));
  const totals = labels.map((_, i) =>
    shown.reduce((sum, s) => sum + (s.values[i] ?? 0), 0),
  );
  const { top, ticks } = niceScale(Math.max(0, ...totals));
  const slot = PLOT_W / Math.max(n, 1);
  const barW = Math.min(44, slot * 0.62);
  const y = (v: number) => PAD.top + PLOT_H - (v / top) * PLOT_H;

  function toggle(key: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else if (series.length - next.size > 1) next.add(key);
      return next;
    });
  }

  return (
    <div className="relative">
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={title}
        tabIndex={0}
        className="h-auto w-full touch-pan-y rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        onPointerMove={fromPointer}
        onPointerDown={fromPointer}
        onPointerLeave={() => setActive(null)}
        onBlur={() => setActive(null)}
        onKeyDown={onKeyDown}
      >
        <Grid ticks={ticks} top={top} axisFormat={(t) => compactNumber(t)} />
        {labels.map((l, i) => {
          const cx = PAD.left + slot * i + slot / 2;
          let acc = 0;
          return (
            <g key={l + i} opacity={active === null || active === i ? 1 : 0.45}>
              {active === i && (
                <rect
                  x={cx - slot / 2 + 2}
                  y={PAD.top}
                  width={slot - 4}
                  height={PLOT_H}
                  rx="6"
                  fill="var(--muted-foreground)"
                  fillOpacity="0.1"
                />
              )}
              {shown.map((s) => {
                const v = s.values[i] ?? 0;
                if (v <= 0) return null;
                const y1 = y(acc + v);
                const h = y(acc) - y1;
                acc += v;
                return (
                  <rect
                    key={s.key}
                    x={cx - barW / 2}
                    y={y1}
                    width={barW}
                    height={Math.max(h, 1)}
                    rx="2"
                    fill={s.color}
                  />
                );
              })}
              <text
                x={cx}
                y={H - 8}
                textAnchor="middle"
                fontSize="11"
                fill="var(--muted-foreground)"
              >
                {l}
              </text>
            </g>
          );
        })}
      </svg>
      {active !== null && (
        <Tooltip
          leftPct={((PAD.left + slot * active + slot / 2) / W) * 100}
          title={tooltipLabels?.[active] ?? labels[active] ?? ""}
          rows={[
            ...shown.map((s) => ({
              label: s.label,
              value: format(s.values[active] ?? 0),
              color: s.color,
            })),
            {
              label: "Total",
              value: format(totals[active] ?? 0),
              color: "var(--foreground)",
            },
          ]}
        />
      )}
      <div className="mt-2">
        <Legend
          items={series.map((s) => ({
            key: s.key,
            label: s.label,
            color: s.color,
          }))}
          hidden={hidden}
          onToggle={toggle}
        />
      </div>
    </div>
  );
}

export type Slice = {
  key: string;
  label: string;
  value: number;
  color: string;
};

/** A ring split into parts, with the same parts listed beside it. Hover either to focus. */
export function DonutChart({
  title,
  slices,
  centerValue,
  centerLabel,
  format,
}: {
  title: string;
  slices: Slice[];
  centerValue: string;
  centerLabel: string;
  format: Format;
}) {
  const [focus, setFocus] = useState<string | null>(null);
  const total = slices.reduce((s, x) => s + x.value, 0);
  const R = 62;
  const C = 2 * Math.PI * R;
  let offset = 0;
  const focused = slices.find((s) => s.key === focus);

  return (
    <div className="grid items-center gap-4 sm:grid-cols-[auto_1fr]">
      <svg
        viewBox="0 0 160 160"
        role="img"
        aria-label={title}
        className="mx-auto size-40"
      >
        <circle
          cx="80"
          cy="80"
          r={R}
          fill="none"
          stroke="var(--border)"
          strokeWidth="18"
        />
        {total > 0 &&
          slices.map((s) => {
            const len = (s.value / total) * C;
            const el = (
              <circle
                key={s.key}
                cx="80"
                cy="80"
                r={R}
                fill="none"
                stroke={s.color}
                strokeWidth={focus === s.key ? 22 : 18}
                strokeDasharray={`${Math.max(len - 1.5, 0)} ${C - Math.max(len - 1.5, 0)}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 80 80)"
                opacity={focus === null || focus === s.key ? 1 : 0.35}
                style={{ transition: "stroke-width 120ms, opacity 120ms" }}
                onPointerEnter={() => setFocus(s.key)}
                onPointerLeave={() => setFocus(null)}
              />
            );
            offset += len;
            return el;
          })}
        <text
          x="80"
          y="78"
          textAnchor="middle"
          fontSize="20"
          fontWeight="700"
          fill="var(--foreground)"
        >
          {focused ? format(focused.value) : centerValue}
        </text>
        <text
          x="80"
          y="96"
          textAnchor="middle"
          fontSize="10"
          fill="var(--muted-foreground)"
        >
          {focused ? focused.label : centerLabel}
        </text>
      </svg>
      <ul className="grid gap-1.5 text-sm">
        {slices.map((s) => (
          <li key={s.key}>
            <button
              type="button"
              onPointerEnter={() => setFocus(s.key)}
              onPointerLeave={() => setFocus(null)}
              onFocus={() => setFocus(s.key)}
              onBlur={() => setFocus(null)}
              className="flex min-h-9 w-full cursor-pointer items-center justify-between gap-3 rounded-md px-2 text-left hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <span className="inline-flex items-center gap-2">
                <span
                  aria-hidden
                  className="size-2.5 rounded-sm"
                  style={{ background: s.color }}
                />
                {s.label}
              </span>
              <span className="tabular-nums">
                <strong>{format(s.value)}</strong>{" "}
                <span className="text-xs text-muted-foreground">
                  {percentOf(s.value, total)}%
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A single progress ring, for example "7 of 26 contributions". */
export function ProgressRing({
  percent,
  label,
  sub,
  color = "var(--primary)",
  size = 132,
}: {
  percent: number;
  label: string;
  sub: string;
  color?: string;
  size?: number;
}) {
  const p = Math.max(0, Math.min(100, percent));
  const R = 52;
  const C = 2 * Math.PI * R;
  return (
    <svg
      viewBox="0 0 130 130"
      width={size}
      height={size}
      role="img"
      aria-label={`${label}, ${sub}`}
    >
      <circle
        cx="65"
        cy="65"
        r={R}
        fill="none"
        stroke="var(--border)"
        strokeWidth="12"
      />
      <circle
        cx="65"
        cy="65"
        r={R}
        fill="none"
        stroke={color}
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={`${(p / 100) * C} ${C}`}
        transform="rotate(-90 65 65)"
        style={{ transition: "stroke-dasharray 500ms ease" }}
      />
      <text
        x="65"
        y="64"
        textAnchor="middle"
        fontSize="22"
        fontWeight="700"
        fill="var(--foreground)"
      >
        {label}
      </text>
      <text
        x="65"
        y="82"
        textAnchor="middle"
        fontSize="10"
        fill="var(--muted-foreground)"
      >
        {sub}
      </text>
    </svg>
  );
}
