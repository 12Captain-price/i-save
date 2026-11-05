// Pure feedback helpers. Nothing here talks to Supabase, so it can be unit tested.

/** Validation shared by the form and tests. Returns a plain-words error, or null. */
export function validateFeedback(v: {
  subject: string;
  message: string;
}): string | null {
  const subject = v.subject.trim();
  if (subject.length < 3)
    return "Please add a short title (at least 3 letters).";
  if (subject.length > 120)
    return "The title is too long (120 letters at most).";
  const message = v.message.trim();
  if (message.length < 10)
    return "Please write a little more (at least 10 characters).";
  if (message.length > 2000)
    return "The message is too long (2000 characters at most).";
  return null;
}

/** Name plus at least one way to reply. Visitors have no account, so this is how staff reach them. */
export function validateContact(v: {
  name: string;
  phone: string;
  email: string;
}): string | null {
  if (v.name.trim().length < 2) return "Please tell us your name.";
  if (v.name.trim().length > 80)
    return "The name is too long (80 letters at most).";
  const phone = v.phone.trim();
  const email = v.email.trim();
  if (!phone && !email)
    return "Please add a phone number or an email so we can reply.";
  if (phone) {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 15)
      return "That phone number does not look right. Please check it.";
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return "That email does not look right. Please check it.";
  return null;
}
