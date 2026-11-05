import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Calendar,
  FileText,
  Megaphone,
  MousePointerClick,
  PiggyBank,
  Users,
  UserRoundCheck,
  BarChart3,
} from "lucide-react";
import type { ComponentType } from "react";
import { buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useTrafficSummary } from "@/lib/traffic";
import {
  PRESET_LABEL,
  barWidth,
  percent,
  rangeForPreset,
  todayInHarare,
  type RangePreset,
} from "@/lib/traffic-utils";
import { isAdminRole } from "@/lib/staff-utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/staff/")({
  component: AdminOverview,
});

type Tile = {
  to: string;
  title: string;
  text: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
};

const TILES: Tile[] = [
  { to: "/staff/announcements", title: "Announcements", text: "Post news for visitors and members.", icon: Megaphone },
  { to: "/staff/events", title: "Events", text: "Add and update upcoming and past events.", icon: Calendar },
  { to: "/staff/plans", title: "Savings plans", text: "Plan descriptions, themes and the combo plan.", icon: PiggyBank },
  { to: "/staff/team", title: "Team", text: "The people shown on the Our team page.", icon: Users },
  { to: "/staff/agents", title: "Agents", text: "Photos and links for the Apply page.", icon: UserRoundCheck },
  { to: "/staff/traffic", title: "Traffic", text: "Visits, Apply clicks and handoffs per agent.", icon: BarChart3 },
  { to: "/staff/content", title: "Pages, FAQs, contact", text: "Edit the public wording and contact details.", icon: FileText },
];

const PRESETS: RangePreset[] = ["7d", "30d", "90d"];

function greeting(): string {
  // Zimbabwe is UTC+2 all year.
  const hour = (new Date().getUTCHours() + 2) % 24;
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function AdminOverview() {
  const { profile, roles } = useAuth();
  const admin = isAdminRole(roles);
  const firstName = profile?.fullName?.split(/\s+/)[0];

  return (
    <div>
      <section className="rounded-2xl border border-border bg-muted/50 p-6 md:p-8">
        <h1 className="text-3xl font-semibold md:text-4xl">
          {greeting()}
          {firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Here is how the site is doing. Pick a period, then use the tiles below
          to change what visitors see.
        </p>
        {admin && <Report />}
      </section>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TILES.map(({ to, title, text, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="group flex min-h-32 flex-col rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <h2 className="mt-3 text-lg font-semibold group-hover:underline">
              {title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{text}</p>
          </Link>
        ))}
      </div>

      <div className="mt-8">
        <Link to="/" className={buttonVariants({ variant: "outline" })}>
          View the public site
        </Link>
      </div>
    </div>
  );
}

function Report() {
  const [preset, setPreset] = useState<RangePreset>("30d");
  const [hover, setHover] = useState<number | null>(null);
  const today = todayInHarare();
  const range = rangeForPreset(preset, today);
  const { data, isPending, isError } = useTrafficSummary(
    range.from,
    range.to,
    true,
  );

  const daily = data?.daily ?? [];
  const max = Math.max(0, ...daily.map((d) => d.views));
  const shown = hover !== null ? daily[hover] : null;
  const t = data?.totals;

  return (
    <div className="mt-6">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Report period">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={p === preset}
            onClick={() => setPreset(p)}
            className={cn(
              "min-h-9 rounded-full border px-4 text-sm font-semibold transition-colors",
              p === preset
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:border-primary",
            )}
          >
            {PRESET_LABEL[p]}
          </button>
        ))}
      </div>

      {isPending && (
        <p className="mt-4 text-sm text-muted-foreground">Loading figures…</p>
      )}
      {isError && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          The figures could not be loaded. Run 018_traffic.sql in Supabase if you
          have not yet.
        </p>
      )}

      {t && (
        <>
          <dl className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Page views" value={t.page_views} />
            <Stat label="Visitors" value={t.visitors} />
            <Stat label="Apply clicks" value={t.apply_clicks} />
            <Stat
              label="Agent handoffs"
              value={t.agent_clicks}
              note={`${percent(t.agent_clicks, t.apply_page_views)} of Apply page views`}
            />
          </dl>

          <div className="mt-5 rounded-xl border border-border bg-card p-4">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <MousePointerClick className="h-4 w-4 text-primary" aria-hidden />
                Page views per day
              </h2>
              <p className="min-h-5 text-xs text-muted-foreground" aria-live="polite">
                {shown
                  ? `${shown.day}: ${shown.views} views, ${shown.apply_clicks} Apply clicks`
                  : "Hover or tap a bar"}
              </p>
            </div>
            {daily.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                No visits in this period yet.
              </p>
            ) : (
              <div
                className="mt-3 flex h-28 items-end gap-px overflow-x-auto"
                role="list"
                aria-label="Page views per day"
              >
                {daily.map((d, i) => (
                  <button
                    key={d.day}
                    type="button"
                    role="listitem"
                    aria-label={`${d.day}: ${d.views} views`}
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    onClick={() => setHover(i)}
                    className="flex h-full min-w-1.5 flex-1 items-end"
                  >
                    <span
                      className={cn(
                        "w-full rounded-t-sm transition-colors",
                        hover === i ? "bg-primary" : "bg-primary/50",
                      )}
                      style={{ height: `${Math.max(4, barWidth(d.views, max))}%` }}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  note,
}: {
  label: string;
  value: number;
  note?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-3xl font-semibold tabular-nums">
        {value.toLocaleString("en-ZW")}
      </dd>
      {note && <dd className="mt-1 text-xs text-muted-foreground">{note}</dd>}
    </div>
  );
}
