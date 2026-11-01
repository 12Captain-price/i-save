import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { CheckField, Field } from "@/components/ui/field";
import { getNationalId, markIdSighted, type MemberDetail } from "@/lib/staff";
import {
  formatDateTime,
  staffErrorMessage,
  validateNationalId,
} from "@/lib/staff-utils";

/**
 * Staff look at the physical ID and type the number from it. The number on the document
 * wins over whatever the member typed online. Nothing is uploaded or photographed.
 */
export function IdSightingCard({
  member,
  isSelf,
}: {
  member: MemberDetail;
  isSelf: boolean;
}) {
  const queryClient = useQueryClient();
  const [idNumber, setIdNumber] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [checkError, setCheckError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [shown, setShown] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);
  const [lookError, setLookError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const idProblem = validateNationalId(idNumber);
    setFieldError(idProblem ?? undefined);
    setCheckError(
      confirmed ? undefined : "Tick this once you have seen the original ID.",
    );
    if (idProblem || !confirmed) return;

    setBusy(true);
    try {
      await markIdSighted(member.id, idNumber);
      setIdNumber("");
      setConfirmed(false);
      await queryClient.invalidateQueries({ queryKey: ["staff"] });
    } catch (e) {
      setError(staffErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function showNumber() {
    setLookError(null);
    setLooking(true);
    try {
      const value = await getNationalId(member.id);
      setShown(value ?? "No ID number on file");
    } catch (e) {
      setLookError(staffErrorMessage(e));
    } finally {
      setLooking(false);
    }
  }

  return (
    <section
      aria-labelledby="id-heading"
      className="rounded-md border border-border bg-card p-6"
    >
      <h2 id="id-heading" className="text-lg font-semibold">
        National ID
      </h2>

      {member.id_sighted_at ? (
        <div className="mt-3 grid gap-3 text-sm">
          <p>
            <strong>ID sighted</strong> on{" "}
            {formatDateTime(member.id_sighted_at)}.
          </p>
          {shown === null ? (
            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void showNumber()}
                disabled={looking}
              >
                {looking ? "Opening…" : "Show ID number"}
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">
                Every time the number is opened, it is recorded in the audit
                log.
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-base tracking-wide">{shown}</span>
              <Button variant="ghost" size="sm" onClick={() => setShown(null)}>
                Hide
              </Button>
            </div>
          )}
          {lookError && (
            <p role="alert" className="text-sm text-destructive">
              {lookError}
            </p>
          )}
        </div>
      ) : isSelf ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Another staff member must check your ID. You cannot do it for your own
          account.
        </p>
      ) : (
        <form onSubmit={onSubmit} noValidate className="mt-3 grid gap-5">
          <p className="text-sm text-muted-foreground">
            Ask to see the member’s original national ID. The account cannot be
            activated until this is done.
          </p>
          <Field
            id="national-id"
            label="ID number, as shown on the document"
            hint="Spaces and dashes are ignored. If it differs from what the member typed online, this one is kept."
            value={idNumber}
            error={fieldError}
            onChange={(event) => setIdNumber(event.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
          />
          <CheckField
            id="id-seen"
            checked={confirmed}
            error={checkError}
            onChange={setConfirmed}
          >
            I have looked at the member’s original national ID, and the number
            above matches it.
          </CheckField>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Mark ID as sighted"}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
