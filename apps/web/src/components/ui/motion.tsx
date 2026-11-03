import { useEffect, useRef, useState, type CSSProperties } from "react";
import { formatMoney, type Money } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * Small, dependency-free motion pieces. Everything animates with CSS only (see styles.css),
 * and the reduced-motion rule there turns every animation off. Nothing here ever changes
 * a number the database gave us: counting up always ends on the exact stored amount.
 */

export function prefersReducedMotion(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  } catch {
    return false;
  }
}

/** "Tanaka Moyo" becomes "TM"; one name gives one letter. */
export function initialsOf(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "•";
  const first = parts[0]!.charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1]!.charAt(0) : "";
  return (first + last).toUpperCase();
}

export function Avatar({
  name,
  size = 36,
  bounce = false,
  className,
}: {
  name: string | null | undefined;
  size?: number;
  bounce?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-primary font-display font-bold text-primary-foreground select-none",
        bounce && "avatar-bounce",
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initialsOf(name)}
    </span>
  );
}

/** A name that pops in letter by letter. Screen readers get the whole name at once. */
export function NameReveal({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <span className={className} aria-label={name}>
      {Array.from(name).map((ch, i) => (
        <span
          key={`${i}-${ch}`}
          aria-hidden="true"
          className="name-letter"
          style={{ ["--i" as string]: i } as CSSProperties}
        >
          {ch === " " ? " " : ch}
        </span>
      ))}
    </span>
  );
}

/** Shimmering placeholder block. */
export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn("skeleton h-4", className)}
      style={style}
    />
  );
}

/** Replaces a plain "Loading…" line. Screen readers still hear "Loading…". */
export function LoadingSkeleton({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  const widths = ["100%", "82%", "64%", "90%", "70%"];
  return (
    <div role="status" className={cn("grid gap-2.5", className)}>
      <span className="sr-only">Loading…</span>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} style={{ width: widths[i % widths.length] }} />
      ))}
    </div>
  );
}

/** A tick inside a ring that draws itself. */
export function SuccessCheck({
  size = 40,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 52 52"
      width={size}
      height={size}
      aria-hidden="true"
      className={cn("shrink-0 text-primary", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle className="check-ring" cx="26" cy="26" r="22" pathLength={1} />
      <path className="check-tick" d="M15 27 l8 8 l15 -17" pathLength={1} />
    </svg>
  );
}

/** Counts from the previous number up to the target. */
function useCountUp(target: number, ms = 1000): number {
  const [n, setN] = useState(() => (prefersReducedMotion() ? target : 0));
  const from = useRef(n);
  useEffect(() => {
    if (prefersReducedMotion()) {
      from.current = target;
      setN(target);
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = a + (target - a) * eased;
      from.current = v;
      setN(v);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return n;
}

/** Money that counts up. The last frame is always the exact amount, never a rounded float. */
export function CountUpMoney({
  value,
  currency,
}: {
  value: Money;
  currency: string;
}) {
  const target = Number(value);
  const n = useCountUp(Number.isFinite(target) ? target : 0);
  const done = !Number.isFinite(target) || Math.abs(n - target) < 0.005;
  return (
    <>
      {done
        ? formatMoney(value, currency)
        : formatMoney(n.toFixed(2), currency)}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Celebrations                                                        */
/* ------------------------------------------------------------------ */

const CONFETTI = [
  "oklch(0.86 0.19 163)",
  "oklch(0.82 0.12 80)",
  "oklch(0.78 0.14 25)",
  "oklch(0.82 0.1 230)",
  "oklch(0.97 0.02 100)",
];

/** Same pieces every time (no randomness while rendering). */
function unit(n: number): number {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

const PIECES = Array.from({ length: 28 }, (_, i) => ({
  id: i,
  left: 4 + unit(i + 3) * 92,
  delay: unit(i + 40) * 0.9,
  duration: 2.6 + unit(i + 90) * 1.8,
  drift: (unit(i + 7) - 0.5) * 160,
  spin: (unit(i + 21) > 0.5 ? 1 : -1) * (300 + unit(i + 5) * 600),
  size: 8 + unit(i + 13) * 8,
}));

/** Falling coins or confetti. Purely decorative, hidden from screen readers. */
export function FallingPieces({ kind }: { kind: "coins" | "confetti" }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[89] overflow-hidden"
    >
      {PIECES.map((p) =>
        kind === "coins" ? (
          <span
            key={p.id}
            className="coin-piece"
            style={
              {
                left: `${p.left}%`,
                width: p.size + 4,
                height: p.size + 4,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
                "--drift": `${p.drift}px`,
                "--spin": `${p.spin}deg`,
              } as CSSProperties
            }
          />
        ) : (
          <span
            key={p.id}
            className="welcome-piece"
            style={
              {
                left: `${p.left}%`,
                width: p.id % 3 === 0 ? p.size : p.size * 0.6,
                height: p.id % 3 === 0 ? p.size : p.size * 1.8,
                borderRadius: p.id % 3 === 0 ? 99 : 3,
                backgroundColor: CONFETTI[p.id % CONFETTI.length],
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
                "--drift": `${p.drift}px`,
                "--spin": `${p.spin}deg`,
              } as CSSProperties
            }
          />
        ),
      )}
    </div>
  );
}

export type CelebrationSpec = {
  /** Changes for every new celebration, so a repeat is still a new one. */
  id: string;
  title: string;
  detail?: string;
  /** coins and confetti for good news; calm for quiet moments such as money going out. */
  tone: "coins" | "confetti" | "calm";
};

/**
 * A banner at the top of the screen with a self-drawing tick. Callers only show it after the
 * database has confirmed the event, never before.
 */
export function CelebrationToast({
  spec,
  onDone,
}: {
  spec: CelebrationSpec;
  onDone: () => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, spec.tone === "calm" ? 3500 : 6000);
    return () => window.clearTimeout(timer);
  }, [spec.id, spec.tone, onDone]);

  return (
    <>
      {spec.tone !== "calm" && <FallingPieces kind={spec.tone} />}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[90] flex justify-center px-4 print:hidden">
        <div
          role="status"
          key={spec.id}
          className="celebrate-card pointer-events-auto flex max-w-md items-center gap-4 rounded-2xl border border-primary/40 bg-card px-5 py-4 shadow-2xl"
        >
          <SuccessCheck size={44} />
          <div className="min-w-0">
            <p className="font-display font-semibold">{spec.title}</p>
            {spec.detail && (
              <p className="mt-0.5 text-sm text-muted-foreground">
                {spec.detail}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onDone}
            aria-label="Dismiss"
            className="-mr-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
          >
            ×
          </button>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* "Seen before" markers, so a celebration plays once                   */
/* ------------------------------------------------------------------ */

export function readSeen(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeSeen(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage blocked: the celebration is only a nicety, so skip it quietly.
  }
}
