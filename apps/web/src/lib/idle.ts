import { useEffect, useRef, useState } from "react";

const ACTIVITY_EVENTS = ["pointerdown", "mousemove", "keydown", "scroll", "touchstart"] as const;

/**
 * Calls `onTimeout` once after `timeoutMs` with no activity. During the last `warnMs`,
 * `secondsLeft` counts down so a warning can be shown; any activity cancels it.
 */
export function useIdleTimeout({
  timeoutMs,
  warnMs,
  onTimeout,
  enabled = true,
}: {
  timeoutMs: number;
  warnMs: number;
  onTimeout: () => void;
  enabled?: boolean;
}) {
  const last = useRef(Date.now());
  const fired = useRef(false);
  const handler = useRef(onTimeout);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    handler.current = onTimeout;
  });

  useEffect(() => {
    if (!enabled) return;
    last.current = Date.now();
    fired.current = false;
    const bump = () => {
      if (fired.current) return;
      last.current = Date.now();
      setSecondsLeft(null);
    };
    for (const name of ACTIVITY_EVENTS) {
      window.addEventListener(name, bump, { passive: true });
    }
    const timer = window.setInterval(() => {
      if (fired.current) return;
      const idle = Date.now() - last.current;
      if (idle >= timeoutMs) {
        fired.current = true;
        setSecondsLeft(0);
        handler.current();
      } else if (idle >= timeoutMs - warnMs) {
        setSecondsLeft(Math.ceil((timeoutMs - idle) / 1000));
      }
    }, 1000);
    return () => {
      window.clearInterval(timer);
      for (const name of ACTIVITY_EVENTS) window.removeEventListener(name, bump);
    };
  }, [enabled, timeoutMs, warnMs]);

  return { secondsLeft };
}
