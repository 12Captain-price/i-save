// Pure helpers for the receipt QR code and check page. No Supabase in this file.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True when the text looks like a receipt id, so junk is never sent to the database. */
export const isReceiptId = (text: string) => UUID.test(text);

/** The address printed (as a QR code) on a receipt. */
export function verifyUrl(receiptId: string, origin: string): string {
  return `${origin.replace(/\/$/, "")}/verify/${receiptId}`;
}
