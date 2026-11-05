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
