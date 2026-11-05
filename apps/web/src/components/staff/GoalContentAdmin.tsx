import { useState, type FormEvent } from "react";
import { ErrorLine, TextAreaField } from "@/components/staff/FormBits";
import { useContentAction } from "@/components/staff/useContentAction";
import { Button } from "@/components/ui/button";
import { CheckField, Field } from "@/components/ui/field";
import { LoadingSkeleton } from "@/components/ui/motion";
import {
  saveGoalContent,
  useLiveGoals,
  type LiveGoal,
  type Quote,
} from "@/lib/goal-content-db";

const toLines = (text: string) =>
  text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "");

/** Edit what opens when a visitor clicks a savings goal on the home page. */
export function GoalContentAdmin() {
  const goals = useLiveGoals();
  const [open, setOpen] = useState<string | null>(null);
  if (!goals) return <LoadingSkeleton lines={4} />;
  return (
    <div className="grid max-w-3xl gap-4">
      <p className="text-sm text-muted-foreground">
        This is the panel that opens when a visitor clicks a savings goal on the
        home page. Edit the introduction, the steps, the three columns of
        figures and the member quotes. Changes show as soon as you save.
      </p>
      {goals.map((g) => (
        <div key={g.key} className="rounded-md border border-border p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">{g.label}</h2>
              <p className="text-xs text-muted-foreground">
                {g.real
                  ? "Marked as real figures and quotes"
                  : "Showing the “Sample content” label"}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpen(open === g.key ? null : g.key)}
            >
              {open === g.key ? "Close" : "Edit"}
            </Button>
          </div>
          {open === g.key && (
            <GoalForm key={g.key} goal={g} onDone={() => setOpen(null)} />
          )}
        </div>
      ))}
    </div>
  );
}

function GoalForm({ goal, onDone }: { goal: LiveGoal; onDone: () => void }) {
  const { run, busy, error, setError } = useContentAction();
  const [about, setAbout] = useState(goal.about);
  const [how, setHow] = useState(goal.how.join("\n"));
  const [past, setPast] = useState(goal.past.join("\n"));
  const [present, setPresent] = useState(goal.present.join("\n"));
  const [ahead, setAhead] = useState(goal.ahead.join("\n"));
  const [quotes, setQuotes] = useState<Quote[]>(goal.quotes);
  const [real, setReal] = useState(goal.real);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const cleanQuotes = quotes
      .map((q) => ({ text: q.text.trim(), who: q.who.trim() }))
      .filter((q) => q.text !== "" || q.who !== "");
    if (cleanQuotes.some((q) => q.text === "" || q.who === "")) {
      setError("Each quote needs both the words and who said them.");
      return;
    }
    if (about.trim() === "") {
      setError("The introduction cannot be empty.");
      return;
    }
    const lists = { how, past, present, ahead };
    for (const [name, text] of Object.entries(lists)) {
      const lines = toLines(text);
      if (lines.length > 6 || lines.some((l) => l.length > 240)) {
        setError(
          `The “${name}” list can have at most 6 lines of up to 240 characters.`,
        );
        return;
      }
    }
    if (cleanQuotes.length > 4) {
      setError("Show at most 4 quotes.");
      return;
    }
    if (
      await run(() =>
        saveGoalContent(goal.key, {
          about: about.trim(),
          how: toLines(how),
          past: toLines(past),
          present: toLines(present),
          ahead: toLines(ahead),
          quotes: cleanQuotes,
          real,
        }),
      )
    )
      onDone();
  }

  return (
    <form onSubmit={submit} className="mt-5 grid gap-5">
      <TextAreaField
        id={`g-about-${goal.key}`}
        label="Introduction (the line under the title)"
        rows={3}
        value={about}
        onChange={(e) => setAbout(e.target.value)}
      />
      <TextAreaField
        id={`g-how-${goal.key}`}
        label="How saving towards it works"
        rows={4}
        value={how}
        hint="One step per line, up to 6."
        onChange={(e) => setHow(e.target.value)}
      />
      <div className="grid gap-5 md:grid-cols-3">
        <TextAreaField
          id={`g-past-${goal.key}`}
          label="Past records"
          rows={6}
          value={past}
          hint="One line each."
          onChange={(e) => setPast(e.target.value)}
        />
        <TextAreaField
          id={`g-present-${goal.key}`}
          label="Right now"
          rows={6}
          value={present}
          hint="One line each."
          onChange={(e) => setPresent(e.target.value)}
        />
        <TextAreaField
          id={`g-ahead-${goal.key}`}
          label="Scheduled targets"
          rows={6}
          value={ahead}
          hint="Targets only, never returns."
          onChange={(e) => setAhead(e.target.value)}
        />
      </div>

      <fieldset className="grid gap-3">
        <legend className="mb-1 text-sm font-medium">What members say</legend>
        {quotes.map((q, i) => (
          <div
            key={i}
            className="grid gap-3 rounded-md border border-border p-4"
          >
            <TextAreaField
              id={`g-q-${goal.key}-${i}`}
              label="Quote"
              rows={2}
              value={q.text}
              onChange={(e) =>
                setQuotes((all) =>
                  all.map((x, j) =>
                    j === i ? { ...x, text: e.target.value } : x,
                  ),
                )
              }
            />
            <Field
              id={`g-w-${goal.key}-${i}`}
              label="Who said it"
              value={q.who}
              placeholder="Name, town"
              onChange={(e) =>
                setQuotes((all) =>
                  all.map((x, j) =>
                    j === i ? { ...x, who: e.target.value } : x,
                  ),
                )
              }
            />
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setQuotes((all) => all.filter((_, j) => j !== i))
                }
              >
                Remove quote
              </Button>
            </div>
          </div>
        ))}
        {quotes.length < 4 && (
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setQuotes((all) => [...all, { text: "", who: "" }])
              }
            >
              Add a quote
            </Button>
          </div>
        )}
      </fieldset>

      <CheckField id={`g-real-${goal.key}`} checked={real} onChange={setReal}>
        Every figure above is a real record, and every quote is from a real
        member who agreed to it being shown. Tick this to hide the “Sample
        content” label on this goal. Leave it unticked while any of it is
        illustrative.
      </CheckField>

      <ErrorLine message={error} />
      <div>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save goal"}
        </Button>
      </div>
    </form>
  );
}
