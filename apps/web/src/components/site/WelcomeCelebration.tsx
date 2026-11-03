import { useEffect, useRef, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Avatar, NameReveal } from "@/components/ui/motion";
import { useAuth } from "@/lib/auth";
import { isStaffRole } from "@/lib/staff-utils";
import {
  firstNameOf,
  greetingFor,
  takeWelcomePending,
  warmLineFor,
} from "@/lib/welcome";

const SHOW_MS = 7000;

const COLOURS = [
  "oklch(0.86 0.19 163)", // i-Save green
  "oklch(0.82 0.12 80)", // gold
  "oklch(0.78 0.14 25)", // coral
  "oklch(0.82 0.1 230)", // sky
  "oklch(0.97 0.02 100)", // cream
];
const FLOATERS = ["🎉", "💚", "✨", "🌟", "🎊", "🌱", "💫", "🎈"];

/** Same pieces every time (no randomness while rendering), each with its own path. */
function unit(n: number): number {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

const PIECES = Array.from({ length: 46 }, (_, i) => {
  const ribbon = i % 3 !== 0;
  return {
    id: i,
    left: unit(i + 1) * 100,
    delay: unit(i + 50) * 1.4,
    duration: 3.4 + unit(i + 99) * 2.6,
    drift: (unit(i + 7) - 0.5) * 220,
    spin: (unit(i + 31) > 0.5 ? 1 : -1) * (360 + unit(i + 3) * 720),
    width: ribbon ? 5 + unit(i + 11) * 3 : 8 + unit(i + 11) * 5,
    height: ribbon ? 22 + unit(i + 17) * 20 : 8 + unit(i + 11) * 5,
    radius: ribbon ? 3 : 99,
    colour: COLOURS[i % COLOURS.length] as string,
  };
});

const EMOJI_BUBBLES = FLOATERS.map((emoji, i) => ({
  emoji,
  left: 6 + (i * 88) / (FLOATERS.length - 1),
  delay: 0.3 + unit(i + 200) * 1.6,
  duration: 4.2 + unit(i + 220) * 2,
  size: 1.4 + unit(i + 240) * 1.1,
}));

/**
 * A warm welcome right after logging in (members and staff). It shows once per login,
 * closes by itself, and shows no moving parts if the device asks for reduced motion.
 */
export function WelcomeCelebration() {
  const { loading, session, profile, roles } = useAuth();
  const [visible, setVisible] = useState(false);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (loading || !session) return;
    if (takeWelcomePending()) setVisible(true);
  }, [loading, session]);

  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(() => setVisible(false), SHOW_MS);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setVisible(false);
    };
    window.addEventListener("keydown", onKey);
    button.current?.focus();
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, [visible]);

  if (!visible || !session) return null;

  const now = new Date();
  const staff = isStaffRole(roles);
  const greeting = greetingFor(now);
  const name = firstNameOf(profile?.fullName);

  return (
    <div
      className="welcome-overlay print:hidden fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={() => setVisible(false)}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        {PIECES.map((p) => (
          <span
            key={p.id}
            className="welcome-piece"
            style={{
              left: `${p.left}%`,
              width: p.width,
              height: p.height,
              borderRadius: p.radius,
              backgroundColor: p.colour,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              ["--drift" as string]: `${p.drift}px`,
              ["--spin" as string]: `${p.spin}deg`,
            }}
          />
        ))}
        {EMOJI_BUBBLES.map((b) => (
          <span
            key={b.emoji}
            className="welcome-emoji"
            style={{
              left: `${b.left}%`,
              fontSize: `${b.size}rem`,
              animationDelay: `${b.delay}s`,
              animationDuration: `${b.duration}s`,
            }}
          >
            {b.emoji}
          </span>
        ))}
      </div>

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        className="welcome-card relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card px-6 pt-10 pb-8 text-center shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="welcome-ribbon">Welcome back</div>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Avatar name={profile?.fullName} size={64} bounce />
          <span className="welcome-wave text-5xl" aria-hidden="true">
            👋
          </span>
        </div>
        <h2
          id="welcome-title"
          className="mt-3 text-2xl font-semibold md:text-3xl"
        >
          {greeting.text} <span aria-hidden="true">{greeting.emoji}</span>
          <br />
          <NameReveal name={name} className="text-primary" />
          <span aria-hidden="true"> 🎉</span>
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          {staff
            ? "Your workspace is ready."
            : "Your account is ready for you."}
        </p>
        <p className="mt-2 text-sm">{warmLineFor(now, staff)}</p>
        <button
          ref={button}
          type="button"
          className={buttonVariants({ className: "mt-6 w-full sm:w-auto" })}
          onClick={() => setVisible(false)}
        >
          Let’s go 🚀
        </button>
        <div className="welcome-timer" aria-hidden="true" />
      </div>
    </div>
  );
}
