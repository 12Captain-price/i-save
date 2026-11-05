import { useEffect, useId, useRef, useState } from "react";
import { GraduationCap, House, Plane, Target } from "lucide-react";

const BARS = [48, 66, 87, 108, 131, 150, 174, 196];
const TREND = BARS.map((h, i) => [40 + i * 49 + 14.5, 271 - h - 10] as const);
const TREND_PATH = TREND.map(([x, y], i) => (i ? "L" : "M") + x + "," + y).join(
  " ",
);

/** Decorative: bars grow once, then the chart keeps moving with a savings line and a coin. SSR/no-JS and reduced motion show all bars. */
export function NextChapter() {
  const figure = useRef<HTMLElement>(null),
    started = useRef(false),
    id = useId();
  const [sequence, setSequence] = useState({ playing: false, step: 8 });
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches || !window.IntersectionObserver) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const finish = () => {
      timers.forEach(clearTimeout);
      setSequence({ playing: false, step: 8 });
    };
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting) || started.current)
          return;
        started.current = true;
        observer.disconnect();
        setSequence({ playing: true, step: 1 });
        for (let step = 2; step <= 8; step++)
          timers.push(
            setTimeout(
              () => setSequence({ playing: true, step }),
              (step - 1) * 170,
            ),
          );
        timers.push(setTimeout(finish, 1600));
      },
      { threshold: 0.2 },
    );
    if (figure.current) observer.observe(figure.current);
    const preference = () => {
      if (media.matches) {
        observer.disconnect();
        finish();
      }
    };
    media.addEventListener("change", preference);
    return () => {
      observer.disconnect();
      timers.forEach(clearTimeout);
      media.removeEventListener("change", preference);
    };
  }, []);
  return (
    <figure ref={figure} className="next-chapter">
      <div
        className="chapter-art"
        aria-hidden="true"
        data-animate={sequence.playing ? "true" : "false"}
      >
        <div className="chapter-heading">
          <span>Your next chapter</span>
          <span className="chapter-counter">
            Step {String(sequence.step).padStart(2, "0")}
          </span>
        </div>
        <svg
          className="chapter-chart"
          viewBox="0 0 480 300"
          width="480"
          height="300"
          focusable="false"
        >
          <defs>
            <pattern
              id={id + "-grid"}
              width="40"
              height="40"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="var(--border)"
                strokeWidth="1"
                opacity="0.5"
              />
            </pattern>
            <linearGradient id={id + "-bar"} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--primary)" stopOpacity="0.9" />
              <stop offset="1" stopColor="var(--primary)" stopOpacity="0.13" />
            </linearGradient>
          </defs>
          <rect
            x="22"
            y="28"
            width="436"
            height="244"
            fill={"url(#" + id + "-grid)"}
          />
          <circle
            cx="392"
            cy="110"
            r="105"
            fill="var(--primary)"
            opacity="0.025"
          />
          <line
            x1="30"
            y1="91"
            x2="448"
            y2="91"
            stroke="var(--primary)"
            strokeOpacity="0.22"
            strokeDasharray="3 7"
          />
          <line x1="30" y1="271" x2="448" y2="271" stroke="var(--border)" />
          {BARS.map((height, index) => (
            <rect
              key={index}
              data-sequence-bar=""
              className="chapter-bar"
              x={40 + index * 49}
              y={271 - height}
              width="29"
              height={height}
              rx="5"
              fill={"url(#" + id + "-bar)"}
              stroke="var(--primary)"
              strokeOpacity="0.32"
              style={{
                animationDelay: index * 170 + "ms",
                ["--b" as string]: index,
              }}
            />
          ))}
          <path
            id={id + "-trend"}
            d={TREND_PATH}
            pathLength={1}
            className="chapter-trend"
          />
          <g className="chapter-coin">
            <circle
              r="9"
              fill="var(--portal-warm)"
              stroke="#b8860b"
              strokeWidth="2"
            />
            <text
              y="3.5"
              textAnchor="middle"
              fontSize="10"
              fontWeight="800"
              fill="#6b4a00"
            >
              $
            </text>
            <animateMotion
              dur="6s"
              repeatCount="indefinite"
              calcMode="linear"
              keyPoints="0;1;1"
              keyTimes="0;0.55;1"
            >
              <mpath href={"#" + id + "-trend"} />
            </animateMotion>
          </g>
          <circle
            className="chapter-target"
            cx={TREND[7]![0]}
            cy={TREND[7]![1]}
            r="6"
          />
        </svg>
        <div className="chapter-goal">
          <Target size={22} />
          <span>A goal in view</span>
        </div>
        <div className="chapter-token chapter-education">
          <GraduationCap />
          <span>Education</span>
        </div>
        <div className="chapter-token chapter-home">
          <House />
          <span>Home</span>
        </div>
        <div className="chapter-token chapter-travel">
          <Plane />
          <span>Travel</span>
        </div>
      </div>
    </figure>
  );
}
