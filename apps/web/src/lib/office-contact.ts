// Office contact details, approved by the owner on 19 October 2026 (from the previous i-Save
// project). Leave a value as null until the owner confirms it: the Contact page only shows
// details that are filled in. Never guess a number.
// WhatsApp is the "Additional contact" number, confirmed as the office WhatsApp line on 2 November 2026.
// No opening hours have been approved, so they stay null.
export const OFFICE_CONTACT = {
  /** The main office line. Printed on receipts. */
  phone: "+263 29 226 1341" as string | null,
  /** Every approved phone number, shown on the Contact page. */
  phones: [
    { label: "Office landline", value: "+263 29 226 1341" },
    { label: "Director", value: "+263 78 552 1029" },
    { label: "Additional contact", value: "+263 78 663 9536" },
  ] as Array<{ label: string; value: string }>,
  whatsapp: "263786639536" as string | null, // digits only with country code, for wa.me links (the office "Additional contact" number)
  email: "zpyfinfo@gmail.com" as string | null,
  address: "5th floor, Office 511, Yolk House, Bulawayo, Zimbabwe" as
    | string
    | null,
  hours: null as string | null,
};
