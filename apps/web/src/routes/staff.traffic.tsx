import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AdminOnly } from "@/components/staff/AdminOnly";
import { ErrorLine, PageHeading } from "@/components/staff/FormBits";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { LoadingSkeleton } from "@/components/ui/motion";
import { useTrafficSummary } from "@/lib/traffic";
import {
  PRESET_LABEL,
  barWidth,
  percent,
  rangeForPreset,
  todayInHarare,
  validateRange,
  type RangePreset,
} from "@/lib/traffic-utils";

export const Route = createFileRoute("/staff/traffic")({
  component: () => (
    <AdminOnly title="Traffic">
      <TrafficAdmin />
    </AdminOnly>
  ),
});

const PRESETS: RangePreset[] = ["7d", "30d", "90d", "month"];

function TrafficAdmin() {
  const [initial] = useState(() => rangeForPreset("30d", todayInHarare()));
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const rangeError = validateRange(from, to);
  const { data, isPending, isError } = useTrafficSummary(
    from,
    to,
    rangeError === null,
  );

  function pick(preset: RangePreset) {
    const r = rangeForPreset(preset, todayInHarare());
    setFrom(r.from);
    setTo(r.to);
  }

  const maxViews = Math.max(0, ...(data?.daily.map((d) => d.views) ?? [0]));
  const maxClicks = Math.max(0, ...(data?.agents.map((a) => a.clicks) ?? [0]));
  const t = data?.totals;

  return (
    <div>
      <PageHeading
        title="Traffic"
        lead="Visits to the public site, clicks on Apply to membership, and handoffs to each agent. Days are Zimbabwe days."
      />

      <div className="mt-6 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <Button
            key={p}
            variant={
              rangeForPreset(p, todayInHarare()).from === from &&
              todayInHarare() === to
                ? "default"
                : "outline"
            }
            size="sm"
            onClick={() => pick(p)}
          >
            {PRESET_LABEL[p]}
          </Button>
        ))}
      </div>
      <div className="mt-4 grid max-w-md grid-cols-2 gap-4">
        <Field
          id="tr-from"
          label="From"
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <Field
          id="tr-to"
          label="To"
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
      </div>
      <div className="mt-3">
        <ErrorLine message={rangeError} />
      </div>

      {rangeError === null && isPending && <LoadingSkeleton />}
      {rangeError === null && isError && (
        <ErrorLine message="The traffic figures could not be loaded. Run 018_traffic.sql in Supabase if you have not yet." />
      )}

      {t && data && (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label="Page views" value={t.page_views} />
            <Tile label="Visitors" value={t.visitors} note="Different browsers" />
            <Tile
              label="Apply to membership clicks"
              value={t.apply_clicks}
              note="Clicks on links to the Apply page"
            />
            <Tile
              label="Agent handoffs"
              value={t.agent_clicks}
              note={`${percent(t.agent_clicks, t.apply_page_views)} of ${t.apply_page_views} Apply page views`}
            />
          </div>

          <Section title="Per agent">
            {data.agents.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No agents yet. Add them under Agents.
              </p>
            ) : (
              <Table
                head={["Agent", "Handoffs", "Share", "Visitors"]}
                rows={data.agents.map((a) => [
                  <span key="n">
                    {a.name}
                    {a.removed && (
                      <span className="ml-2 text-muted-foreground">
                        · Removed
                      </span>
                    )}
                    <Bar value={a.clicks} max={maxClicks} />
                  </span>,
                  a.clicks,
                  percent(a.clicks, t.agent_clicks),
                  a.visitors,
                ])}
              />
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              A handoff is a click on an agent's button. Registrations finished
              on the agent's own site are not counted here.
            </p>
          </Section>

          <Section title="Per page">
            {data.pages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No visits in this range.
              </p>
            ) : (
              <Table
                head={["Page", "Views", "Visitors"]}
                rows={data.pages.map((p) => [p.path, p.views, p.visitors])}
              />
            )}
          </Section>

          <Section title="Day by day">
            <Table
              head={["Day", "Views", "Apply clicks", "Agent handoffs"]}
              rows={[...data.daily].reverse().map((d) => [
                <span key="d">
                  {d.day}
                  <Bar value={d.views} max={maxViews} />
                </span>,
                d.views,
                d.apply_clicks,
                d.agent_clicks,
              ])}
            />
          </Section>

          <p className="mt-8 text-xs text-muted-foreground">
            Visitors are counted with a random code kept in the browser. No
            names, phone numbers or emails are stored. Visits by signed-in
            staff are not counted.
          </p>
        </>
      )}
    </div>
  );
}

function Tile({
  label,
  value,
  note,
}: {
  label: string;
  value: number;
  note?: string;
}) {
  return (
    <div className="rounded-xl border border-border p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">
        {value.toLocaleString("en-ZW")}
      </p>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Bar({ value, max }: { value: number; max: number }) {
  return (
    <span
      aria-hidden="true"
      className="mt-1 block h-1.5 rounded-full bg-primary/70"
      style={{ width: `${barWidth(value, max)}%` }}
    />
  );
}

function Table({
  head,
  rows,
}: {
  head: string[];
  rows: (string | number | React.ReactNode)[][];
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border bg-muted/40">
          <tr>
            {head.map((h, i) => (
              <th
                key={h}
                scope="col"
                className={`px-3 py-2 font-medium ${i > 0 ? "text-right" : ""}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className="border-b border-border last:border-0">
              {row.map((cell, i) => (
                <td
                  key={i}
                  className={`px-3 py-2 ${i > 0 ? "text-right tabular-nums" : ""}`}
                >
                  {typeof cell === "number"
                    ? cell.toLocaleString("en-ZW")
                    : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
