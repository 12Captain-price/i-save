import type { CSSProperties, ReactNode } from "react";
import type { PlanTheme } from "@/lib/plan-theme";

// Small SVG scenes, one per plan theme. At rest each shows its finished picture. While
// `playing` is true the parts move (CSS in plan-card.css), for about three seconds.
// Drawn with plain shapes: no images and no animation library.

const INK = "var(--foreground)";
const GREEN = "var(--primary)";
const GOLD = "#e0a526";
const SKY = "#7cc4f0";

type Vars = CSSProperties & Record<`--${string}`, string>;
const v = (vars: Record<string, string>): Vars => vars as Vars;

function Scene({ theme }: { theme: PlanTheme }): ReactNode {
  switch (theme) {
    case "holiday":
      return (
        <>
          <circle cx="160" cy="24" r="12" fill={GOLD} className="pa-pop" />
          <g className="pa-fly">
            <path
              d="M70 40 l26 -4 l14 -14 l6 2 l-8 14 l14 -1 l5 -5 l4 1 l-4 8 l-18 5 l-14 10 l-5 -2 l7 -10 z"
              fill={INK}
            />
          </g>
          <g className="pa-wave">
            <path
              d="M-20 74 q10 -8 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 v20 h-200 z"
              fill={SKY}
              opacity="0.8"
            />
          </g>
          <g className="pa-wave pa-slow">
            <path
              d="M-20 80 q10 -8 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 v20 h-200 z"
              fill={GREEN}
              opacity="0.7"
            />
          </g>
        </>
      );
    case "asset":
      return (
        <>
          <rect x="60" y="66" width="80" height="6" fill={INK} opacity="0.25" />
          {[0, 1, 2, 3].map((row) => (
            <g
              key={row}
              className="pa-rise"
              style={{ animationDelay: `${row * 0.35}s` }}
            >
              {[0, 1, 2, 3].map((col) => (
                <rect
                  key={col}
                  x={64 + col * 18 + (row % 2 ? 9 : 0)}
                  y={58 - row * 11}
                  width="16"
                  height="9"
                  rx="1"
                  fill={row % 2 ? GREEN : GOLD}
                />
              ))}
            </g>
          ))}
          <path d="M56 24 L100 2 L144 24 z" fill={INK} className="pa-roof" />
        </>
      );
    case "emergency":
      return (
        <>
          {[70, 100, 130].map((x, i) => (
            <circle
              key={x}
              cx={x}
              cy="30"
              r="3"
              fill={SKY}
              className="pa-drop"
              style={{ animationDelay: `${i * 0.5}s` }}
            />
          ))}
          <g className="pa-pop">
            <path
              d="M100 18 C86 24 74 24 70 24 C70 50 80 62 100 70 C120 62 130 50 130 24 C126 24 114 24 100 18 z"
              fill={GREEN}
              stroke={INK}
              strokeWidth="2.5"
            />
            <path
              d="M88 44 l9 9 l17 -19"
              fill="none"
              stroke={INK}
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </>
      );
    case "retrenchment":
      return (
        <>
          <path
            d="M20 70 q20 -8 40 0 t40 0 t40 0 t40 0 v20 h-160 z"
            fill={SKY}
            opacity="0.8"
            className="pa-wave"
          />
          <g className="pa-float">
            <circle
              cx="100"
              cy="42"
              r="22"
              fill="none"
              stroke={GOLD}
              strokeWidth="12"
            />
            {[0, 90, 180, 270].map((a) => (
              <line
                key={a}
                x1="100"
                y1="20"
                x2="100"
                y2="30"
                stroke="#fff"
                strokeWidth="12"
                transform={`rotate(${a} 100 42)`}
              />
            ))}
            <circle
              cx="100"
              cy="42"
              r="22"
              fill="none"
              stroke={INK}
              strokeWidth="1.5"
            />
          </g>
          {[60, 140].map((x, i) => (
            <circle
              key={x}
              cx={x}
              cy="30"
              r="5"
              fill={GOLD}
              stroke={INK}
              strokeWidth="1.5"
              className="pa-drop"
              style={{ animationDelay: `${0.6 + i * 0.5}s` }}
            />
          ))}
        </>
      );
    case "education":
      return (
        <>
          <g className="pa-toss">
            <polygon points="100,10 140,26 100,42 60,26" fill={INK} />
            <path
              d="M80 34 v12 q20 10 40 0 v-12 l-20 8 z"
              fill={INK}
              opacity="0.85"
            />
            <line
              x1="136"
              y1="28"
              x2="136"
              y2="42"
              stroke={GOLD}
              strokeWidth="2.5"
            />
          </g>
          <g className="pa-book">
            <path
              d="M100 76 q-22 -10 -44 0 v-14 q22 -10 44 0 z"
              fill={GREEN}
              stroke={INK}
              strokeWidth="2"
            />
            <path
              d="M100 76 q22 -10 44 0 v-14 q-22 -10 -44 0 z"
              fill="#fff"
              stroke={INK}
              strokeWidth="2"
            />
          </g>
        </>
      );
    case "combo":
      return (
        <>
          {[
            { x: 60, y: 24, c: GOLD, dx: "-50px", dy: "-10px" },
            { x: 140, y: 24, c: SKY, dx: "50px", dy: "-10px" },
            { x: 100, y: 68, c: GREEN, dx: "0px", dy: "30px" },
          ].map((o) => (
            <circle
              key={o.c}
              cx={o.x}
              cy={o.y}
              r="10"
              fill={o.c}
              stroke={INK}
              strokeWidth="2"
              className="pa-merge"
              style={v({ "--dx": o.dx, "--dy": o.dy })}
            />
          ))}
          <g className="pa-pop pa-late">
            <circle
              cx="100"
              cy="44"
              r="20"
              fill="none"
              stroke={INK}
              strokeWidth="3"
            />
            <path
              d="M92 44 h16 M100 36 v16"
              stroke={INK}
              strokeWidth="3.5"
              strokeLinecap="round"
            />
          </g>
        </>
      );
    default:
      return (
        <>
          {[88, 100, 112].map((x, i) => (
            <circle
              key={x}
              cx={x}
              cy="40"
              r="6"
              fill={GOLD}
              stroke={INK}
              strokeWidth="1.5"
              className="pa-drop"
              style={{ animationDelay: `${i * 0.45}s` }}
            />
          ))}
          <path
            d="M76 36 h48 v6 q6 8 0 26 q-4 8 -24 8 t-24 -8 q-6 -18 0 -26 z"
            fill="#fff"
            fillOpacity="0.55"
            stroke={INK}
            strokeWidth="2.5"
          />
          <rect x="72" y="30" width="56" height="8" rx="3" fill={INK} />
        </>
      );
  }
}

export function PlanAnimation({
  theme,
  playing,
}: {
  theme: PlanTheme;
  playing: boolean;
}) {
  return (
    <svg
      viewBox="0 0 200 90"
      role="presentation"
      aria-hidden="true"
      className={`pa h-full w-full ${playing ? "is-playing" : ""}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <Scene theme={theme} />
    </svg>
  );
}
