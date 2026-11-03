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
  shareKey,
}: {
  timeoutMs: number;
  warnMs: number;
  onTimeout: () => void;
  enabled?: boolean;
  /**
   * If set, the time of the last activity is shared between browser tabs through
   * localStorage, so being active in one tab keeps every tab signed in.
   */
  shareKey?: string;
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
    let lastWrite = 0;
    const share = (now: number) => {
      if (!shareKey || now - lastWrite < 2000) return;
      lastWrite = now;
      try {
        localStorage.setItem(shareKey, String(now));
      } catch {
        // Private mode or full storage: this tab still works on its own clock.
      }
    };
    const sharedTime = () => {
      if (!shareKey) return 0;
      try {
        return Number(localStorage.getItem(shareKey)) || 0;
      } catch {
        return 0;
      }
    };
    const bump = () => {
      if (fired.current) return;
      last.current = Date.now();
      share(last.current);
      setSecondsLeft(null);
    };
    for (const name of ACTIVITY_EVENTS) {
      window.addEventListener(name, bump, { passive: true });
    }
    const timer = window.setInterval(() => {
      if (fired.current) return;
      const idle = Date.now() - Math.max(last.current, sharedTime());
      if (idle >= timeoutMs) {
        fired.current = true;
        setSecondsLeft(0);
        handler.current();
      } else if (idle >= timeoutMs - warnMs) {
        setSecondsLeft(Math.ceil((timeoutMs - idle) / 1000));
      } else {
        // Another tab was active: no warning needed here.
        setSecondsLeft((current) => (current === null ? current : null));
      }
    }, 1000);
    return () => {
      window.clearInterval(timer);
      for (const name of ACTIVITY_EVENTS) window.removeEventListener(name, bump);
    };
  }, [enabled, timeoutMs, warnMs, shareKey]);

  return { secondsLeft };
}
