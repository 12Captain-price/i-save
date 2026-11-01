import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage } from "@/components/site/LegalPage";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalPage
      eyebrow="Terms"
      title="Terms and conditions"
      lead="The rules of membership, in plain language."
      sections={[
        {
          heading: "Membership",
          body: (
            <>
              <p>
                You can apply online or be registered by office staff. You must
                be old enough to enter into this agreement, give true details,
                and have a valid email address.
              </p>
              <p>
                Each person may hold one account. Staff check your physical
                national ID at the office, and your account becomes active when
                that check is done and your registration fee is confirmed.
              </p>
            </>
          ),
        },
        {
          heading: "Fees",
          body: (
            <p>
              A one-time registration fee and a monthly subscription apply. They
              are fees for running the organisation. They are recorded
              separately from your savings and never count towards your savings
              balance. Current amounts are on the{" "}
              <Link to="/fees" className="underline underline-offset-4">
                Fees page
              </Link>
              . Fees may be changed only by the organisation, and the new
              amounts are published before they apply.
            </p>
          ),
        },
        {
          heading: "Savings plans and contributions",
          body: (
            <>
              <p>
                You may join a plan the organisation has approved. You read and
                accept that plan’s terms before you join, and an approved plan’s
                terms are not changed for existing members; a change needs a new
                version.
              </p>
              <p>
                Contributions are weekly and are paid at the office. A
                contribution counts only once staff have recorded and confirmed
                it, and you receive a numbered receipt.
              </p>
            </>
          ),
        },
        {
          heading: "Records and corrections",
          body: (
            <p>
              Every money event is kept in a ledger that cannot be edited or
              deleted. If a record is wrong, staff correct it with a visible
              reversal and a written reason, and you are notified. Please check
              your receipts and tell the office quickly if anything looks wrong.
            </p>
          ),
        },
        {
          heading: "No interest or returns",
          body: (
            <p>
              The organisation does not offer, calculate or promise interest,
              bonuses or investment returns. Your savings balance is the total
              of your confirmed contributions.
            </p>
          ),
        },
        {
          heading: "Withdrawals",
          body: (
            <p>
              Withdrawals are not open yet. The withdrawal policy will be
              published, and shown in your account, before any withdrawal can be
              requested.
            </p>
          ),
        },
        {
          heading: "Your account and notifications",
          body: (
            <p>
              Keep your password private and tell the office if you think
              someone else has used your account. We send you messages about
              your account in the app and by email. WhatsApp messages are sent
              only if you opt in separately. See the{" "}
              <Link to="/privacy" className="underline underline-offset-4">
                Privacy notice
              </Link>
              .
            </p>
          ),
        },
        {
          heading: "Changes to these terms",
          body: (
            <p>
              The organisation may update these terms. Changes are published on
              this page before they apply, and the date of the latest version
              will be shown here once the terms are approved.
            </p>
          ),
        },
        {
          heading: "Questions",
          body: (
            <p>
              Contact the office using the details on the{" "}
              <Link to="/contact" className="underline underline-offset-4">
                Contact page
              </Link>
              .
            </p>
          ),
        },
      ]}
    />
  );
}
