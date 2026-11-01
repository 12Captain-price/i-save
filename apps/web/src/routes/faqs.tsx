import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/site/PageShell";

export const Route = createFileRoute("/faqs")({
  component: FaqsPage,
});

// Only things the organisation has already decided are answered here. Anything still waiting
// for the owner (withdrawals, interest, penalties) says so instead of guessing.
const FAQS: Array<[string, string]> = [
  [
    "Who can join?",
    "You can apply online, or ask the office to register you. You need a valid email address; the office can help you create one. You also confirm your age and accept the terms when you apply.",
  ],
  [
    "What do I pay to join?",
    "A one-time registration fee of US$20, paid at the office. It is a fee, not savings, so it does not count towards your savings balance.",
  ],
  [
    "Is there a monthly charge?",
    "Yes. A small monthly subscription of US$5 covers your membership. It is separate from your savings and never reduces them.",
  ],
  [
    "When does my account become active?",
    "Once staff have checked your national ID at the office and recorded your registration fee. Until then your account shows as pending.",
  ],
  [
    "Why do you check my ID?",
    "Staff look at your physical national ID so that each person has one account only. Only staff can see your ID number, and every time it is opened, the opening is recorded.",
  ],
  [
    "How do I pay?",
    "Payments are made at the office at the moment. Staff record each payment and give you a numbered receipt, and it appears in your account straight away.",
  ],
  [
    "How do I see what I have saved?",
    "Log in and open your account. It shows your confirmed savings, your fees (shown separately), your plan, your receipts and your messages.",
  ],
  [
    "What if a payment was recorded wrongly?",
    "Records are never edited or deleted. A mistake is corrected with a visible reversal and a reason, and you receive a message about it.",
  ],
  [
    "Do I earn interest or returns?",
    "No. i-Save is a place to save. It does not offer interest, bonuses or investment returns.",
  ],
  [
    "Can I withdraw my savings?",
    "Not yet. The withdrawal policy is waiting for the organisation’s approval. It will be published, and shown in your account, before withdrawals open.",
  ],
  [
    "Can I choose how much to save?",
    "You choose from the plans the organisation has approved. You read and accept the terms of a plan before you join it. Contributions are weekly.",
  ],
  [
    "Is my information private?",
    "A member can only see their own records. Staff access is limited to staff roles, and staff actions are recorded in an audit log.",
  ],
];

function FaqsPage() {
  return (
    <PageShell
      eyebrow="FAQs"
      title="Questions members ask."
      lead="Short answers about joining, paying and saving. If yours is not here, the office can help."
    >
      <div className="grid gap-3">
        {FAQS.map(([question, answer]) => (
          <details
            key={question}
            className="group rounded-md border border-border px-5 py-4"
          >
            <summary className="cursor-pointer list-none font-semibold marker:content-none">
              {question}
            </summary>
            <p className="mt-3 text-sm text-muted-foreground">{answer}</p>
          </details>
        ))}
      </div>
      <p className="mt-10 text-sm text-muted-foreground">
        Still have a question?{" "}
        <Link to="/contact" className="underline underline-offset-4">
          Contact the office
        </Link>
        .
      </p>
    </PageShell>
  );
}
