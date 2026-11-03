// A short "See you soon" moment after logging out. The name is remembered for a moment in
// session storage because the screen changes as soon as the person is signed out.

const KEY = "isave:goodbye";
export const GOODBYE_EVENT = "isave:goodbye";

export function rememberGoodbye(firstName: string): void {
  try {
    sessionStorage.setItem(KEY, firstName);
  } catch {
    // Storage blocked: the goodbye is only a nicety, so skip it quietly.
  }
  window.dispatchEvent(new Event(GOODBYE_EVENT));
}

/** The name to say goodbye to, once. Reading it clears it. */
export function takeGoodbye(): string | null {
  try {
    const name = sessionStorage.getItem(KEY);
    if (name === null) return null;
    sessionStorage.removeItem(KEY);
    return name;
  } catch {
    return null;
  }
}
