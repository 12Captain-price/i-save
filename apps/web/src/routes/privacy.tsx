import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage } from "@/components/site/LegalPage";
import { ContactLines } from "@/components/site/ContactLines";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Privacy"
      title="Privacy notice"
      lead="What we collect, why, and who can see it."
      sections={[
        {
          heading: "What we collect",
          body: (
            <p>
              Your full name, email address, phone number and national ID
              number; the savings category you are interested in; your payments,
              receipts and plan choices; your notification choices; and a record
              of staff actions on your account. We do not collect ID document
              uploads or photographs.
            </p>
          ),
        },
        {
          heading: "Why we collect it",
          body: (
            <p>
              To run your membership: to make sure each person has one account,
              to record your payments accurately, to contact you about your
              account, and to keep a trustworthy record that can be checked.
            </p>
          ),
        },
        {
          heading: "Who can see it",
          body: (
            <>
              <p>
                You can see your own records only. Office staff can see member
                records as far as their role needs. Your national ID number is
                visible to staff only, and each time it is opened, that is
                recorded in an audit log.
              </p>
              <p>We do not sell your information or use it for advertising.</p>
            </>
          ),
        },
        {
          heading: "Services we use",
          body: (
            <p>
              Your data is stored with our database and sign-in provider
              (Supabase), the website runs on Cloudflare, and emails are sent
              through an email delivery provider. These providers handle data
              only to provide those services to us.
            </p>
          ),
        },
        {
          heading: "Messages",
          body: (
            <p>
              Account messages appear in the app and are sent to your email.
              WhatsApp messages are sent only if you opt in, and you can opt out
              again by telling the office.
            </p>
          ),
        },
        {
          heading: "How long we keep it",
          body: (
            <p>
              Payment records and audit logs are permanent by design, so that
              the money history can always be checked. The retention period for
              other personal details will be confirmed when this notice is
              approved.
            </p>
          ),
        },
        {
          heading: "Your choices",
          body: (
            <p>
              You can ask the office to see or correct your details. Some
              records, such as payments, cannot be deleted because the ledger
              must stay complete; they can be corrected only by a visible
              reversal.
            </p>
          ),
        },
        {
          heading: "Contact",
          body: (
            <>
              <p>
                For privacy questions, use the details on the{" "}
                <Link to="/contact" className="underline underline-offset-4">
                  Contact page
                </Link>
                .
              </p>
              <ContactLines />
            </>
          ),
        },
      ]}
    />
  );
}
