import type { TrafficSummaryData } from "@/lib/traffic";
import { addDays, percent } from "@/lib/traffic-utils";

// Turns the raw traffic figures into a short report: what happened, how it compares with the
// period before, and where visitors dropped off. Pure functions, no database or browser code.

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Whole days in a range, both ends included. */
export function daysInRange(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000) + 1;
}

/** The same number of days straight before this range, for "compared with". */
export function previousRange(from: string, to: string) {
  const n = daysInRange(from, to);
  return { from: addDays(from, -n), to: addDays(from, -1) };
}

/** "Tue 4 Nov" */
export function formatDay(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "4 Nov to 10 Nov 2026" */
export function formatRange(from: string, to: string): string {
  const f = new Date(`${from}T00:00:00Z`);
  const t = new Date(`${to}T00:00:00Z`);
  const fy = f.getUTCFullYear();
  const ty = t.getUTCFullYear();
  const part = (d: Date, withYear: boolean) =>
    `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}${withYear ? ` ${d.getUTCFullYear()}` : ""}`;
  if (from === to) return part(t, true);
  return `${part(f, fy !== ty)} to ${part(t, true)}`;
}

const PAGE_NAMES: Record<string, string> = {
  "/": "Home page",
  "/plans": "Savings goals and plans",
  "/apply": "Apply for membership",
  "/fees": "Fees",
  "/announcements": "Announcements",
  "/events": "Events",
  "/team": "Our team",
  "/contact": "Contact",
  "/faqs": "FAQs",
  "/terms": "Terms",
  "/privacy": "Privacy notice",
  "/disclosures": "Risk and withdrawal disclosure",
};

/** A readable name for a page path. Unknown paths are shown as they are. */
export function pageName(path: string): string {
  if (PAGE_NAMES[path]) return PAGE_NAMES[path]!;
  if (/^\/events\/[^/]+$/.test(path)) return "An event page";
  if (/^\/announcements\/[^/]+$/.test(path)) return "An announcement";
  return path;
}

export type Change = {
  /** "up", "down", "same", or "new" when the period before had nothing to compare with. */
  direction: "up" | "down" | "same" | "new";
  /** Rounded percentage, 0 when there is nothing to compare with. */
  pct: number;
};

export function changeBetween(current: number, previous: number): Change {
  if (previous === 0) return { direction: current === 0 ? "same" : "new", pct: 0 };
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return { direction: "same", pct: 0 };
  return { direction: pct > 0 ? "up" : "down", pct: Math.abs(pct) };
}

/** "up 20%", "down 5%", "unchanged", "new this period" */
export function describeChange(c: Change): string {
  switch (c.direction) {
    case "up":
      return `up ${c.pct}%`;
    case "down":
      return `down ${c.pct}%`;
    case "same":
      return "unchanged";
    case "new":
      return "new this period";
  }
}

export type Kpi = {
  label: string;
  value: number;
  note: string;
  change: Change;
};

export type FunnelStep = {
  label: string;
  value: number;
  /** Share of the step before it, as text like "75%", or null for the first step. */
  keptFromPrevious: string | null;
};

export type Report = {
  days: number;
  headline: string;
  highlights: string[];
  kpis: Kpi[];
  funnel: FunnelStep[];
  pages: { name: string; views: number; share: string }[];
  agents: { name: string; removed: boolean; clicks: number; share: string }[];
  weekdays: { label: string; views: number }[] | null;
  busiestDays: { label: string; views: number }[];
  quietDays: number;
  hasTraffic: boolean;
};

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n.toLocaleString("en-ZW")} ${n === 1 ? one : many}`;

export function buildReport(
  cur: TrafficSummaryData,
  prev: TrafficSummaryData | null,
  from: string,
  to: string,
): Report {
  const t = cur.totals;
  const days = daysInRange(from, to);
  const p = prev?.totals;
  const hasTraffic = t.page_views > 0;

  const change = (c: number, pv: number | undefined): Change =>
    pv === undefined ? { direction: "new", pct: 0 } : changeBetween(c, pv);

  const kpis: Kpi[] = [
    {
      label: "Page views",
      value: t.page_views,
      note: "Every page opened",
      change: change(t.page_views, p?.page_views),
    },
    {
      label: "Visitors",
      value: t.visitors,
      note: "Different browsers",
      change: change(t.visitors, p?.visitors),
    },
    {
      label: "Apply clicks",
      value: t.apply_clicks,
      note: "Clicks on Apply to membership",
      change: change(t.apply_clicks, p?.apply_clicks),
    },
    {
      label: "Agent handoffs",
      value: t.agent_clicks,
      note: "Clicks on an agent's button",
      change: change(t.agent_clicks, p?.agent_clicks),
    },
  ];

  const funnel: FunnelStep[] = [
    { label: "Visitors to the site", value: t.visitors, keptFromPrevious: null },
    {
      label: "Opened the Apply page",
      value: t.apply_page_views,
      keptFromPrevious: percent(t.apply_page_views, t.visitors),
    },
    {
      label: "Clicked Apply to membership",
      value: t.apply_clicks,
      keptFromPrevious: percent(t.apply_clicks, t.apply_page_views),
    },
    {
      label: "Went to an agent to register",
      value: t.agent_clicks,
      keptFromPrevious: percent(t.agent_clicks, t.apply_clicks),
    },
  ];

  const pages = cur.pages.slice(0, 8).map((x) => ({
    name: pageName(x.path),
    views: x.views,
    share: percent(x.views, t.page_views),
  }));

  const agents = cur.agents.map((a) => ({
    name: a.name,
    removed: a.removed,
    clicks: a.clicks,
    share: percent(a.clicks, t.agent_clicks),
  }));

  const busiestDays = [...cur.daily]
    .filter((d) => d.views > 0)
    .sort((a, b) => b.views - a.views || (a.day < b.day ? 1 : -1))
    .slice(0, 3)
    .map((d) => ({ label: formatDay(d.day), views: d.views }));
  const quietDays = cur.daily.filter((d) => d.views === 0).length;

  // The weekday pattern only means something once the range covers each weekday at least once.
  let weekdays: Report["weekdays"] = null;
  if (days >= 7 && hasTraffic) {
    const sums = [0, 0, 0, 0, 0, 0, 0];
    for (const d of cur.daily)
      sums[new Date(`${d.day}T00:00:00Z`).getUTCDay()]! += d.views;
    weekdays = [1, 2, 3, 4, 5, 6, 0].map((i) => ({
      label: WEEKDAYS[i]!,
      views: sums[i]!,
    }));
  }

  // ---- the plain-language summary -------------------------------------------------------
  const highlights: string[] = [];
  let headline: string;

  if (!hasTraffic) {
    headline = "No one visited the site in this period.";
  } else {
    const trend =
      p === undefined
        ? ""
        : p.page_views === 0
          ? ", with nothing to compare against in the period before"
          : `, ${describeChange(changeBetween(t.page_views, p.page_views))} on the ${days === 1 ? "day" : `${days} days`} before`;
    headline = `The site had ${plural(t.page_views, "page view")} from ${plural(t.visitors, "visitor")}${trend}.`;

    if (t.visitors > 0) {
      const per = Math.round((t.page_views / t.visitors) * 10) / 10;
      highlights.push(
        `Each visitor looked at ${per.toLocaleString("en-ZW")} ${per === 1 ? "page" : "pages"} on average.`,
      );
    }
    if (busiestDays[0] && days > 1)
      highlights.push(
        `The busiest day was ${busiestDays[0].label}, with ${plural(busiestDays[0].views, "view")}.`,
      );
    if (weekdays) {
      const top = [...weekdays].sort((a, b) => b.views - a.views)[0]!;
      if (top.views > 0)
        highlights.push(`${top.label} was the busiest day of the week.`);
    }
    if (quietDays > 0 && days > 1)
      highlights.push(`${plural(quietDays, "day")} had no visits at all.`);
    if (pages[0])
      highlights.push(
        `The most opened page was “${pages[0].name}” (${plural(pages[0].views, "view")}, ${pages[0].share} of all views).`,
      );
    if (t.apply_clicks === 0)
      highlights.push("No one clicked Apply to membership in this period.");
    else {
      highlights.push(
        `${plural(t.apply_clicks, "click")} on Apply to membership, and ${plural(t.agent_clicks, "click")} on an agent's button (${percent(t.agent_clicks, t.apply_clicks)} of Apply clicks).`,
      );
      const lost = t.apply_clicks - t.agent_clicks;
      if (lost > 0 && t.agent_clicks < t.apply_clicks)
        highlights.push(
          `${plural(lost, "Apply click")} did not reach an agent. Check the Apply page is clear about the next step.`,
        );
    }
    const topAgent = agents.find((a) => a.clicks > 0);
    if (topAgent && t.agent_clicks > 0)
      highlights.push(
        `${topAgent.name} got the most agent handoffs (${plural(topAgent.clicks, "click")}, ${topAgent.share}).`,
      );
    const idle = agents.filter((a) => !a.removed && a.clicks === 0).length;
    if (idle > 0)
      highlights.push(
        `${plural(idle, "agent")} got no clicks. Consider checking their photo and wording.`,
      );
  }

  return {
    days,
    headline,
    highlights,
    kpis,
    funnel,
    pages,
    agents,
    weekdays,
    busiestDays,
    quietDays,
    hasTraffic,
  };
}
