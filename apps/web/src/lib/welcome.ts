// Small helpers for the welcome celebration shown right after someone logs in.

const FLAG = "isave:welcome-pending";

/** Called by the login page after a successful sign-in, so a page refresh never replays it. */
export function markWelcomePending(): void {
  try {
    sessionStorage.setItem(FLAG, "1");
  } catch {
    // Storage blocked: the welcome is only a nicety, so skip it quietly.
  }
}

/** True once per login. Reading it clears it. */
export function takeWelcomePending(): boolean {
  try {
    if (sessionStorage.getItem(FLAG) !== "1") return false;
    sessionStorage.removeItem(FLAG);
    return true;
  } catch {
    return false;
  }
}

export function greetingFor(date: Date): { text: string; emoji: string } {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return { text: "Good morning", emoji: "☀️" };
  if (hour >= 12 && hour < 17) return { text: "Good afternoon", emoji: "🌤️" };
  return { text: "Good evening", emoji: "🌙" };
}

export function firstNameOf(fullName: string | null | undefined): string {
  const first = (fullName ?? "").trim().split(/\s+/)[0];
  return first || "there";
}

const MEMBER_LINES = [
  "Every small deposit is a step toward your goal. 🌱",
  "Saving together is stronger than saving alone. 🤝",
  "Your future self says thank you. 💚",
  "Little by little, it all adds up. ✨",
  "We are glad you are part of the i-Save family. 🏡",
  "Steady saving builds a brighter tomorrow. 🌅",
];

const STAFF_LINES = [
  "Thank you for keeping every member’s savings safe and accurate. 🛡️",
  "Careful records make happy members. 📒",
  "Great to have you on the team today! 🙌",
  "Every correct receipt builds trust. 🧾",
];

/** The same line all day, a different one tomorrow. */
export function warmLineFor(date: Date, staff: boolean): string {
  const lines = staff ? STAFF_LINES : MEMBER_LINES;
  const dayNumber = Math.floor(date.getTime() / 86_400_000);
  return lines[dayNumber % lines.length] as string;
}
