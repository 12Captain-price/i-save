import { useState } from "react";
import { ChevronRight, Phone } from "lucide-react";
import { WhatsAppComposer } from "@/components/whatsapp/WhatsAppComposer";
import { WhatsAppIcon } from "@/components/whatsapp/WhatsAppIcon";
import { OFFICE_CONTACT } from "@/lib/office-contact";
import { useSupportContacts } from "@/lib/support-contacts";
import {
  assistanceMessage,
  memberIntro,
  type MemberContext,
} from "@/lib/whatsapp";

const TOPICS = [
  "a payment",
  "a receipt",
  "my savings plan",
  "a withdrawal",
  "my account",
];

type Target = { name: string; phone: string; staffName?: string };

/** "Ask for assistance": the office first, then each staff member. Tapping one opens a
 *  review box with the message typed, then WhatsApp. */
export function AssistancePanel({
  who,
  topic,
}: {
  who: MemberContext;
  topic?: string;
}) {
  const contacts = useSupportContacts();
  const [target, setTarget] = useState<Target | null>(null);
  const [picked, setPicked] = useState<string | undefined>(topic);

  const office = OFFICE_CONTACT.whatsapp ? `+${OFFICE_CONTACT.whatsapp}` : null;

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

      <ul className="grid list-none gap-2 p-0">
        {office && (
          <li>
            <ContactRow
              name="The iSave office"
              detail="Main office WhatsApp"
              onClick={() => setTarget({ name: "the iSave office", phone: office })}
            />
          </li>
        )}
        {contacts.data?.map((c) => (
          <li key={c.id}>
            <ContactRow
              name={c.full_name}
              detail={c.role_title}
              onClick={() =>
                setTarget({
                  name: c.full_name,
                  phone: c.whatsapp_phone,
                  staffName: c.full_name,
                })
              }
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
      {!office && contacts.data?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No WhatsApp contacts are set up yet. Please call the office
          {OFFICE_CONTACT.phone ? ` on ${OFFICE_CONTACT.phone}` : ""}.
        </p>
      )}
      {OFFICE_CONTACT.phone && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Phone className="h-3.5 w-3.5" aria-hidden="true" />
          Prefer to call? {OFFICE_CONTACT.phone}
        </p>
      )}

      {target && (
        <WhatsAppComposer
          title="Ask for assistance"
          toName={target.name}
          phone={target.phone}
          onClose={() => setTarget(null)}
          templates={[
            {
              label: "Suggested",
              text: assistanceMessage(who, picked, target.staffName),
            },
            {
              label: "Start blank",
              text: `${memberIntro(who, target.staffName)} `,
            },
          ]}
        />
      )}
    </div>
  );
}

function ContactRow({
  name,
  detail,
  onClick,
}: {
  name: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-14 w-full items-center gap-3 rounded-lg border border-border bg-background p-3 text-left hover:border-primary focus-visible:border-primary"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white">
        <WhatsAppIcon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{name}</span>
        <span className="block text-xs text-muted-foreground">{detail}</span>
      </span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}
