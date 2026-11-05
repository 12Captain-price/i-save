import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { PageShell } from "@/components/site/PageShell";
import { TextAreaField, ErrorLine } from "@/components/staff/FormBits";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import {
  FEEDBACK_KINDS,
  sendFeedback,
  type FeedbackKind,
} from "@/lib/feedback";
import { validateContact, validateFeedback } from "@/lib/feedback-utils";
import { staffErrorMessage } from "@/lib/staff-utils";
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
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [trap, setTrap] = useState("");
  const [kind, setKind] = useState<FeedbackKind>("feedback");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const problem =
      validateContact({ name, phone, email }) ??
      validateFeedback({ subject, message });
    if (problem) return setError(problem);
    setError(null);
    // Bots fill in the hidden field. Pretend it worked and send nothing.
    if (trap) {
      setSent(true);
      return;
    }
    setBusy(true);
    try {
      await sendFeedback({
        kind,
        subject: subject.trim(),
        message: message.trim(),
        sender_name: name.trim(),
        sender_phone: phone.trim() || null,
        sender_email: email.trim() || null,
      });
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
              Thank you{name.trim() ? `, ${name.trim().split(/\s+/)[0]}` : ""}!
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
          className="relative grid max-w-xl gap-5 rounded-2xl border border-border bg-muted/50 p-6 md:p-8"
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
            id="fb-name"
            label="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            autoComplete="name"
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              id="fb-phone"
              label="Phone or WhatsApp"
              hint="Add a phone number or an email, so we can reply."
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={30}
              autoComplete="tel"
            />
            <Field
              id="fb-email"
              label="Email (optional)"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={120}
              autoComplete="email"
            />
          </div>
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
          <div aria-hidden="true" className="absolute -left-[9999px]">
            <label htmlFor="fb-website">Leave this empty</label>
            <input
              id="fb-website"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={trap}
              onChange={(e) => setTrap(e.target.value)}
            />
          </div>
          <ErrorLine message={error} />
          <div>
            <Button type="submit" disabled={busy}>
              {busy ? "Sending…" : "Send to the office"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
