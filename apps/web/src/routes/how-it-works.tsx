import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/site/PageShell";

export const Route = createFileRoute("/how-it-works")({
  component: HowItWorksPage,
});

const STEPS = [
  [
    "Apply for membership",
    "Apply online, or ask the office to register you. You will need a valid email address; the office can help you create one. We collect your national ID number, and staff check the physical ID when you visit.",
  ],
  [
    "Pay the registration fee at the office",
    "Staff record your payment and give you a numbered receipt. Once the fee is confirmed and your ID has been checked, your account becomes active.",
  ],
  [
    "Choose a savings goal",
    "Pick from the plans the organisation has approved. You confirm that you have read the terms before you join a plan.",
  ],
  [
    "Save week by week",
    "Pay your contributions at the office. Staff record each one, and it appears in your history with its own receipt.",
  ],
  [
    "Keep your subscription up to date",
    "A small monthly subscription covers membership. It is separate from your savings and never reduces them.",
  ],
];

const GOOD_TO_KNOW = [
  [
    "Every payment is recorded.",
    "Payments are kept in a ledger that cannot be edited. A mistake is corrected with a visible reversal and a reason, never by changing the original.",
  ],
  [
    "Savings and fees are shown separately.",
    "Your savings balance only ever grows from your contributions.",
  ],
  [
    "No interest or returns.",
    "i-Save is a place to save. It does not offer interest, bonuses or investment returns.",
  ],
  [
    "Withdrawals are not open yet.",
    "The withdrawal policy is waiting for the organisation’s approval and will be published before withdrawals open.",
  ],
];

function HowItWorksPage() {
  return (
    <PageShell
      eyebrow="How it works"
      title="From application to your first saving."
      lead="Payments are made in the office at the moment, so everything you pay is checked by a person and recorded straight away."
    >
      <ol className="grid gap-6">
        {STEPS.map(([title, text], index) => (
          <li key={title} className="flex gap-5 border-t border-border pt-5">
            <span
              className="font-display text-sm font-bold text-primary tabular-nums"
              aria-hidden="true"
            >
              0{index + 1}
            </span>
            <div>
              <h2 className="text-lg font-semibold">{title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{text}</p>
            </div>
          </li>
        ))}
      </ol>

      <h2 className="mt-14 text-2xl font-semibold">Good to know</h2>
      <ul className="mt-6 grid gap-5 sm:grid-cols-2">
        {GOOD_TO_KNOW.map(([title, text]) => (
          <li key={title} className="border-l border-border pl-5">
            <h3 className="font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{text}</p>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
