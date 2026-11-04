// Office contact details, approved by the owner on 19 October 2026 (from the previous i-Save
// project). Leave a value as null until the owner confirms it: the Contact page only shows
// details that are filled in. Never guess a number.
// WhatsApp is the "Additional contact" number, confirmed as the office WhatsApp line on 2 November 2026.
// No opening hours have been approved, so they stay null.
// These are only the starting values. Admins edit the live details in Staff > Pages, FAQs and
// contact details, and the site reads those (see office-contact-db.ts). This file is the
// fallback used if the database cannot be reached.
export type OfficeContact = {
  /** The main office line. Printed on receipts. */
  phone: string | null;
  /** Every phone number, shown on the Contact page. */
  phones: Array<{ label: string; value: string }>;
  /** Digits only with country code, for wa.me links. */
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  hours: string | null;
};

export const OFFICE_CONTACT: OfficeContact = {
  phone: "+263 29 226 1341",
  phones: [
    { label: "Office landline", value: "+263 29 226 1341" },
    { label: "Director", value: "+263 78 552 1029" },
    { label: "Additional contact", value: "+263 78 663 9536" },
  ],
  whatsapp: "263786639536",
  email: "zpyfinfo@gmail.com",
  address: "5th floor, Office 511, Yolk House, Bulawayo, Zimbabwe",
  hours: null,
};
