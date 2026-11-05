import { useState, type FormEvent } from "react";
import { ErrorLine } from "@/components/staff/FormBits";
import { useContentAction } from "@/components/staff/useContentAction";
import { Button } from "@/components/ui/button";
import { CheckField, Field, inputClass } from "@/components/ui/field";
import { LoadingSkeleton } from "@/components/ui/motion";
import { useAgents } from "@/lib/agents";
import {
  saveDashboardFigures,
  useDashboardFigures,
  wholeNumber,
  withOverrides,
  type DashboardFigures,
} from "@/lib/dashboard-figures";
import { PHASE_LABEL, buildSeries } from "@/lib/home-dashboard";
import { todayInHarare } from "@/lib/traffic-utils";

const MAX_COUNT = 100_000_000;

/** Edit the numbers on the home page: the headline figures and the month-by-month graph. */
export function DashboardFiguresAdmin() {
  const figures = useDashboardFigures();
  if (!figures) return <LoadingSkeleton lines={5} />;
  return <FiguresForm initial={figures} />;
}

function FiguresForm({ initial }: { initial: DashboardFigures }) {
  const { run, busy, error, setError } = useContentAction();
  const liveAgents = useAgents().data?.length ?? 0;
  const current = todayInHarare().slice(0, 7);

  // The months on the graph, with the values it shows now (entered ones, else the demo ones).
  const rows = (() => {
    const savings = withOverrides(
      buildSeries("savings", current),
      initial.monthly,
      "savings",
    );
    const members = withOverrides(
      buildSeries("members", current),
      initial.monthly,
      "members",
    );
    return savings.map((p, i) => ({
      key: p.key,
      label: p.fullLabel,
      phase: p.phase,
      savings: String(p.value),
      members: String(members[i]!.value),
    }));
  })();

  const [memberCount, setMemberCount] = useState(
    initial.memberCount === null ? "" : String(initial.memberCount),
  );
  const [agentCount, setAgentCount] = useState(
    initial.agentCount === null ? "" : String(initial.agentCount),
  );
  const [activeSavers, setActiveSavers] = useState(
    String(initial.activeSavers),
  );
  const [goalsReached, setGoalsReached] = useState(
    String(initial.goalsReached),
  );
  const [townsReached, setTownsReached] = useState(
    String(initial.townsReached),
  );
  const [avgSaved, setAvgSaved] = useState(String(initial.avgSaved));
  const [illustrative, setIllustrative] = useState(initial.illustrative);
  const [months, setMonths] = useState(rows);
  const [saved, setSaved] = useState(false);

  const touch = () => setSaved(false);
  const setMonth = (
    i: number,
    patch: Partial<{ savings: string; members: string }>,
  ) => {
    touch();
    setMonths((all) => all.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaved(false);

    const optional = (text: string, name: string) => {
      if (text.trim() === "") return { value: null as number | null };
      const n = wholeNumber(text, MAX_COUNT);
      if (n === null) {
        setError(`${name} must be a whole number, or empty.`);
        return null;
      }
      return { value: n };
    };
    const required = (text: string, name: string) => {
      const n = wholeNumber(text, MAX_COUNT);
      if (n === null) setError(`${name} must be a whole number.`);
      return n;
    };

    const members = optional(memberCount, "Members");
    if (!members) return;
    const agents = optional(agentCount, "Registration agents");
    if (!agents) return;
    const savers = required(activeSavers, "Active savers");
    if (savers === null) return;
    const goals = required(goalsReached, "Goals reached");
    if (goals === null) return;
    const towns = required(townsReached, "Towns reached");
    if (towns === null) return;
    const avg = required(avgSaved, "Average saved per member");
    if (avg === null) return;

    const monthly: DashboardFigures["monthly"] = [];
    for (const m of months) {
      const s = wholeNumber(m.savings, MAX_COUNT);
      const p = wholeNumber(m.members, MAX_COUNT);
      if (s === null || p === null) {
        setError(
          `${m.label}: savings and members must both be whole numbers (use 0 for none).`,
        );
        return;
      }
      monthly.push({ month: m.key, savings: s, members: p });
    }

    const ok = await run(() =>
      saveDashboardFigures({
        memberCount: members.value,
        agentCount: agents.value,
        activeSavers: savers,
        goalsReached: goals,
        townsReached: towns,
        avgSaved: avg,
        monthly,
        illustrative,
      }),
    );
    if (ok) setSaved(true);
  }

  return (
    <form onSubmit={submit} className="grid max-w-3xl gap-8">
      <p className="text-sm text-muted-foreground">
        These are the numbers on the home page. Whatever you save here is shown
        to the public straight away, so enter figures the office can stand
        behind. The label below tells visitors whether they are illustrative.
      </p>

      <fieldset className="grid gap-4">
        <legend className="mb-1 text-sm font-medium">Headline numbers</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="df-members"
            label="Members"
            inputMode="numeric"
            value={memberCount}
            hint="The Members tile under the top banner. Leave empty to hide the tile."
            onChange={(e) => {
              touch();
              setMemberCount(e.target.value);
            }}
          />
          <Field
            id="df-agents"
            label="Registration agents"
            inputMode="numeric"
            value={agentCount}
            hint={`Leave empty to show the real number of published agents (now ${liveAgents}).`}
            onChange={(e) => {
              touch();
              setAgentCount(e.target.value);
            }}
          />
          <Field
            id="df-savers"
            label="Active savers"
            inputMode="numeric"
            value={activeSavers}
            onChange={(e) => {
              touch();
              setActiveSavers(e.target.value);
            }}
          />
          <Field
            id="df-goals"
            label="Goals reached"
            inputMode="numeric"
            value={goalsReached}
            onChange={(e) => {
              touch();
              setGoalsReached(e.target.value);
            }}
          />
          <Field
            id="df-towns"
            label="Towns reached"
            inputMode="numeric"
            value={townsReached}
            onChange={(e) => {
              touch();
              setTownsReached(e.target.value);
            }}
          />
          <Field
            id="df-avg"
            label="Average saved per member (USD)"
            inputMode="numeric"
            value={avgSaved}
            onChange={(e) => {
              touch();
              setAvgSaved(e.target.value);
            }}
          />
        </div>
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="mb-1 text-sm font-medium">
          Graph: month by month
        </legend>
        <p className="text-xs text-muted-foreground">
          Past months are records, this month is in progress, and months ahead
          are scheduled targets, never returns. New months appear automatically
          as time moves on; their starting values are the built-in demo ones
          until you enter yours.
        </p>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[34rem] text-sm">
            <thead className="bg-surface-deep text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Month</th>
                <th className="px-3 py-2 font-medium">Savings (USD)</th>
                <th className="px-3 py-2 font-medium">New members</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m, i) => (
                <tr key={m.key} className="border-t border-border">
                  <td className="px-3 py-2">
                    <div className="font-medium">{m.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {PHASE_LABEL[m.phase]}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      aria-label={`Savings for ${m.label}`}
                      inputMode="numeric"
                      className={inputClass}
                      value={m.savings}
                      onChange={(e) => setMonth(i, { savings: e.target.value })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      aria-label={`Members for ${m.label}`}
                      inputMode="numeric"
                      className={inputClass}
                      value={m.members}
                      onChange={(e) => setMonth(i, { members: e.target.value })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              touch();
              const savings = buildSeries("savings", current);
              const members = buildSeries("members", current);
              setMonths(
                savings.map((p, i) => ({
                  key: p.key,
                  label: p.fullLabel,
                  phase: p.phase,
                  savings: String(p.value),
                  members: String(members[i]!.value),
                })),
              );
            }}
          >
            Reset months to the demo values
          </Button>
        </div>
      </fieldset>

      <CheckField
        id="df-illustrative"
        checked={illustrative}
        onChange={(v) => {
          touch();
          setIllustrative(v);
        }}
      >
        Label these figures “Illustrative demo figures” on the home page. Turn
        this off only when the numbers are real; the page then says “Figures
        supplied by the office”.
      </CheckField>

      <ErrorLine message={error} />
      {saved && (
        <p role="status" className="text-sm font-semibold text-primary">
          Saved. The home page now shows these figures.
        </p>
      )}
      <div>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save dashboard figures"}
        </Button>
      </div>
    </form>
  );
}
