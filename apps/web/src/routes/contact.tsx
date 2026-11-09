import { createFileRoute } from "@tanstack/react-router";
import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import type { ReactNode } from "react";
import { Photo } from "@/components/site/Photo";
import { PageShell } from "@/components/site/PageShell";
import { LoadingSkeleton } from "@/components/ui/motion";
import { useTeam, useTeamContacts } from "@/lib/content";
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

const link = "inline-block py-2 text-primary underline underline-offset-4";

function ContactPage() {
  const contact = useOfficeContact();
  const { phones, whatsapp, email, address, hours } = contact ?? {
    phones: [],
    whatsapp: null,
    email: null,
    address: null,
    hours: null,
  };
  const team = useTeam().data ?? [];
  const teamContacts = useTeamContacts().data ?? [];
  // Only people staff ticked "show on Contact page" (the database already filters these).
  const people = team.flatMap((m) => {
    const c = teamContacts.find(
      (t) => t.member_id === m.id && t.show_on_contact && (t.phone || t.email),
    );
    return c ? [{ member: m, phone: c.phone, email: c.email }] : [];
  });
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
      {people.length > 0 && (
        <section aria-labelledby="contact-team" className="mt-10">
          <h2 id="contact-team" className="text-2xl font-semibold">
            Reach the team
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {people.map(({ member, phone, email }) => (
              <div
                key={member.id}
                className="flex items-start gap-4 rounded-md border border-border bg-card p-5"
              >
                <Photo
                  path={member.photo_path}
                  alt={member.full_name}
                  fallbackName={member.full_name}
                  className="h-14 w-14 shrink-0 rounded-full object-cover"
                />
                <div className="min-w-0">
                  <p className="font-semibold">{member.full_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {member.role_title}
                  </p>
                  {phone && (
                    <a
                      className={link + " block text-sm"}
                      href={"tel:" + phone}
                    >
                      {phone}
                    </a>
                  )}
                  {email && (
                    <a
                      className={link + " block text-sm break-all"}
                      href={"mailto:" + email}
                    >
                      {email}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
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
