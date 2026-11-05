// WhatsApp click-to-chat (stage 1). Nothing is sent automatically: we open WhatsApp with a
// message already typed, the person reviews or edits it, and presses send themselves.
import { formatMoney, type Money } from "@/lib/money";

/** +263 78 663 9536 or 263786639536 becomes 263786639536, the form wa.me needs. */
export function whatsappDigits(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

/** A wa.me link with the message ready to send. Null when the number is unusable. */
export function whatsappLink(phone: string, message: string): string | null {
  const digits = whatsappDigits(phone);
  if (!digits) return null;
  const text = message.trim();
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export type MemberContext = { name: string; memberNumber: string };

const firstName = (full: string) => full.trim().split(/\s+/)[0] ?? "";

/** "Hello Nia, this is Tendai Moyo (member ISV-0012)." Says who is writing, so staff can find the account. */
export function memberIntro(who: MemberContext, staffName?: string): string {
  const hello = staffName ? `Hello ${firstName(staffName)},` : "Hello,";
  const id = who.memberNumber
    ? `${who.name} (member ${who.memberNumber})`
    : who.name;
  return `${hello} this is ${id}.`;
}

/** Member to office or staff. */
export function assistanceMessage(
  who: MemberContext,
  topic?: string,
  staffName?: string,
): string {
  const about = topic ? ` I need help with ${topic}.` : " I need some help.";
  return `${memberIntro(who, staffName)}${about}`;
}

export type ReceiptFacts = {
  receiptNumber: string;
  amount: Money;
  currency: string;
  purposeLabel: string;
  issuedOn: string;
};

/** Staff to member: what each template says. Wording never claims money is confirmed early. */
export const STAFF_TEMPLATES = {
  general: (m: string) => `Hello ${m}, this is the iSave office.`,
  receipt: (m: string, r: ReceiptFacts) =>
    `Hello ${m}, this is the iSave office. We have recorded your ${r.purposeLabel.toLowerCase()} of ${formatMoney(r.amount, r.currency)} on ${r.issuedOn}. Your receipt number is ${r.receiptNumber}. Please keep it.`,
  reminder: (m: string, amount: string | null, dueOn: string) =>
    `Hello ${m}, this is the iSave office. A friendly reminder that your contribution${amount ? ` of ${amount}` : ""} is due on ${dueOn}. You can pay at the office. Thank you.`,
  confirmation: (m: string, what: string) =>
    `Hello ${m}, this is the iSave office. We are confirming ${what}. Please reply if anything looks wrong.`,
  feedback: (m: string, kind: string, subject: string) =>
    `Hello ${m}, this is the iSave office. Thank you for your ${kind.toLowerCase()} about “${subject}”. We have read it and would like to follow up with you.`,
} as const;

export const memberFirstName = firstName;
