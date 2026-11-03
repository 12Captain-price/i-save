import {
  createElement,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { prefersReducedMotion } from "@/components/ui/motion";
import { cn } from "@/lib/utils";

/**
 * Fades its content up the first time it scrolls into view. Without IntersectionObserver
 * (or with reduced motion) it is simply visible, so content is never hidden by mistake.
 * `index` staggers neighbours: each one waits a little longer than the one before.
 */
export function Reveal({
  as = "div",
  index = 0,
  className,
  children,
}: {
  as?: "div" | "li" | "article" | "ol" | "section";
  index?: number;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(
    () => typeof IntersectionObserver === "undefined" || prefersReducedMotion(),
  );

  useEffect(() => {
    const el = ref.current;
    if (visible || !el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible]);

  return createElement(
    as,
    {
      ref,
      className: cn("reveal", className),
      "data-visible": visible ? "true" : "false",
      style: { ["--i" as string]: index },
    },
    children,
  );
}
