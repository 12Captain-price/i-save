import { useState, type FormEvent } from "react";
import { ErrorLine, TextAreaField } from "@/components/staff/FormBits";
import { useContentAction } from "@/components/staff/useContentAction";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { LoadingSkeleton } from "@/components/ui/motion";
import type { OfficeContact } from "@/lib/office-contact";
import { saveOfficeContact, useOfficeContact } from "@/lib/office-contact-db";
import { whatsappDigits } from "@/lib/whatsapp";

type PhoneRow = { label: string; value: string };

/** Edit the details shown on the Contact page, in the assistance panel and on printed receipts. */
export function OfficeContactAdmin() {
  const contact = useOfficeContact();
  if (!contact) return <LoadingSkeleton lines={4} />;
  return <ContactForm initial={contact} />;
}

function ContactForm({ initial }: { initial: OfficeContact }) {
  const { run, busy, error, setError } = useContentAction();
  const [phones, setPhones] = useState<PhoneRow[]>(
    initial.phones.length > 0 ? initial.phones : [{ label: "", value: "" }],
  );
  const [whatsapp, setWhatsapp] = useState(
    initial.whatsapp ? `+${initial.whatsapp}` : "",
  );
  const [email, setEmail] = useState(initial.email ?? "");
  const [address, setAddress] = useState(initial.address ?? "");
  const [hours, setHours] = useState(initial.hours ?? "");
  const [saved, setSaved] = useState(false);

  const setRow = (i: number, patch: Partial<PhoneRow>) => {
    setSaved(false);
    setPhones((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaved(false);

    const cleaned = phones
      .map((p) => ({ label: p.label.trim(), value: p.value.trim() }))
      .filter((p) => p.label !== "" || p.value !== "");
    for (const p of cleaned) {
      if (p.label === "" || p.value.replace(/\D/g, "").length < 7) {
        setError(
          "Each phone number needs a label (for example Director) and a valid number.",
        );
        return;
      }
    }

    let wa: string | null = null;
    if (whatsapp.trim() !== "") {
      wa = whatsappDigits(whatsapp);
      if (!wa) {
        setError(
          "The WhatsApp number is not valid. Use the full number with the country code, for example +263 78 663 9536.",
        );
        return;
      }
    }
    const mail = email.trim();
    if (mail !== "" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) {
      setError("That email address does not look right.");
      return;
    }

    const ok = await run(() =>
      saveOfficeContact({
        phones: cleaned,
        whatsapp: wa,
        email: mail === "" ? null : mail,
        address: address.trim() === "" ? null : address.trim(),
        hours: hours.trim() === "" ? null : hours.trim(),
      }),
    );
    if (ok) setSaved(true);
  }

  return (
    <form onSubmit={submit} className="grid max-w-2xl gap-6">
      <p className="text-sm text-muted-foreground">
        These details appear on the Contact page, in “Ask for assistance” and on
        printed receipts. The first phone number is the main office line printed
        on receipts. Leave a field empty to hide it.
      </p>

      <fieldset className="grid gap-3">
        <legend className="mb-1 text-sm font-medium">Phone numbers</legend>
        {phones.map((p, i) => (
          <div
            key={i}
            className="grid gap-3 rounded-md border border-border p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          >
            <Field
              id={`oc-label-${i}`}
              label="Label"
              value={p.label}
              placeholder="Director"
              onChange={(e) => setRow(i, { label: e.target.value })}
            />
            <Field
              id={`oc-phone-${i}`}
              label="Number"
              value={p.value}
              placeholder="+263 78 552 1029"
              onChange={(e) => setRow(i, { value: e.target.value })}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSaved(false);
                setPhones((rows) => rows.filter((_, j) => j !== i));
              }}
            >
              Remove
            </Button>
          </div>
        ))}
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setSaved(false);
              setPhones((rows) => [...rows, { label: "", value: "" }]);
            }}
          >
            Add a phone number
          </Button>
        </div>
      </fieldset>

      <Field
        id="oc-whatsapp"
        label="Office WhatsApp number"
        value={whatsapp}
        placeholder="+263 78 663 9536"
        hint="Used for “Chat on WhatsApp” and the office row in “Ask for assistance”."
        onChange={(e) => {
          setSaved(false);
          setWhatsapp(e.target.value);
        }}
      />
      <Field
        id="oc-email"
        label="Email"
        type="email"
        value={email}
        onChange={(e) => {
          setSaved(false);
          setEmail(e.target.value);
        }}
      />
      <TextAreaField
        id="oc-address"
        label="Office address"
        rows={2}
        value={address}
        onChange={(e) => {
          setSaved(false);
          setAddress(e.target.value);
        }}
      />
      <Field
        id="oc-hours"
        label="Opening hours"
        value={hours}
        placeholder="Monday to Friday, 8am to 4pm"
        hint="Optional. Leave empty until the office confirms its hours."
        onChange={(e) => {
          setSaved(false);
          setHours(e.target.value);
        }}
      />

      <ErrorLine message={error} />
      {saved && (
        <p role="status" className="text-sm font-semibold text-primary">
          Saved. The website now shows these details.
        </p>
      )}
      <div>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save contact details"}
        </Button>
      </div>
    </form>
  );
}
