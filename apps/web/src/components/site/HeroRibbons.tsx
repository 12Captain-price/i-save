import { useEffect, useState } from "react";
import { prefersReducedMotion } from "@/components/ui/motion";

const COLOURS = [
  "oklch(0.86 0.19 163)", // i-Save green
  "oklch(0.82 0.12 80)", // gold
  "oklch(0.78 0.14 25)", // coral
  "oklch(0.82 0.1 230)", // sky
  "oklch(0.97 0.02 100)", // cream
];

/** Same pieces every time (no randomness while rendering), each with its own path. */
function unit(n: number): number {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

const RIBBONS = Array.from({ length: 30 }, (_, i) => ({
  id: i,
  left: 2 + unit(i + 1) * 96,
  delay: unit(i + 40) * 1.1,
  duration: 3.2 + unit(i + 90) * 2.2,
  drift: (unit(i + 7) - 0.5) * 180,
  spin: (unit(i + 31) > 0.5 ? 1 : -1) * (300 + unit(i + 3) * 600),
  width: 5 + unit(i + 11) * 4,
  height: 22 + unit(i + 17) * 26,
  colour: COLOURS[i % COLOURS.length] as string,
}));

const SHOW_MS = 6500;

/**
 * A one-time burst of ribbons when the home page opens. It is decoration only: it cannot be
 * clicked, it removes itself after a few seconds, and it never shows when the device asks
 * for reduced motion.
 */
export function HeroRibbons() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    setShow(true);
    const timer = setTimeout(() => setShow(false), SHOW_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!show) return null;
  return (
    <div className="hero-ribbons" aria-hidden="true">
      {RIBBONS.map((r) => (
        <span
          key={r.id}
          className="hero-ribbon"
          style={
            {
              left: `${r.left}%`,
              width: `${r.width}px`,
              height: `${r.height}px`,
              background: r.colour,
              animationDelay: `${r.delay}s`,
              animationDuration: `${r.duration}s`,
              ["--drift" as string]: `${r.drift}px`,
              ["--spin" as string]: `${r.spin}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
