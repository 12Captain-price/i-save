import { useState, type FormEvent } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { PageShell } from "@/components/site/PageShell";
import { TextAreaField, ErrorLine } from "@/components/staff/FormBits";
import { StatusPill } from "@/components/staff/StatusPill";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { useAuth } from "@/lib/auth";
import {
  FEEDBACK_KINDS,
  STATUS_LABEL,
  kindLabel,
  sendFeedback,
  useMyFeedback,
  type FeedbackKind,
} from "@/lib/feedback";
import { validateFeedback } from "@/lib/feedback-utils";
import { formatDate, staffErrorMessage } from "@/lib/staff-utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/feedback")({
  component: FeedbackPage,
});

function FeedbackPage() {
  return (
    <PageShell
      eyebrow="Send us feedback"
      title="We would like to hear from you."
      lead="Tell us what is working, what is not, or what you need. The office reads every message and can reply to you on WhatsApp."
    >
      <FeedbackForm />
    </PageShell>
  );
}

function FeedbackForm() {
  const { session, profile, loading } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user.id;
  const mine = useMyFeedback(userId);
  const [kind, setKind] = useState<FeedbackKind>("feedback");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  if (loading) return null;
  if (!session) {
    return (
      <div className="rounded-2xl border border-border bg-muted/50 p-6">
        <p className="text-sm text-muted-foreground">
          Please sign in so we know who to reply to.
        </p>
        <Link to="/login" className={buttonVariants({ className: "mt-4" })}>
          Sign in
        </Link>
      </div>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const problem = validateFeedback({ subject, message });
    if (problem) return setError(problem);
    setError(null);
    setBusy(true);
    try {
      await sendFeedback(
        { kind, subject: subject.trim(), message: message.trim() },
        userId as string,
      );
      await queryClient.invalidateQueries({ queryKey: ["feedback"] });
      setSent(true);
      setSubject("");
      setMessage("");
    } catch (err) {
      setError(staffErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-10">
      {sent ? (
        <div className="flex items-start gap-3 rounded-2xl border border-primary/40 bg-primary/10 p-6">
          <CheckCircle2
            className="mt-0.5 size-5 text-primary"
            aria-hidden="true"
          />
          <div>
            <p className="text-lg font-semibold">
              Thank you
              {profile?.fullName ? `, ${profile.fullName.split(/\s+/)[0]}` : ""}
              !
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Your message has reached the office. We will get back to you,
              often on WhatsApp.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => setSent(false)}
            >
              Send another
            </Button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={onSubmit}
          noValidate
          className="grid max-w-xl gap-5 rounded-2xl border border-border bg-muted/50 p-6 md:p-8"
        >
          <fieldset>
            <legend className="mb-2 text-sm font-medium">
              What is this about?
            </legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {FEEDBACK_KINDS.map((k) => (
                <label
                  key={k.key}
                  className={cn(
                    "has-[:focus-visible]:ring-ring cursor-pointer rounded-md border px-3 py-2.5 text-center text-sm font-semibold transition-colors has-[:focus-visible]:ring-2",
                    kind === k.key
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border hover:bg-accent",
                  )}
                >
                  <input
                    type="radio"
                    name="kind"
                    value={k.key}
                    checked={kind === k.key}
                    onChange={() => setKind(k.key)}
                    className="sr-only"
                  />
                  {k.label}
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {FEEDBACK_KINDS.find((k) => k.key === kind)?.hint}
            </p>
          </fieldset>
          <Field
            id="fb-subject"
            label="Title"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={120}
          />
          <TextAreaField
            id="fb-message"
            label="Your message"
            rows={6}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={2000}
            hint={`${message.trim().length} of 2000 characters`}
          />
          <ErrorLine message={error} />
          <div>
            <Button type="submit" disabled={busy}>
              {busy ? "Sending…" : "Send to the office"}
            </Button>
          </div>
        </form>
      )}

      {mine.data && mine.data.length > 0 && (
        <section aria-labelledby="my-messages">
          <h2 id="my-messages" className="text-xl font-semibold">
            Your earlier messages
          </h2>
          <ul className="mt-4 grid gap-3">
            {mine.data.map((m) => (
              <li
                key={m.id}
                className="rounded-md border border-border bg-card p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{m.subject}</p>
                  <StatusPill
                    status={m.status === "resolved" ? "active" : "open"}
                    label={STATUS_LABEL[m.status]}
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {kindLabel(m.kind)} · {formatDate(m.created_at)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
