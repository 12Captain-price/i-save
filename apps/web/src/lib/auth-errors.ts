// Plain-language messages. They never say which detail was wrong, so nobody can use the
// forms to find out who is already a member.
export function friendlySignUpError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Too many attempts. Please wait a few minutes and try again.";
  }
  if (m.includes("password")) {
    return "Choose a stronger password of at least 8 characters.";
  }
  if (m.includes("database error")) {
    return "We could not create your application. If you have applied before, log in or contact the office.";
  }
  return "We could not create your application. Please check your details and try again.";
}

export function friendlyLoginError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("email not confirmed")) {
    return "Please confirm your email first. Check your inbox for our message.";
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Too many attempts. Please wait a few minutes and try again.";
  }
  if (m.includes("invalid login") || m.includes("invalid credentials")) {
    return "Incorrect email or password.";
  }
  return "We could not log you in. Please try again.";
}
