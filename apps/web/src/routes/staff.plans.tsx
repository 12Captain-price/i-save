import { useState, type FormEvent } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { PlanVersionForm } from "@/components/staff/PlanVersionForm";
import { StatusPill } from "@/components/staff/StatusPill";
import { Button, buttonVariants } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { TextAreaField } from "@/components/staff/FormBits";
import { CheckField, Field, inputClass } from "@/components/ui/field";
import { useAuth } from "@/lib/auth";
import {
  activateVersion,
  createNextVersion,
  createPlan,
  deleteDraftVersion,
  deletePlan,
  retireVersion,
  saveDraftVersion,
  updatePlanDetails,
  usePlans,
  type Plan,
  type PlanVersion,
} from "@/lib/plans";
import { validatePlanLongDescription } from "@/lib/goal-plan-utils";
import { PlanThemeFields } from "@/components/staff/PlanThemeFields";
import {
  parseComboGoals,
  validateComboGoals,
  type PlanTheme,
} from "@/lib/plan-theme";
import {
  EMPTY_VERSION_FORM,
  activationProblems,
  describeAmount,
  describeDuration,
  validatePlanDescription,
  validatePlanName,
  versionToFormInput,
  type VersionValues,
} from "@/lib/plan-utils";
import { formatDate, isAdminRole, staffErrorMessage } from "@/lib/staff-utils";

export const Route = createFileRoute("/staff/plans")({
  component: PlansPage,
});

function PlansPage() {
  const { roles } = useAuth();
  if (!isAdminRole(roles)) {
    return (
      <div>
        <h1 className="text-3xl font-semibold md:text-4xl">Plans</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          Only administrators can manage savings plans.
        </p>
        <div className="mt-6">
          <Link to="/staff" className={buttonVariants({ variant: "outline" })}>
            Back to members
          </Link>
        </div>
      </div>
    );
  }
  return <PlansAdmin />;
}

function PlansAdmin() {
  const queryClient = useQueryClient();
  const plans = usePlans();
  const [creating, setCreating] = useState(false);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["staff", "plans"] });
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold md:text-4xl">Savings plans</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            A plan only goes live once it has the amount and terms the owner
            approved. A live version cannot be edited: start a new version
            instead, so members keep the terms they accepted.
          </p>
        </div>
        {!creating && (
          <Button onClick={() => setCreating(true)}>Add a plan</Button>
        )}
      </div>

      {creating && (
        <NewPlanPanel
          onDone={async () => {
            setCreating(false);
            await refresh();
          }}
          onCancel={() => setCreating(false)}
        />
      )}

      <div className="mt-8 grid gap-6" aria-live="polite">
        {plans.isPending && (
          <p role="status" className="text-sm text-muted-foreground">
            Loading plans…
          </p>
        )}
        {plans.isError && (
          <p role="alert" className="text-sm text-destructive">
            {staffErrorMessage(plans.error)}
          </p>
        )}
        {plans.data && plans.data.length === 0 && (
          <p className="rounded-md border border-border bg-card p-6 text-sm text-muted-foreground">
            There are no plans yet. Use “Add a plan” to create the first one.
          </p>
        )}
        {plans.data?.map((plan) => (
          <PlanCard key={plan.id} plan={plan} onChanged={refresh} />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Add a plan                                                          */
/* ------------------------------------------------------------------ */

function NewPlanPanel({
  onDone,
  onCancel,
}: {
  onDone: () => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [longDescription, setLongDescription] = useState("");
  const [isGoalBased, setIsGoalBased] = useState(false);
  const [theme, setTheme] = useState<PlanTheme>("other");
  const [goalsText, setGoalsText] = useState("");
  const [nameError, setNameError] = useState<string | undefined>();
  const [descError, setDescError] = useState<string | undefined>();
  const [longError, setLongError] = useState<string | undefined>();
  const [checked, setChecked] = useState(false);

  // The name is validated here; the amount and terms are validated by the form below.
  async function save(values: VersionValues) {
    const n = validatePlanName(name);
    const d = validatePlanDescription(description);
    const l = validatePlanLongDescription(longDescription);
    setNameError(n ?? undefined);
    setDescError(d ?? undefined);
    setLongError(l ?? undefined);
    setChecked(true);
    const g = validateComboGoals(goalsText);
    if (n || d || l || g) {
      throw new Error(g ?? "Fix the plan name or descriptions above first.");
    }
    await createPlan(name, description, values, {
      longDescription,
      isGoalBased,
      theme,
      comboGoals: parseComboGoals(goalsText),
    });
    await onDone();
  }

  return (
    <section
      aria-labelledby="new-plan-heading"
      className="mt-8 rounded-md border border-border bg-card p-6"
    >
      <h2 id="new-plan-heading" className="text-xl font-semibold">
        Add a plan
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        It is saved as a draft. Nothing is shown to members until you make it
        live.
      </p>
      <div className="mt-6 grid gap-5">
        <Field
          id="new-plan-name"
          label="Plan name"
          autoComplete="off"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={checked ? nameError : undefined}
        />
        <Field
          id="new-plan-description"
          label="Short description (optional)"
          autoComplete="off"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          error={checked ? descError : undefined}
        />
        <PlanThemeFields
          idPrefix="new-plan"
          theme={theme}
          onTheme={setTheme}
          goals={goalsText}
          onGoals={setGoalsText}
          goalsError={
            checked ? (validateComboGoals(goalsText) ?? undefined) : undefined
          }
        />
        <div>
          <TextAreaField
            id="new-plan-long"
            label="Full description (optional)"
            hint="Shown on the public Plans page. Leave a blank line between paragraphs. Start a line with ## for a heading."
            rows={8}
            value={longDescription}
            onChange={(event) => setLongDescription(event.target.value)}
          />
          {checked && longError && (
            <p role="alert" className="mt-1.5 text-xs text-destructive">
              {longError}
            </p>
          )}
        </div>
        <CheckField
          id="new-plan-goal"
          checked={isGoalBased}
          onChange={setIsGoalBased}
        >
          Show the gold "Combo" ribbon on this plan
        </CheckField>
        <PlanVersionForm
          idPrefix="new-plan"
          initial={EMPTY_VERSION_FORM}
          submitLabel="Save draft plan"
          onSubmit={save}
          onCancel={onCancel}
        />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* One plan and its versions                                           */
/* ------------------------------------------------------------------ */

type Panel =
  | { kind: "details" }
  | { kind: "newVersion" }
  | {
      kind: "edit" | "activate" | "terms";
      versionId: string;
    };

function PlanCard({
  plan,
  onChanged,
}: {
  plan: Plan;
  onChanged: () => Promise<void>;
}) {
  const [panel, setPanel] = useState<Panel | null>(null);
  const ask = useConfirm();
  const hasDraft = plan.versions.some((v) => v.status === "draft");
  const latest = plan.versions[0];

  async function done() {
    setPanel(null);
    await onChanged();
  }

  function confirmDeletePlan() {
    void ask({
      title: `Delete “${plan.name}”?`,
      message:
        "The plan and all of its versions are removed for good. This only works if no member has ever joined it. If members have, use “Stop new sign-ups” instead to hide it from the website.",
      confirmLabel: "Yes, delete the plan",
      tone: "danger",
      run: () => deletePlan(plan.id),
    }).then(async (ok) => {
      if (ok) await done();
    });
  }

  function confirmDeleteDraft(v: PlanVersion) {
    void ask({
      title: `Delete draft version ${v.version}?`,
      message:
        "Only this draft is removed. The plan and its other versions stay as they are.",
      confirmLabel: "Yes, delete the draft",
      tone: "danger",
      run: () => deleteDraftVersion(v.id),
    }).then(async (ok) => {
      if (ok) await done();
    });
  }

  function confirmRetire(v: PlanVersion) {
    void ask({
      title: `Stop new sign-ups for version ${v.version}?`,
      message:
        "New members will no longer be able to join it. People already on it keep their plan and their terms. If no other version is live, members will see no plan to choose.",
      confirmLabel: "Stop new sign-ups",
      tone: "danger",
      run: () => retireVersion(v.id),
    }).then(async (ok) => {
      if (ok) await done();
    });
  }

  const target =
    panel && "versionId" in panel
      ? plan.versions.find((v) => v.id === panel.versionId)
      : undefined;

  return (
    <section
      aria-labelledby={`plan-${plan.id}`}
      className="rounded-md border border-border bg-card p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={`plan-${plan.id}`} className="text-xl font-semibold">
            {plan.name}
            {plan.isGoalBased && (
              <span className="ml-3 rounded-full border border-primary/50 bg-primary/10 px-2.5 py-0.5 align-middle text-xs font-semibold text-primary">
                Combo
              </span>
            )}
          </h2>
          {plan.description && (
            <p className="mt-1 text-sm text-muted-foreground">
              {plan.description}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPanel({ kind: "details" })}
          >
            Edit details
          </Button>
          {!hasDraft && latest && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPanel({ kind: "newVersion" })}
            >
              New version
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={confirmDeletePlan}>
            Delete plan
          </Button>
        </div>
      </div>

      <ul className="mt-5 grid gap-3">
        {plan.versions.map((v) => (
          <li key={v.id} className="rounded-md border border-border/70 p-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-semibold">Version {v.version}</span>
              <StatusPill status={v.status} />
              <span className="text-sm">{describeAmount(v)}</span>
              <span className="text-sm text-muted-foreground">
                {describeDuration(v.durationWeeks)}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {v.approvedAt
                ? `Approved ${formatDate(v.approvedAt)}`
                : `Draft, last changed ${formatDate(v.updatedAt)}`}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setPanel({ kind: "terms", versionId: v.id })}
              >
                Read terms
              </Button>
              {v.status === "draft" && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPanel({ kind: "edit", versionId: v.id })}
                  >
                    Edit draft
                  </Button>
                  <Button
                    size="sm"
                    onClick={() =>
                      setPanel({ kind: "activate", versionId: v.id })
                    }
                  >
                    Make live
                  </Button>
                  {plan.versions.length > 1 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => confirmDeleteDraft(v)}
                    >
                      Delete draft
                    </Button>
                  )}
                </>
              )}
              {v.status === "active" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => confirmRetire(v)}
                >
                  Stop new sign-ups
                </Button>
              )}
            </div>
            {v.status !== "draft" && (
              <p className="mt-2 text-xs text-muted-foreground">
                {v.status === "active"
                  ? "To change the amount or terms of a live version, start a new version. Members keep the terms they accepted."
                  : "This version has been live, so it stays on record and cannot be changed."}
              </p>
            )}
          </li>
        ))}
      </ul>

      {panel?.kind === "details" && (
        <DetailsPanel
          plan={plan}
          onDone={done}
          onCancel={() => setPanel(null)}
        />
      )}
      {panel?.kind === "newVersion" && latest && (
        <div className="mt-5 border-t border-border pt-5">
          <h3 className="text-base font-semibold">
            New version {latest.version + 1}
          </h3>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            Starts as a draft, filled in from version {latest.version}. Change
            what the owner changed, then make it live.
          </p>
          <PlanVersionForm
            idPrefix={`nv-${plan.id}`}
            initial={versionToFormInput(latest)}
            submitLabel="Save as draft"
            onSubmit={async (values) => {
              await createNextVersion(
                plan,
                values,
                latest.frequency,
                latest.currency,
              );
              await done();
            }}
            onCancel={() => setPanel(null)}
          />
        </div>
      )}
      {panel?.kind === "edit" && target && (
        <div className="mt-5 border-t border-border pt-5">
          <h3 className="mb-4 text-base font-semibold">
            Edit version {target.version}
          </h3>
          <PlanVersionForm
            idPrefix={`ed-${target.id}`}
            initial={versionToFormInput(target)}
            submitLabel="Save draft"
            onSubmit={async (values) => {
              await saveDraftVersion(target.id, values);
              await done();
            }}
            onCancel={() => setPanel(null)}
          />
        </div>
      )}
      {panel?.kind === "terms" && target && (
        <div className="mt-5 border-t border-border pt-5">
          <h3 className="text-base font-semibold">
            Terms for version {target.version}
          </h3>
          <p className="mt-3 text-sm whitespace-pre-wrap">
            {target.termsText.trim() === ""
              ? "No terms written yet."
              : target.termsText}
          </p>
          <div className="mt-4">
            <Button size="sm" variant="outline" onClick={() => setPanel(null)}>
              Close
            </Button>
          </div>
        </div>
      )}
      {panel?.kind === "activate" && target && (
        <ActivatePanel
          plan={plan}
          version={target}
          onDone={done}
          onCancel={() => setPanel(null)}
          onEdit={() => setPanel({ kind: "edit", versionId: target.id })}
        />
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Panels                                                              */
/* ------------------------------------------------------------------ */

function DetailsPanel({
  plan,
  onDone,
  onCancel,
}: {
  plan: Plan;
  onDone: () => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(plan.name);
  const [description, setDescription] = useState(plan.description ?? "");
  const [longDescription, setLongDescription] = useState(
    plan.longDescription ?? "",
  );
  const [isGoalBased, setIsGoalBased] = useState(plan.isGoalBased);
  const [theme, setTheme] = useState<PlanTheme>(plan.theme);
  const [goalsText, setGoalsText] = useState(plan.comboGoals.join(", "));
  const [goalsError, setGoalsError] = useState<string | undefined>();
  const [nameError, setNameError] = useState<string | undefined>();
  const [descError, setDescError] = useState<string | undefined>();
  const [longError, setLongError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const n = validatePlanName(name);
    const d = validatePlanDescription(description);
    const l = validatePlanLongDescription(longDescription);
    setNameError(n ?? undefined);
    setDescError(d ?? undefined);
    setLongError(l ?? undefined);
    const g = validateComboGoals(goalsText);
    setGoalsError(g ?? undefined);
    if (n || d || l || g) return;
    setBusy(true);
    try {
      await updatePlanDetails(plan.id, name, description, {
        longDescription,
        isGoalBased,
        theme,
        comboGoals: parseComboGoals(goalsText),
      });
      await onDone();
    } catch (e) {
      setError(staffErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="mt-5 grid gap-5 border-t border-border pt-5"
    >
      <Field
        id={`name-${plan.id}`}
        label="Plan name"
        autoComplete="off"
        value={name}
        onChange={(event) => setName(event.target.value)}
        error={nameError}
      />
      <div>
        <label
          htmlFor={`desc-${plan.id}`}
          className="mb-1.5 block text-sm font-medium"
        >
          Short description (optional)
        </label>
        <textarea
          id={`desc-${plan.id}`}
          rows={2}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          aria-invalid={descError ? true : undefined}
          className={inputClass}
        />
        {descError && (
          <p role="alert" className="mt-1.5 text-xs text-destructive">
            {descError}
          </p>
        )}
      </div>
      <PlanThemeFields
        idPrefix={`theme-${plan.id}`}
        theme={theme}
        onTheme={setTheme}
        goals={goalsText}
        onGoals={setGoalsText}
        goalsError={goalsError}
      />
      <div>
        <TextAreaField
          id={`long-${plan.id}`}
          label="Full description (optional)"
          hint="Shown on the public Plans page. Leave a blank line between paragraphs. Start a line with ## for a heading."
          rows={8}
          value={longDescription}
          onChange={(event) => setLongDescription(event.target.value)}
        />
        {longError && (
          <p role="alert" className="mt-1.5 text-xs text-destructive">
            {longError}
          </p>
        )}
      </div>
      <CheckField
        id={`goal-${plan.id}`}
        checked={isGoalBased}
        onChange={setIsGoalBased}
      >
        Show the gold "Combo" ribbon on this plan
      </CheckField>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={busy}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function ActivatePanel({
  plan,
  version,
  onDone,
  onCancel,
  onEdit,
}: {
  plan: Plan;
  version: PlanVersion;
  onDone: () => Promise<void>;
  onCancel: () => void;
  onEdit: () => void;
}) {
  const [approved, setApproved] = useState(false);
  const [approvedError, setApprovedError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const problems = activationProblems({
    planName: plan.name,
    contributionAmount: version.contributionAmount,
    minAmount: version.minAmount,
    maxAmount: version.maxAmount,
    termsText: version.termsText,
  });
  const replaces = plan.versions.find((v) => v.status === "active");

  async function go() {
    setError(null);
    if (!approved) {
      setApprovedError(
        "Tick this to confirm the owner approved the amount and terms.",
      );
      return;
    }
    setApprovedError(undefined);
    setBusy(true);
    try {
      await activateVersion(version);
      await onDone();
    } catch (e) {
      setError(staffErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 border-t border-border pt-5">
      <h3 className="text-base font-semibold">
        Make version {version.version} live
      </h3>
      <p className="mt-2 text-sm">
        {describeAmount(version)},{" "}
        {describeDuration(version.durationWeeks).toLowerCase()}.
      </p>

      {problems.length > 0 ? (
        <div
          role="alert"
          className="mt-4 rounded-md border border-destructive/40 p-4 text-sm"
        >
          <p className="font-semibold text-destructive">
            This draft is not ready yet.
          </p>
          <ul className="mt-2 list-disc pl-5">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button size="sm" onClick={onEdit}>
              Edit draft
            </Button>
            <Button size="sm" variant="outline" onClick={onCancel}>
              Close
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 grid gap-4">
          <p className="text-sm text-muted-foreground">
            Members will be able to join this version straight away.
            {replaces
              ? ` Version ${replaces.version} will stop taking new sign-ups. People already on it keep the terms they accepted.`
              : ""}
          </p>
          <CheckField
            id={`approved-${version.id}`}
            checked={approved}
            onChange={setApproved}
            error={approvedError}
          >
            The owner has approved this amount and these terms.
          </CheckField>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button onClick={go} disabled={busy}>
              {busy ? "Working…" : `Make version ${version.version} live`}
            </Button>
            <Button variant="outline" onClick={onCancel} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
