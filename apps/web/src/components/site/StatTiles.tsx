import { useEffect, useRef, useState } from "react";
import { Layers, Target, Users, type LucideIcon } from "lucide-react";
import { Reveal } from "@/components/site/Reveal";
import { prefersReducedMotion } from "@/components/ui/motion";
import { useAgents } from "@/lib/agents";
import { HOME_MEMBER_COUNT, countAt, formatCount } from "@/lib/home-stats";

/** Number of savings categories shown on this page. Keep in step with GOALS in routes/index.tsx. */
export const SAVINGS_GOAL_COUNT = 5;

const COUNT_MS = 1400;

/**
 * Counts up once, the first time it scrolls into view, and always lands on the exact value.
 * Screen readers get the final number straight away; the animated digits are hidden from them.
 */
function StatCount({ value, suffix = "" }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(() =>
    prefersReducedMotion() || typeof IntersectionObserver === "undefined"
      ? value
      : 0,
  );

  useEffect(() => {
    const el = ref.current;
    if (
      !el ||
      prefersReducedMotion() ||
      typeof IntersectionObserver === "undefined"
    ) {
      setN(value);
      return;
    }
    let raf = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const progress = (now - start) / COUNT_MS;
          setN(countAt(value, progress));
          if (progress < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value]);

  return (
    <span ref={ref}>
      <span className="sr-only">
        {formatCount(value)}
        {suffix}
      </span>
      <span aria-hidden="true">
        {formatCount(n)}
        {suffix}
      </span>
    </span>
  );
}

type Tile = {
  key: string;
  value: number;
  suffix?: string;
  label: string;
  note: string;
  Icon: LucideIcon;
};

/** Three bold tiles under the hero. Facts only: no amounts, returns or promises. */
export function StatTiles() {
  const agents = useAgents();
  const agentCount = agents.data?.length ?? 0;

  const tiles: Tile[] = [];
  if (HOME_MEMBER_COUNT !== null) {
    tiles.push({
      key: "members",
      value: HOME_MEMBER_COUNT,
      suffix: "+",
      label: "Members",
      note: "People saving towards their goals with i-Save.",
      Icon: Users,
    });
  }
  tiles.push({
    key: "goals",
    value: SAVINGS_GOAL_COUNT,
    label: "Savings goals",
    note: "From education to emergencies, pick the goal that fits you.",
    Icon: Target,
  });
  if (agentCount > 0) {
    tiles.push({
      key: "agents",
      value: agentCount,
      label: "Registration agents",
      note: "Choose the agent closest to you and register online.",
      Icon: Layers,
    });
  }

  return (
    <section aria-label="i-Save at a glance" className="home-width home-stats-wrap">
      <ul className="home-stats">
        {tiles.map(({ key, value, suffix, label, note, Icon }, i) => (
          <Reveal as="li" index={i} key={key} className="home-stat">
            <span className="home-stat-icon" aria-hidden="true">
              <Icon />
            </span>
            <p className="home-stat-number">
              <StatCount value={value} suffix={suffix} />
            </p>
            <h3 className="home-stat-label">{label}</h3>
            <p className="home-stat-note">{note}</p>
          </Reveal>
        ))}
      </ul>
    </section>
  );
}
