import { useState } from "react";
import { ChevronRight, Phone } from "lucide-react";
import { WhatsAppIcon } from "@/components/whatsapp/WhatsAppIcon";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { useOfficeContact } from "@/lib/office-contact-db";
import { useSupportContacts } from "@/lib/support-contacts";
import {
  assistanceMessage,
  whatsappLink,
  type MemberContext,
} from "@/lib/whatsapp";

const TOPICS = [
  "a payment",
  "a receipt",
  "my savings plan",
  "a withdrawal",
  "my account",
];

/**
 * "Ask for assistance". The message is already written at the top; the member can change it
 * or write their own. Tapping the office or any staff member goes straight to that person's
 * WhatsApp with the message typed. WhatsApp shows it once more, and the member presses send.
 */
export function AssistancePanel({
  who,
  topic,
}: {
  who: MemberContext;
  topic?: string;
}) {
  const contacts = useSupportContacts();
  const [picked, setPicked] = useState<string | undefined>(topic);
  // null means "use the suggested message"; text means the member changed it.
  const [custom, setCustom] = useState<string | null>(null);

  const suggested = assistanceMessage(who, picked);
  const message = custom ?? suggested;
  const contactInfo = useOfficeContact();
  const office = contactInfo?.whatsapp ? `+${contactInfo.whatsapp}` : null;

  /** Untouched messages greet the person by first name; edited ones are sent exactly as written. */
  const linkFor = (phone: string, staffName?: string) =>
    whatsappLink(phone, custom ?? assistanceMessage(who, picked, staffName));

  return (
    <div className="grid gap-4">
      <div>
        <p className="text-sm text-muted-foreground">
          What do you need help with? (optional)
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {TOPICS.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={picked === t}
              onClick={() => setPicked(picked === t ? undefined : t)}
              className={
                "min-h-9 rounded-full border px-3 text-xs font-semibold " +
                (picked === t
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:border-primary")
              }
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label
          htmlFor="assist-text"
          className="mb-1.5 block text-sm font-medium"
        >
          Your message (change it or write your own)
        </label>
        <textarea
          id="assist-text"
          rows={4}
          className={inputClass}
          value={message}
          onChange={(e) => setCustom(e.target.value)}
        />
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Tap a person below. WhatsApp opens with this message ready, and you
            press send there.
          </p>
          {custom !== null && (
            <Button size="sm" variant="ghost" onClick={() => setCustom(null)}>
              Use suggested message
            </Button>
          )}
        </div>
      </div>

      <ul className="grid list-none gap-2 p-0">
        {office && (
          <li>
            <ContactRow
              name="The iSave office"
              detail="Main office WhatsApp"
              href={linkFor(office)}
              disabled={!message.trim()}
            />
          </li>
        )}
        {contacts.data?.map((c) => (
          <li key={c.id}>
            <ContactRow
              name={c.full_name}
              detail={c.role_title}
              href={linkFor(c.whatsapp_phone, c.full_name)}
              disabled={!message.trim()}
            />
          </li>
        ))}
      </ul>
      {contacts.isPending && (
        <p role="status" className="text-sm text-muted-foreground">
          Loading the team…
        </p>
      )}
      {contacts.isError && (
        <p role="alert" className="text-sm text-destructive">
          The team list could not be loaded. You can still message the office.
        </p>
      )}
      {contactInfo && !office && contacts.data?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No WhatsApp contacts are set up yet. Please call the office
          {contactInfo?.phone ? ` on ${contactInfo.phone}` : ""}.
        </p>
      )}
      {contactInfo?.phone && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Phone className="h-3.5 w-3.5" aria-hidden="true" />
          Prefer to call? {contactInfo.phone}
        </p>
      )}
    </div>
  );
}

function ContactRow({
  name,
  detail,
  href,
  disabled,
}: {
  name: string;
  detail: string;
  href: string | null;
  disabled?: boolean;
}) {
  const body = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white">
        <WhatsAppIcon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{name}</span>
        <span className="block text-xs text-muted-foreground">
          {disabled ? "Write a message first" : detail}
        </span>
      </span>
      <ChevronRight
        className="h-4 w-4 text-muted-foreground"
        aria-hidden="true"
      />
    </>
  );
  const base =
    "flex min-h-14 w-full items-center gap-3 rounded-lg border border-border bg-background p-3 text-left";
  if (!href || disabled) {
    return (
      <div aria-disabled="true" className={base + " opacity-60"}>
        {body}
      </div>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Message ${name} on WhatsApp`}
      className={base + " hover:border-primary focus-visible:border-primary"}
    >
      {body}
    </a>
  );
}
