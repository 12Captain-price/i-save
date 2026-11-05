// Pure review helpers. Nothing here talks to Supabase, so it can be unit tested.

/** Validation shared by the member form and the staff form. */
export function validateReview(v: {
  author_name: string;
  body: string;
  rating: number;
}): string | null {
  const name = v.author_name.trim();
  if (name.length < 2) return "Please enter a name (at least 2 letters).";
  if (name.length > 80) return "The name is too long (80 letters at most).";
  const body = v.body.trim();
  if (body.length < 10)
    return "Please write a little more (at least 10 characters).";
  if (body.length > 800)
    return "The review is too long (800 characters at most).";
  if (!Number.isInteger(v.rating) || v.rating < 1 || v.rating > 5)
    return "Pick a star rating from 1 to 5.";
  return null;
}
