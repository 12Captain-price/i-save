import { OFFICE_CONTACT } from "@/lib/office-contact";

/** The approved office details, read from office-contact.ts so they are never typed twice.
 *  Only details that are filled in are shown. */
export function ContactLines() {
  const { phones, email, address, hours, whatsapp } = OFFICE_CONTACT;
  const any = phones.length || email || address || hours || whatsapp;
  if (!any) return <>Office contact details will be published here soon.</>;
  return (
    <ul className="list-none space-y-1 p-0">
      {address && <li>Office: {address}</li>}
      {phones.map((p) => (
        <li key={p.value}>
          {p.label}:{" "}
          <a
            className="underline underline-offset-4"
            href={"tel:" + p.value.replace(/\s/g, "")}
          >
            {p.value}
          </a>
        </li>
      ))}
      {whatsapp && (
        <li>
          WhatsApp:{" "}
          <a
            className="underline underline-offset-4"
            href={"https://wa.me/" + whatsapp}
          >
            Chat on WhatsApp
          </a>
        </li>
      )}
      {email && (
        <li>
          Email:{" "}
          <a className="underline underline-offset-4" href={"mailto:" + email}>
            {email}
          </a>
        </li>
      )}
      {hours && <li>Hours: {hours}</li>}
    </ul>
  );
}
