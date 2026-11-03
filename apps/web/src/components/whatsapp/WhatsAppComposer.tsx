import { useState } from "react";
import { X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { WhatsAppIcon } from "@/components/whatsapp/WhatsAppIcon";
import { whatsappLink } from "@/lib/whatsapp";

export type Template = { label: string; text: string };

/**
 * Review step before WhatsApp opens. The message is already typed; the person can pick a
 * different starting text, change it, or write their own, then open WhatsApp. WhatsApp shows
 * the message once more, and only the person's own send button sends it.
 */
export function WhatsAppComposer({
  title,
  toName,
  phone,
  templates,
  onClose,
  note,
}: {
  title: string;
  toName: string;
  phone: string;
  templates: Template[];
  onClose: () => void;
  note?: string;
}) {
  const [text, setText] = useState(templates[0]?.text ?? "");
  const href = whatsappLink(phone, text);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="wa-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center"
    >
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="wa-title" className="text-lg font-semibold">
              {title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              To {toName} on WhatsApp
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close"
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </Button>
        </div>

        {templates.length > 1 && (
          <div className="mt-4 flex flex-wrap gap-2" aria-label="Starting messages">
            {templates.map((t) => (
              <Button
                key={t.label}
                size="sm"
                variant={text === t.text ? "default" : "outline"}
                onClick={() => setText(t.text)}
              >
                {t.label}
              </Button>
            ))}
          </div>
        )}

        <label htmlFor="wa-text" className="mt-4 mb-1.5 block text-sm font-medium">
          Your message (you can change it)
        </label>
        <textarea
          id="wa-text"
          rows={6}
          className={inputClass}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        {note && <p className="mt-2 text-xs text-muted-foreground">{note}</p>}
        <p className="mt-2 text-xs text-muted-foreground">
          Nothing is sent from here. WhatsApp opens with this message ready, and
          you press send there.
        </p>

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {href && text.trim() ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className={buttonVariants()}
            >
              <WhatsAppIcon className="h-4 w-4" />
              Open WhatsApp
            </a>
          ) : (
            <Button disabled>
              <WhatsAppIcon className="h-4 w-4" />
              Open WhatsApp
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
