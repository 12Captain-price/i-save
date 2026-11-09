import { useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowDownRight, ArrowUpRight, Minus, Printer } from "lucide-react";
import { AdminOnly } from "@/components/staff/AdminOnly";
import { ErrorLine, PageHeading } from "@/components/staff/FormBits";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { LoadingSkeleton } from "@/components/ui/motion";
import { useTrafficSummary } from "@/lib/traffic";
import {
  buildReport,
  describeChange,
  formatRange,
  previousRange,
  type Change,
  type Report,
} from "@/lib/traffic-report";
import {
  PRESET_LABEL,
  barWidth,
  rangeForPreset,
  todayInHarare,
  validateRange,
  type RangePreset,
} from "@/lib/traffic-utils";

export const Route = createFileRoute("/staff/traffic")({
  component: () => (
    <AdminOnly title="Traffic report">
      <TrafficReport />
    </AdminOnly>
  ),
});

const PRESETS: RangePreset[] = ["7d", "30d", "90d", "month"];

function TrafficReport() {
  const [initial] = useState(() => rangeForPreset("30d", todayInHarare()));
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const rangeError = validateRange(from, to);
  const ok = rangeError === null;
  const before = ok ? previousRange(from, to) : { from, to };

  const cur = useTrafficSummary(from, to, ok);
  const prev = useTrafficSummary(before.from, before.to, ok);

  function pick(preset: RangePreset) {
    const r = rangeForPreset(preset, todayInHarare());
    setFrom(r.from);
    setTo(r.to);
  }

  const report: Report | null =
    ok && cur.data ? buildReport(cur.data, prev.data ?? null, from, to) : null;

  return (
    <div className="traffic-report">
      <PageHeading
        title="Traffic report"
        lead="What happened on the public site in the period you choose, in plain words, and how it compares with the period before. Days are Zimbabwe days."
      />

      <div className="mt-6 flex flex-wrap items-center gap-2 print:hidden">
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
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={() => window.print()}
          disabled={!report}
        >
          <Printer size={16} aria-hidden="true" />
          Print or save as PDF
        </Button>
      </div>
      <details className="mt-3 print:hidden">
        <summary className="cursor-pointer text-sm font-medium text-primary underline underline-offset-4">
          Choose your own dates
        </summary>
        <div className="mt-3 grid max-w-md grid-cols-2 gap-4">
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
      </details>
      <div className="mt-3">
        <ErrorLine message={rangeError} />
      </div>

      {ok && cur.isPending && <LoadingSkeleton />}
      {ok && cur.isError && (
        <ErrorLine message="The traffic report could not be loaded. Run 018_traffic.sql in Supabase if you have not yet." />
      )}

      {report && cur.data && (
        <ReportBody
          report={report}
          from={from}
          to={to}
          before={before}
          hasPrevious={prev.data !== undefined}
        />
      )}
    </div>
  );
}

function ReportBody({
  report: r,
  from,
  to,
  before,
  hasPrevious,
}: {
  report: Report;
  from: string;
  to: string;
  before: { from: string; to: string };
  hasPrevious: boolean;
}) {
  const maxPage = Math.max(0, ...r.pages.map((p) => p.views));
  const maxAgent = Math.max(0, ...r.agents.map((a) => a.clicks));
  const maxDay = Math.max(0, ...(r.weekdays?.map((d) => d.views) ?? [0]));
  const maxFunnel = Math.max(0, ...r.funnel.map((f) => f.value));

  return (
    <div className="mt-6 grid gap-8">
      <section
        aria-labelledby="tr-short"
        className="rounded-2xl border border-border bg-card p-6 print:break-inside-avoid"
      >
        <p className="text-xs font-bold tracking-[0.16em] text-primary uppercase">
          {formatRange(from, to)}
          {hasPrevious && (
            <span className="font-medium tracking-normal text-muted-foreground normal-case">
              {" "}
              · compared with {formatRange(before.from, before.to)}
            </span>
          )}
        </p>
        <h2 id="tr-short" className="mt-2 text-2xl font-semibold">
          {r.headline}
        </h2>
        {r.highlights.length > 0 && (
          <ul className="mt-4 grid gap-2 text-sm">
            {r.highlights.map((h) => (
              <li key={h} className="flex gap-2.5">
                <span
                  aria-hidden="true"
                  className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                />
                {h}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {r.kpis.map((k) => (
          <div
            key={k.label}
            className="rounded-xl border border-border p-5 print:break-inside-avoid"
          >
            <p className="text-sm text-muted-foreground">{k.label}</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">
              {k.value.toLocaleString("en-ZW")}
            </p>
            {hasPrevious && <ChangeBadge change={k.change} />}
            <p className="mt-1 text-xs text-muted-foreground">{k.note}</p>
          </div>
        ))}
      </div>

      {r.hasTraffic && (
        <>
          <Section
            title="From visit to registration"
            note="Each step shows how many carried on from the step before. Registrations finished on an agent's own site are not counted: the agent click is the count."
          >
            <ol className="grid gap-3">
              {r.funnel.map((f, i) => (
                <li key={f.label}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium">
                      {i + 1}. {f.label}
                    </span>
                    <span className="tabular-nums">
                      <strong>{f.value.toLocaleString("en-ZW")}</strong>
                      {f.keptFromPrevious && (
                        <span className="ml-2 text-muted-foreground">
                          {f.keptFromPrevious} of the step before
                        </span>
                      )}
                    </span>
                  </div>
                  <Bar value={f.value} max={maxFunnel} />
                </li>
              ))}
            </ol>
          </Section>

          <div className="grid gap-8 lg:grid-cols-2">
            <Section title="Where visitors went">
              <ul className="grid gap-3">
                {r.pages.map((p) => (
                  <li key={p.name}>
                    <div className="flex justify-between gap-3 text-sm">
                      <span>{p.name}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {p.views.toLocaleString("en-ZW")} · {p.share}
                      </span>
                    </div>
                    <Bar value={p.views} max={maxPage} />
                  </li>
                ))}
              </ul>
            </Section>

            <Section
              title="Which agents got the handoffs"
              note="A handoff is a click on an agent's button."
            >
              {r.agents.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No agents yet. Add them under Agents.
                </p>
              ) : (
                <ul className="grid gap-3">
                  {r.agents.map((a) => (
                    <li key={a.name}>
                      <div className="flex justify-between gap-3 text-sm">
                        <span>
                          {a.name}
                          {a.removed && (
                            <span className="ml-2 text-muted-foreground">
                              · Removed
                            </span>
                          )}
                        </span>
                        <span className="tabular-nums text-muted-foreground">
                          {a.clicks.toLocaleString("en-ZW")} · {a.share}
                        </span>
                      </div>
                      <Bar value={a.clicks} max={maxAgent} />
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>

          {(r.weekdays || r.busiestDays.length > 0) && (
            <div className="grid gap-8 lg:grid-cols-2">
              {r.weekdays && (
                <Section
                  title="Which days of the week are busiest"
                  note="Page views added up by weekday across the whole period."
                >
                  <ul
                    className="grid grid-cols-7 items-end gap-2"
                    aria-label="Page views by weekday"
                  >
                    {r.weekdays.map((d) => (
                      <li
                        key={d.label}
                        className="flex flex-col items-center gap-1 text-xs"
                      >
                        <span className="tabular-nums text-muted-foreground">
                          {d.views.toLocaleString("en-ZW")}
                        </span>
                        <span
                          aria-hidden="true"
                          className="w-full rounded-t-md bg-primary/70"
                          style={{
                            height: `${Math.max(4, (d.views / (maxDay || 1)) * 96)}px`,
                          }}
                        />
                        <span className="font-medium">{d.label}</span>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
              {r.busiestDays.length > 0 && (
                <Section title="The three busiest days">
                  <ol className="grid gap-2 text-sm">
                    {r.busiestDays.map((d, i) => (
                      <li
                        key={d.label}
                        className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
                      >
                        <span>
                          <span className="mr-2 font-semibold text-primary">
                            {i + 1}
                          </span>
                          {d.label}
                        </span>
                        <span className="tabular-nums">
                          {d.views.toLocaleString("en-ZW")} views
                        </span>
                      </li>
                    ))}
                  </ol>
                </Section>
              )}
            </div>
          )}
        </>
      )}

      <p className="text-xs text-muted-foreground">
        Visitors are counted with a random code kept in the browser. No names,
        phone numbers or emails are stored. Visits by signed-in staff are not
        counted.
      </p>
    </div>
  );
}

function ChangeBadge({ change }: { change: Change }) {
  const Icon =
    change.direction === "up"
      ? ArrowUpRight
      : change.direction === "down"
        ? ArrowDownRight
        : Minus;
  const tone =
    change.direction === "up"
      ? "text-emerald-600 dark:text-emerald-400"
      : change.direction === "down"
        ? "text-red-600 dark:text-red-400"
        : "text-muted-foreground";
  return (
    <p className={`mt-1 flex items-center gap-1 text-sm font-medium ${tone}`}>
      <Icon size={16} aria-hidden="true" />
      {describeChange(change)}
    </p>
  );
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section className="print:break-inside-avoid">
      <h2 className="text-xl font-semibold">{title}</h2>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Bar({ value, max }: { value: number; max: number }) {
  return (
    <span aria-hidden="true" className="mt-1.5 block h-2 rounded-full bg-muted">
      <span
        className="block h-2 rounded-full bg-primary/80"
        style={{ width: `${barWidth(value, max)}%` }}
      />
    </span>
  );
}
