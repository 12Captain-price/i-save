import { useState } from "react";
import { WhatsAppComposer } from "@/components/whatsapp/WhatsAppComposer";
import { WhatsAppIcon } from "@/components/whatsapp/WhatsAppIcon";
import { Button } from "@/components/ui/button";

/** A small WhatsApp icon button for staff screens. Opens a review box with the starting
 *  messages given, then WhatsApp. Hidden when the member has no phone number. */
export function MessageMemberButton({
  memberName,
  phone,
  templates,
  label = "Message on WhatsApp",
  showLabel = false,
  optedIn,
}: {
  memberName: string;
  phone: string | null;
  templates: Array<{ label: string; text: string }>;
  label?: string;
  showLabel?: boolean;
  /** When false, the box reminds staff the member has not agreed to WhatsApp notices. */
  optedIn?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (!phone) return null;
  return (
    <>
      <Button
        variant="outline"
        size={showLabel ? "sm" : "icon"}
        aria-label={`${label}: ${memberName || "member"}`}
        title={label}
        onClick={() => setOpen(true)}
        className={showLabel ? "" : "h-9 w-9 text-[#128C7E]"}
      >
        <WhatsAppIcon className="h-4 w-4" />
        {showLabel && label}
      </Button>
      {open && (
        <WhatsAppComposer
          title={label}
          toName={memberName || "the member"}
          phone={phone}
          templates={templates}
          onClose={() => setOpen(false)}
          note={
            optedIn === false
              ? "This member has not agreed to WhatsApp notices. Only send what they asked for or what is needed for their account."
              : undefined
          }
        />
      )}
    </>
  );
}
