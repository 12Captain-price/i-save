import { useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { ErrorLine, TextAreaField } from "@/components/staff/FormBits";
import { useContentAction } from "@/components/staff/useContentAction";
import { Button } from "@/components/ui/button";
import { CheckField, Field, inputClass } from "@/components/ui/field";
import { LoadingSkeleton } from "@/components/ui/motion";
import {
  deleteGoal,
  saveGoal,
  saveGoalOrder,
  setGoalActive,
  useGoals,
  type LiveGoal,
  type Quote,
} from "@/lib/goal-content-db";
import {
  GOAL_ACCENTS,
  GOAL_ICONS,
  goalColor,
  goalIcon,
  slugifyGoal,
} from "@/lib/goal-style";

const toLines = (text: string) =>
  text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "");

/** Add, edit, reorder, hide and delete the savings goals shown on the home page. */
export function GoalContentAdmin() {
  const { goals, loaded } = useGoals(true);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const { run, busy, error } = useContentAction();
  if (!loaded) return <LoadingSkeleton lines={4} />;

  function move(index: number, by: -1 | 1) {
    const keys = goals.map((g) => g.key);
    const j = index + by;
    if (j < 0 || j >= keys.length) return;
    [keys[index], keys[j]] = [keys[j]!, keys[index]!];
    void run(() => saveGoalOrder(keys));
  }

  return (
    <div className="grid max-w-3xl gap-4">
      <p className="text-sm text-muted-foreground">
        These are the savings goals on the home page, in the Plans filter and in
        the panel that opens when a visitor clicks a goal. Add your own, change
        the wording, icon and colour, reorder them, or hide one. Changes show as
        soon as you save.
      </p>
      <ErrorLine message={error} />

      {goals.map((g, i) => {
        const Icon = goalIcon(g.icon);
        return (
          <div
            key={g.key}
            className="rounded-md border border-border p-5"
            style={{ borderLeft: `4px solid ${goalColor(g.accent)}` }}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span
                  className="grid h-10 w-10 place-items-center rounded-lg"
                  style={{
                    color: goalColor(g.accent),
                    background: `color-mix(in oklab, ${goalColor(g.accent)} 18%, transparent)`,
                  }}
                >
                  <Icon size={20} aria-hidden="true" />
                </span>
                <div>
                  <h2 className="font-semibold">
                    {g.label}
                    {!g.active && (
                      <span className="ml-2 rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        Hidden
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {g.real
                      ? "Marked as real figures and quotes"
                      : "Showing the “Sample content” label"}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy || i === 0}
                  onClick={() => move(i, -1)}
                  aria-label={`Move ${g.label} up`}
                >
                  <ArrowUp size={16} aria-hidden="true" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy || i === goals.length - 1}
                  onClick={() => move(i, 1)}
                  aria-label={`Move ${g.label} down`}
                >
                  <ArrowDown size={16} aria-hidden="true" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => void run(() => setGoalActive(g.key, !g.active))}
                >
                  {g.active ? (
                    <EyeOff size={16} aria-hidden="true" />
                  ) : (
                    <Eye size={16} aria-hidden="true" />
                  )}
                  {g.active ? "Hide" : "Show"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOpen(open === g.key ? null : g.key)}
                >
                  {open === g.key ? "Close" : "Edit"}
                </Button>
              </div>
            </div>
            {open === g.key && (
              <GoalForm
                key={g.key}
                goal={g}
                order={g.order}
                onDone={() => setOpen(null)}
              />
            )}
          </div>
        );
      })}

      {adding ? (
        <div className="rounded-md border border-dashed border-primary p-5">
          <h2 className="font-semibold">Add a savings goal</h2>
          <GoalForm
            goal={null}
            existingKeys={goals.map((g) => g.key)}
            order={(goals.at(-1)?.order ?? 0) + 10}
            onDone={() => setAdding(false)}
            onCancel={() => setAdding(false)}
          />
        </div>
      ) : (
        <div>
          <Button onClick={() => setAdding(true)}>
            <Plus size={16} aria-hidden="true" />
            Add a savings goal
          </Button>
        </div>
      )}
    </div>
  );
}

function GoalForm({
  goal,
  order,
  existingKeys = [],
  onDone,
  onCancel,
}: {
  goal: LiveGoal | null;
  order: number;
  existingKeys?: string[];
  onDone: () => void;
  onCancel?: () => void;
}) {
  const isNew = goal === null;
  const { run, busy, error, setError } = useContentAction();
  const [label, setLabel] = useState(goal?.label ?? "");
  const [purpose, setPurpose] = useState(goal?.purpose ?? "");
  const [icon, setIcon] = useState(goal?.icon ?? "target");
  const [accent, setAccent] = useState(goal?.accent ?? "green");
  const [about, setAbout] = useState(goal?.about ?? "");
  const [how, setHow] = useState((goal?.how ?? []).join("\n"));
  const [past, setPast] = useState((goal?.past ?? []).join("\n"));
  const [present, setPresent] = useState((goal?.present ?? []).join("\n"));
  const [ahead, setAhead] = useState((goal?.ahead ?? []).join("\n"));
  const [quotes, setQuotes] = useState<Quote[]>(goal?.quotes ?? []);
  const [real, setReal] = useState(goal?.real ?? false);
  const id = goal?.key ?? "new";

  async function submit(e: FormEvent) {
    e.preventDefault();
    const name = label.trim();
    if (name.length < 2 || name.length > 30) {
      setError("The goal name must be 2 to 30 characters.");
      return;
    }
    if (purpose.trim().length > 160) {
      setError("The one-line description can be at most 160 characters.");
      return;
    }
    let key = goal?.key ?? slugifyGoal(name);
    if (isNew) {
      if (key.length < 2) {
        setError("Use letters or numbers in the goal name.");
        return;
      }
      if (["all", "combo", "other"].includes(key)) key = `${key}-goal`;
      if (existingKeys.includes(key)) {
        setError("There is already a goal with that name.");
        return;
      }
    }
    const cleanQuotes = quotes
      .map((q) => ({ text: q.text.trim(), who: q.who.trim() }))
      .filter((q) => q.text !== "" || q.who !== "");
    if (cleanQuotes.some((q) => q.text === "" || q.who === "")) {
      setError("Each quote needs both the words and who said them.");
      return;
    }
    if (cleanQuotes.length > 4) {
      setError("Show at most 4 quotes.");
      return;
    }
    if (about.trim().length > 600) {
      setError("The introduction can be at most 600 characters.");
      return;
    }
    const lists = { how, past, present, ahead };
    for (const [listName, text] of Object.entries(lists)) {
      const lines = toLines(text);
      if (lines.length > 6 || lines.some((l) => l.length > 240)) {
        setError(
          `The “${listName}” list can have at most 6 lines of up to 240 characters.`,
        );
        return;
      }
    }
    if (
      await run(() =>
        saveGoal(
          key,
          {
            label: name,
            purpose: purpose.trim(),
            icon,
            accent,
            active: goal?.active ?? true,
            about: about.trim(),
            how: toLines(how),
            past: toLines(past),
            present: toLines(present),
            ahead: toLines(ahead),
            quotes: cleanQuotes,
            real,
          },
          order,
        ),
      )
    )
      onDone();
  }

  return (
    <form onSubmit={submit} className="mt-5 grid gap-5">
      <div className="grid gap-5 md:grid-cols-2">
        <Field
          id={`g-label-${id}`}
          label="Goal name"
          value={label}
          maxLength={30}
          placeholder="For example: Business"
          hint={
            isNew
              ? "Shown on the home page tile and as a Plans filter."
              : undefined
          }
          onChange={(e) => setLabel(e.target.value)}
        />
        <Field
          id={`g-purpose-${id}`}
          label="One-line description (on the tile)"
          value={purpose}
          maxLength={160}
          placeholder="Save towards starting or growing a business."
          onChange={(e) => setPurpose(e.target.value)}
        />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label
            htmlFor={`g-icon-${id}`}
            className="mb-1.5 block text-sm font-medium"
          >
            Icon
          </label>
          <select
            id={`g-icon-${id}`}
            className={inputClass}
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
          >
            {Object.entries(GOAL_ICONS).map(([code, v]) => (
              <option key={code} value={code}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Colour</legend>
          <div className="flex flex-wrap gap-2">
            {Object.entries(GOAL_ACCENTS).map(([code, v]) => (
              <button
                key={code}
                type="button"
                aria-label={v.label}
                aria-pressed={accent === code}
                title={v.label}
                onClick={() => setAccent(code)}
                className="h-9 w-9 rounded-full border-2"
                style={{
                  background: v.color,
                  borderColor:
                    accent === code ? "var(--foreground)" : "transparent",
                }}
              />
            ))}
          </div>
        </fieldset>
      </div>

      <TextAreaField
        id={`g-about-${id}`}
        label="Introduction (the line under the title when it opens)"
        rows={3}
        value={about}
        onChange={(e) => setAbout(e.target.value)}
      />
      <TextAreaField
        id={`g-how-${id}`}
        label="How saving towards it works"
        rows={4}
        value={how}
        hint="One step per line, up to 6."
        onChange={(e) => setHow(e.target.value)}
      />
      <div className="grid gap-5 md:grid-cols-3">
        <TextAreaField
          id={`g-past-${id}`}
          label="Past records"
          rows={6}
          value={past}
          hint="One line each. Start a line with a number to show it big."
          onChange={(e) => setPast(e.target.value)}
        />
        <TextAreaField
          id={`g-present-${id}`}
          label="Right now"
          rows={6}
          value={present}
          hint="One line each."
          onChange={(e) => setPresent(e.target.value)}
        />
        <TextAreaField
          id={`g-ahead-${id}`}
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
              id={`g-q-${id}-${i}`}
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
              id={`g-w-${id}-${i}`}
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

      <CheckField id={`g-real-${id}`} checked={real} onChange={setReal}>
        Every figure above is a real record, and every quote is from a real
        member who agreed to it being shown. Tick this to hide the “Sample
        content” label on this goal. Leave it unticked while any of it is
        illustrative.
      </CheckField>

      <ErrorLine message={error} />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : isNew ? "Add goal" : "Save goal"}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        {goal && !goal.builtin && <DeleteGoal goal={goal} />}
      </div>
    </form>
  );
}

function DeleteGoal({ goal }: { goal: LiveGoal }) {
  const { run, busy } = useContentAction();
  const [sure, setSure] = useState(false);
  if (!sure)
    return (
      <Button
        type="button"
        variant="outline"
        className="ml-auto"
        onClick={() => setSure(true)}
      >
        <Trash2 size={16} aria-hidden="true" />
        Delete goal
      </Button>
    );
  return (
    <span className="ml-auto flex flex-wrap items-center gap-2 text-sm">
      Delete “{goal.label}” for good? Plans filed under it stay, but lose their
      filter. Hiding it is safer.
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => void run(() => deleteGoal(goal.key))}
      >
        Yes, delete
      </Button>
      <Button type="button" size="sm" onClick={() => setSure(false)}>
        Keep it
      </Button>
    </span>
  );
}
