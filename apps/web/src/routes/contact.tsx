import { createFileRoute } from "@tanstack/react-router";
import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import type { ReactNode } from "react";
import { PageShell } from "@/components/site/PageShell";
import { OFFICE_CONTACT } from "@/lib/office-contact";

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
  const { phone, whatsapp, email, address, hours } = OFFICE_CONTACT;
  const hasAny = Boolean(phone || whatsapp || email || address || hours);
  return (
    <PageShell
      eyebrow="Contact"
      title="Talk to the office."
      lead="Payments, ID checks and registration happen in the office, so that is the best place to start with any question."
    >
      {hasAny ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {phone && (
            <Row icon={<Phone className="h-5 w-5" />} label="Phone">
              <a className={link} href={"tel:" + phone.replace(/\s+/g, "")}>
                {phone}
              </a>
            </Row>
          )}
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
    </PageShell>
  );
}
