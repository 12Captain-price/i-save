import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { CheckField } from "@/components/ui/field";
import { joinPlan, type PlanTerms } from "@/lib/member";
import { describeDuration, describePlanAmount } from "@/lib/plan-utils";
import { staffErrorMessage } from "@/lib/staff-utils";

/**
 * Lists the plans the owner has approved. A member reads the terms, ticks to accept and joins.
 * The database makes the final decision; this screen only collects the member's agreement.
 */
export function PlanPicker({
  memberId,
  plans,
}: {
  memberId: string;
  plans: PlanTerms[];
}) {
  const queryClient = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [acceptError, setAcceptError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function open(versionId: string) {
    setOpenId(versionId);
    setAccepted(false);
    setAcceptError(undefined);
    setError(null);
  }

  async function join(plan: PlanTerms) {
    setError(null);
    if (!accepted) {
      setAcceptError("Tick this to confirm you have read and accept the terms.");
      return;
    }
    setAcceptError(undefined);
    setBusy(true);
    try {
      await joinPlan(plan.versionId, true);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["member", memberId] }),
        queryClient.invalidateQueries({
          queryKey: ["staff", "member", memberId],
        }),
      ]);
    } catch (e) {
      setError(staffErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ul className="grid gap-3">
      {plans.map((p) => {
        const isOpen = openId === p.versionId;
        const headingId = `plan-${p.versionId}`;
        return (
          <li key={p.versionId} className="rounded-md border border-border p-4">
            <p id={headingId} className="font-semibold">
              {p.planName}
            </p>
            <p className="mt-1">{describePlanAmount(p)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {describeDuration(p.durationWeeks)}
              {p.durationWeeks === null ? "" : " in total"}
            </p>

            {!isOpen && (
              <div className="mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  aria-describedby={headingId}
                  onClick={() => open(p.versionId)}
                >
                  Read the terms and join
                </Button>
              </div>
            )}

            {isOpen && (
              <div className="mt-4 grid gap-4 border-t border-border pt-4">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase">
                    Plan terms
                  </p>
                  <p className="mt-2 whitespace-pre-wrap">{p.termsText}</p>
                </div>
                {p.amount === null && (
                  <p className="text-xs text-muted-foreground">
                    You choose the amount each time you pay, within the range above.
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Your first contribution will be due in one week. Pay it at the office
                  and staff will record it. You can only be on one plan at a time.
                </p>
                <CheckField
                  id={`accept-${p.versionId}`}
                  checked={accepted}
                  onChange={setAccepted}
                  error={acceptError}
                >
                  I have read and accept these terms.
                </CheckField>
                {error && (
                  <p role="alert" className="text-destructive">
                    {error}
                  </p>
                )}
                <div className="flex flex-wrap gap-3">
                  <Button onClick={() => void join(p)} disabled={busy}>
                    {busy ? "Joining…" : "Join this plan"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setOpenId(null)}
                    disabled={busy}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
