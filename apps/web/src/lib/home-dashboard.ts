// Pure helpers for the interactive dashboard on the home page. No database or browser code.
//
// The figures are SUMMARIES ONLY (one number per month). Nothing here is about a single member.
// Months in the past are records, the current month is in progress, and months ahead are
// scheduled TARGETS. They are never projected returns.

/**
 * PLACEHOLDER. While this is true the dashboard shows built-in demo figures and says so on the
 * page. Before launch, replace buildSeries() with real summary figures the owner approves, then
 * set this to false. Showing real totals publicly is a decision for the owner.
 */
export const DASHBOARD_IS_DEMO = true;

export type Metric = "savings" | "members";
export type Phase = "past" | "current" | "upcoming";
export type RangeKey = "6m" | "12m" | "all";

export type MonthPoint = {
  key: string; // 2026-11
  label: string; // Nov
  fullLabel: string; // November 2026
  value: number;
  phase: Phase;
};

export const RANGE_LABEL: Record<RangeKey, string> = {
  "6m": "6 months",
  "12m": "12 months",
  all: "All",
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Same numbers every time (no randomness), so the demo does not flicker between visits. */
function unit(n: number): number {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Moves a YYYY-MM month by a number of months. */
export function addMonths(month: string, delta: number): string {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7)) - 1 + delta;
  const year = y + Math.floor(m / 12);
  const mon = ((m % 12) + 12) % 12;
  return `${year}-${String(mon + 1).padStart(2, "0")}`;
}

export const MONTHS_BACK = 11;
export const MONTHS_AHEAD = 5;

/** Demo series: 11 months back, this month, 5 months ahead. `currentMonth` is YYYY-MM. */
export function buildSeries(
  metric: Metric,
  currentMonth: string,
): MonthPoint[] {
  const points: MonthPoint[] = [];
  for (let offset = -MONTHS_BACK; offset <= MONTHS_AHEAD; offset++) {
    const key = addMonths(currentMonth, offset);
    const monthIndex = Number(key.slice(5, 7)) - 1;
    const wave = (unit(offset + (metric === "savings" ? 3 : 41)) - 0.5) * 2;
    const raw =
      metric === "savings"
        ? 84000 + (offset + MONTHS_BACK) * 7400 + wave * 9000
        : 96 + (offset + MONTHS_BACK) * 6.2 + wave * 14;
    const value = Math.max(
      0,
      Math.round(raw / (metric === "savings" ? 500 : 1)) *
        (metric === "savings" ? 500 : 1),
    );
    points.push({
      key,
      label: MONTHS[monthIndex]!.slice(0, 3),
      fullLabel: `${MONTHS[monthIndex]} ${key.slice(0, 4)}`,
      value,
      phase: offset < 0 ? "past" : offset === 0 ? "current" : "upcoming",
    });
  }
  return points;
}

/** The months to show for a range. "6m" is the last 3 months, this month and 2 ahead. */
export function sliceRange(
  points: MonthPoint[],
  range: RangeKey,
): MonthPoint[] {
  if (range === "all") return points;
  const current = points.findIndex((p) => p.phase === "current");
  if (current < 0) return points;
  if (range === "12m")
    return points.slice(Math.max(0, current - 8), current + 4);
  return points.slice(Math.max(0, current - 3), current + 3);
}

/** A round number at or above the biggest value, so the top gridline is tidy. */
export function niceMax(value: number): number {
  if (value <= 0) return 10;
  const pow = Math.pow(10, Math.floor(Math.log10(value)));
  const n = value / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

/** 12500 becomes "12.5k"; small numbers stay as they are. */
export function compactNumber(n: number): string {
  if (n >= 1_000_000) return `${Math.round(n / 100_000) / 10}m`;
  if (n >= 1000) return `${Math.round(n / 100) / 10}k`;
  return String(Math.round(n));
}

export type Summary = {
  recorded: number;
  thisMonth: number;
  scheduled: number;
};

/** Totals for the months on screen: what is recorded, this month so far, and what is scheduled. */
export function summarise(points: MonthPoint[]): Summary {
  let recorded = 0;
  let thisMonth = 0;
  let scheduled = 0;
  for (const p of points) {
    if (p.phase === "past") recorded += p.value;
    else if (p.phase === "current") thisMonth = p.value;
    else scheduled += p.value;
  }
  return { recorded, thisMonth, scheduled };
}

export const PHASE_LABEL: Record<Phase, string> = {
  past: "Recorded",
  current: "This month so far",
  upcoming: "Scheduled target",
};

/** Demo headline figures. PLACEHOLDER: replace with owner-approved numbers (see DASHBOARD_IS_DEMO). */
export const DEMO_KPIS = [
  { label: "Active savers", value: 2460, money: false },
  { label: "Goals reached", value: 479, money: false },
  { label: "Towns reached", value: 18, money: false },
  { label: "Average saved per member", value: 142, money: true },
] as const;

/** Demo split of savers by goal, in percent. PLACEHOLDER, adds up to 100. */
export const DEMO_GOAL_SHARES = [
  { label: "Asset", percent: 28 },
  { label: "Holiday", percent: 17 },
  { label: "Emergency", percent: 27 },
  { label: "Retrenchment", percent: 10 },
  { label: "Education", percent: 18 },
] as const;

export type DonutSegment = {
  label: string;
  percent: number;
  /** Where the slice starts, as a fraction of the circle (0 to 1). */
  start: number;
  /** How much of the circle it covers (0 to 1). */
  length: number;
};

/** Turns shares into donut slices. The shares are scaled so the slices always fill the circle. */
export function donutSegments(
  shares: readonly { label: string; percent: number }[],
): DonutSegment[] {
  const total = shares.reduce((sum, s) => sum + Math.max(0, s.percent), 0);
  if (total <= 0) return [];
  let start = 0;
  return shares.map((s) => {
    const length = Math.max(0, s.percent) / total;
    const seg = { label: s.label, percent: s.percent, start, length };
    start += length;
    return seg;
  });
}
