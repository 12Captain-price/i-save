import { createFileRoute } from "@tanstack/react-router";
import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import type { ReactNode } from "react";
import { PageShell } from "@/components/site/PageShell";
import { LoadingSkeleton } from "@/components/ui/motion";
import { useOfficeContact } from "@/lib/office-contact-db";

export const Route = createFileRoute("/contact")({
  component: ContactPage,
});

function Row({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-4 rounded-md border border-border bg-card p-5">
      <span className="mt-0.5 shrink-0 text-portal-accent" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-muted-foreground uppercase">
          {label}
        </p>
        <div className="mt-1 text-sm break-words">{children}</div>
      </div>
    </div>
  );
}

const link = "text-primary underline underline-offset-4";

function ContactPage() {
  const contact = useOfficeContact();
  const { phones, whatsapp, email, address, hours } = contact ?? {
    phones: [],
    whatsapp: null,
    email: null,
    address: null,
    hours: null,
  };
  const hasAny = Boolean(
    phones.length || whatsapp || email || address || hours,
  );
  return (
    <PageShell
      eyebrow="Contact"
      title="Talk to the office."
      lead="Payments, ID checks and registration happen in the office, so that is the best place to start with any question."
    >
      {contact === null ? (
        <LoadingSkeleton lines={4} />
      ) : hasAny ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {phones.map(({ label, value }) => (
            <Row key={value} icon={<Phone className="h-5 w-5" />} label={label}>
              <a className={link} href={"tel:" + value.replace(/\s+/g, "")}>
                {value}
              </a>
            </Row>
          ))}
          {whatsapp && (
            <Row icon={<MessageCircle className="h-5 w-5" />} label="WhatsApp">
              <a className={link} href={"https://wa.me/" + whatsapp}>
                Chat on WhatsApp
              </a>
            </Row>
          )}
          {email && (
            <Row icon={<Mail className="h-5 w-5" />} label="Email">
              <a className={link} href={"mailto:" + email}>
                {email}
              </a>
            </Row>
          )}
          {address && (
            <Row icon={<MapPin className="h-5 w-5" />} label="Office">
              {address}
            </Row>
          )}
          {hours && (
            <Row icon={<Clock className="h-5 w-5" />} label="Opening hours">
              {hours}
            </Row>
          )}
        </div>
      ) : (
        <p
          role="status"
          className="rounded-md border border-border bg-card p-6 text-sm text-muted-foreground"
        >
          Office contact details will be published here soon.
        </p>
      )}
      <section className="mt-8 rounded-md border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">
          Following up on an application?
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Give the name and email address you used to apply. Please contact the
          office rather than submit another application. Do not send passwords
          or payment details.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Use a phone link to call, or the email link to open your email app.
          This website does not send a message on your behalf.
        </p>
      </section>
    </PageShell>
  );
}
