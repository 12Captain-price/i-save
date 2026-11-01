// Phone numbers are stored in international format (E.164), for example +263771234567.
// The database refuses anything else, so every form must pass numbers through here first.

export type PhoneResult = { ok: true; value: string } | { ok: false; message: string };

const ALLOWED_CHARACTERS = /^\+?[\d\s\-().]+$/;
const E164 = /^\+[1-9][0-9]{7,14}$/;
const ZIMBABWE_NUMBER = /^\+263[1-9][0-9]{8}$/;

/** Turns what a person typed into +263771234567, or explains what is wrong. */
export function normalizePhone(input: string): PhoneResult {
  const trimmed = input.trim();
  if (trimmed === "") return { ok: false, message: "Enter a phone number." };
  if (!ALLOWED_CHARACTERS.test(trimmed)) {
    return {
      ok: false,
      message: "Phone numbers can only contain digits, spaces, dashes and a leading +.",
    };
  }

  const digits = trimmed.replace(/\D/g, "");
  let e164: string;

  if (trimmed.startsWith("+")) {
    e164 = `+${digits}`;
  } else if (digits.startsWith("00")) {
    e164 = `+${digits.slice(2)}`;
  } else if (digits.startsWith("263")) {
    e164 = `+${digits}`;
  } else if (digits.startsWith("0")) {
    const national = digits.slice(1);
    if (national.length !== 9) {
      return {
        ok: false,
        message: "A Zimbabwean number starting with 0 needs 10 digits, for example 0771234567.",
      };
    }
    e164 = `+263${national}`;
  } else if (digits.length === 9 && digits.startsWith("7")) {
    e164 = `+263${digits}`;
  } else {
    return {
      ok: false,
      message: "Enter the number like 0771234567, or with a country code like +263771234567.",
    };
  }

  if (e164.startsWith("+263") && !ZIMBABWE_NUMBER.test(e164)) {
    return { ok: false, message: "Zimbabwean numbers need 9 digits after +263." };
  }
  if (!E164.test(e164)) {
    return { ok: false, message: "That does not look like a valid phone number." };
  }
  return { ok: true, value: e164 };
}

/** True for Zimbabwean mobile numbers (Econet 77/78, NetOne 71, Telecel 73). */
export function isZimbabweMobile(e164: string): boolean {
  return /^\+263(71|73|77|78)[0-9]{7}$/.test(e164);
}
