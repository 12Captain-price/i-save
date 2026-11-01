import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage } from "@/components/site/LegalPage";

export const Route = createFileRoute("/disclosures")({
  component: DisclosuresPage,
});

function DisclosuresPage() {
  return (
    <LegalPage
      eyebrow="Disclosures"
      title="Risk and withdrawal disclosure"
      lead="Important things to know before you save."
      sections={[
        {
          heading: "No interest, bonuses or returns",
          body: (
            <p>
              i-Save is a place to save. It does not offer interest, bonuses or
              investment returns, and nothing on this site promises growth.
            </p>
          ),
        },
        {
          heading: "Withdrawals are not open",
          body: (
            <p>
              The withdrawal policy is waiting for the organisation’s approval.
              You cannot request a withdrawal until it is published. Please
              consider this before you start saving.
            </p>
          ),
        },
        {
          heading: "Fees are not savings",
          body: (
            <p>
              Registration and subscription fees are kept separate from your
              savings and are not part of your savings balance. See the{" "}
              <Link to="/fees" className="underline underline-offset-4">
                Fees page
              </Link>
              .
            </p>
          ),
        },
        {
          heading: "Currency",
          body: (
            <p>
              Amounts are in US dollars for now. Any change of currency will be
              announced before it applies.
            </p>
          ),
        },
        {
          heading: "Not financial advice",
          body: (
            <p>
              Nothing on this site is financial advice. Choose a plan that suits
              your own situation, and ask the office if you are unsure.
            </p>
          ),
        },
      ]}
    />
  );
}
